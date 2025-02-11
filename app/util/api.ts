// app/util/api.ts

import { supabase } from "./supabase"; // Import your Supabase client

// Fetch songs based on a query
export const searchSongsByQuery = async (query: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from("songs") // Replace with your table name
      .select("*")
      .or(`name.ilike.%${query}%, artist.ilike.%${query}%`); // Searches both song names and songs sung by artist

    if (error) {
      console.error("Error fetching songs:", error.message);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error in searchSongsByQuery:", error);
    return [];
  }
};

// Add a new song to the database
export const addSong = async (song: {
  name: string;
  vocalRange: string;
  artist: string;
  username?: string; // Add username as an optional property
}): Promise<void> => {
  try {
    // Get the currently logged-in user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Error fetching user:", authError.message);
      throw new Error("Failed to fetch user. Please log in.");
    }

    if (!user) {
      throw new Error("You must be logged in to add a song.");
    }

    // Insert the song into the database
    const { data, error } = await supabase.from("songs").insert([
      {
        name: song.name,
        vocalRange: song.vocalRange,
        artist: song.artist,
        user_id: user.id, // Include the user ID from Supabase auth
        username: song.username || null, // Include the username or null for admin-added songs
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

// Fetch artists based on a query
export const getArtists = async (query: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from("songs") // Fetch from the "songs" table
      .select("artist") // Only fetch the "artist" field
      .ilike("artist", `%${query}%`); // Filter artists by query (case-insensitive)

    if (error) {
      console.error("Error fetching artists:", error.message);
      throw error;
    }

    // Filter out invalid entries and deduplicate artist names
    const uniqueArtists = Array.from(
      new Set(data?.filter((song) => song.artist).map((song) => song.artist))
    ).map((artist) => ({ name: artist }));

    return uniqueArtists;
  } catch (error) {
    console.error("Error in getArtists:", error);
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
    const { data: user } = await supabase.auth.getUser();

    if (!user?.user) {
      throw new Error("You must be logged in to report an issue.");
    }

    const issuePayload = {
      song_id: songId,
      song_name: songName,
      vocal_range: vocalRange,
      user_id: user.user.id,
      username: user.user.user_metadata?.username || "Anonymous",
      user_email: user.user.email || "No email",
      issue_text: issueText,
      status: "pending", // Default status when an issue is reported
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
