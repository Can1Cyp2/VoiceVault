import { Alert } from "react-native";
import { supabase } from "./supabase";
import {
  calculateOverallRange,
  getSongsByArtist,
  noteToValue,
} from "./vocalRange";

export let errorCount = 0;

// Fetch songs based on a query
export const searchSongsByQuery = async (query: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .or(`name.ilike.%${query}%, artist.ilike.%${query}%`);

    if (error) throw error;

    const lowerQuery = query.toLowerCase();
    const scored = (data || []).map((song) => {
      const name = song.name?.toLowerCase() || "";
      const artist = song.artist?.toLowerCase() || "";

      let score = 0;
      if (name === lowerQuery || artist === lowerQuery) score += 100;
      else if (name.startsWith(lowerQuery) || artist.startsWith(lowerQuery))
        score += 75;
      else if (name.includes(lowerQuery) || artist.includes(lowerQuery))
        score += 50;

      return { ...song, _score: score };
    });

    return scored.sort((a, b) => b._score - a._score);
  } catch (err) {
    console.error("searchSongsByQuery failed:", err);
    return [];
  }
};

// Fetch artists based on a query, ensuring the artist's name contains the query
export const searchArtistsByQuery = async (
  query: string,
  limit: number = 20
): Promise<any[]> => {
  try {
    // Step 1: Find songs where the artist name matches the query
    const { data: matchingSongs, error: songError } = await supabase
      .from("songs")
      .select("artist, name")
      .ilike("artist", `%${query}%`); // Only match on artist name

    if (songError) {
      console.error("Error searching songs for artists:", songError.message);
      return [];
    }

    // Step 2: Aggregate artists and calculate relevance scores
    const artistMap = new Map<
      string,
      { name: string; score: number; songCount: number }
    >();
    matchingSongs.forEach((song) => {
      if (!song.artist) return;

      // Skip if the artist name doesn't contain the query (case-insensitive)
      const queryLower = query.toLowerCase();
      const artistLower = song.artist.toLowerCase();
      if (!artistLower.includes(queryLower)) return;

      const current = artistMap.get(song.artist) || {
        name: song.artist,
        score: 0,
        songCount: 0,
      };

      // Calculate relevance score based on artist name match only
      let score = current.score;
      if (artistLower === queryLower) {
        score += 100; // Exact match
      } else if (artistLower.includes(queryLower)) {
        score += 50; // Partial match
      }

      artistMap.set(song.artist, {
        name: song.artist,
        score: score,
        songCount: current.songCount + 1,
      });
    });

    // Step 3: Get unique artists and fetch their songs
    const uniqueArtists = Array.from(artistMap.values()).sort(
      (a, b) =>
        b.score - a.score ||
        b.songCount - a.songCount ||
        a.name.localeCompare(b.name)
    );

    // Step 4: Fetch songs for each artist
    const artistDetails = await Promise.all(
      uniqueArtists.map(async (artist) => {
        const songs = await getSongsByArtist(artist.name);
        return {
          name: artist.name,
          songs: songs.map((song) => ({ vocalRange: song.vocalRange })),
          score: artist.score,
          songCount: artist.songCount,
        };
      })
    );

    // Step 5: Filter out artists with no songs and apply the limit
    return artistDetails
      .filter((artist) => artist.songs.length > 0)
      .slice(0, limit);
  } catch (err) {
    console.error("Unexpected error searching artists:", err);
    return [];
  }
};

// Add a new song to the database
export const addSong = async (song: {
  name: string;
  vocalRange: string;
  artist: string;
  username?: string;
}): Promise<void> => {
  try {

    const user = supabase.auth.user();
    if (!user) {
      throw new Error("You must be logged in to add a song.");
    }

    const { data, error } = await supabase.from("songs").insert([
      {
        name: song.name,
        vocalRange: song.vocalRange,
        artist: song.artist,
        user_id: user.id,
        username: song.username || null,
      },
    ]);

    if (error) {
      console.error("Error adding song:", error.message);
      throw error;
    }

    console.log("Song added successfully:", data);
  } catch (error) {
    console.error("Error in addSong:", (error as any).message);
    throw error;
  }
};

// Gets a users vocal ranges
export const fetchUserVocalRange = async () => {
  const user = supabase.auth.user();
  if (!user) {
    if (errorCount < 1) {
      Alert.alert(
        "One Time Message:",
        "Log in for a personalized view based on your vocal range."
      );
      errorCount++;
    }
    return null;
  }

  const { data, error } = await supabase
    .from("user_vocal_ranges")
    .select("min_range, max_range")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching user's vocal range:", error);
    return null;
  }
  return data;
};

// Helper function to fetch the min and max IDs from the songs table
const getSongIdRange = async (): Promise<{ minId: number; maxId: number }> => {
  try {
    console.log("Fetching min ID from songs table");
    const { data, error } = await supabase
      .from("songs")
      .select("id")
      .order("id", { ascending: true })
      .limit(1)
      .single();

    console.log("Fetching max ID from songs table");
    const { data: maxData, error: maxError } = await supabase
      .from("songs")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .single();

    if (error || maxError || !data || !maxData) {
      console.error("Error fetching song ID range:", {
        minError: error?.message,
        maxError: maxError?.message,
        minData: data,
        maxData: maxData,
      });
      return { minId: 1, maxId: 1 }; // Fallback to safe values
    }

    console.log(`Fetched song ID range: minId=${data.id}, maxId=${maxData.id}`);
    return { minId: data.id, maxId: maxData.id };
  } catch (err) {
    console.error("Unexpected error in getSongIdRange:", err);
    return { minId: 1, maxId: 1 }; // Fallback to safe values
  }
};

// Helper function to generate unique random IDs
const generateRandomIds = (
  min: number,
  max: number,
  count: number
): number[] => {
  const ids = new Set<number>();
  while (ids.size < count) {
    const randomId = Math.floor(Math.random() * (max - min + 1)) + min;
    ids.add(randomId);
  }
  return Array.from(ids);
};

// Fetch 50 random songs by selecting random song IDs
export const getRandomSongs = async (limit: number = 50): Promise<any[]> => {
  try {
    const { minId, maxId } = await getSongIdRange();
    if (minId === maxId) {
      console.warn("No valid ID range found for songs");
      return [];
    }

    let selectedSongs: any[] = [];
    let attempts = 0;
    const maxAttempts = 3; // Prevent infinite loops

    while (selectedSongs.length < limit && attempts < maxAttempts) {
      const remaining = limit - selectedSongs.length;
      const randomIds = generateRandomIds(minId, maxId, remaining);

      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .in("id", randomIds);

      if (error) {
        console.error("Error fetching random songs by ID:", error.message);
        throw error;
      }

      if (data && data.length > 0) {
        selectedSongs.push(...data);
      }

      attempts++;
      console.log(
        `Attempt ${attempts}: Fetched ${data?.length || 0} songs, total ${
          selectedSongs.length
        }/${limit}`
      );
    }

    if (selectedSongs.length < limit) {
      console.warn(
        `Only found ${selectedSongs.length} songs out of requested ${limit}`
      );
    }

    return selectedSongs.sort(() => 0.5 - Math.random()).slice(0, limit);
  } catch (error) {
    console.error("Error in getRandomSongs:", error);
    return [];
  }
};

// Report an issue about a song
export const reportIssue = async (
  songId: number | null,
  songName: string,
  vocalRange: string,
  issueText: string
): Promise<void> => {
  try {
    const user = supabase.auth.user();

    if (!user) {
      throw new Error("You must be logged in to report an issue.");
    }

    const issuePayload = {
      song_id: songId,
      song_name: songName,
      vocal_range: vocalRange,
      user_id: user.id,
      username: user.user_metadata?.username || "Anonymous",
      user_email: user.email || "No email",
      issue_text: issueText,
      status: "pending",
    };

    const { error } = await supabase.from("issues").insert([issuePayload]);

    if (error) {
      console.error("Error reporting issue:", error.message);
      throw error;
    }

    console.log("Issue reported successfully.");
  } catch (error) {
    console.error("Error in reportIssue:", error);
    throw error;
  }
};

// Fetch reported issues (for admin or review purposes)
export const fetchIssues = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from("issues")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching issues:", error.message);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error in fetchIssues:", error);
    return [];
  }
};

// Update the status of an issue (for admin review)
export const updateIssueStatus = async (
  issueId: number,
  newStatus: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from("issues")
      .update({ status: newStatus })
      .eq("id", issueId);

    if (error) {
      console.error("Error updating issue status:", error.message);
      throw error;
    }

    console.log(`Issue ${issueId} status updated to ${newStatus}`);
  } catch (error) {
    console.error("Error in updateIssueStatus:", error);
    throw error;
  }
};
