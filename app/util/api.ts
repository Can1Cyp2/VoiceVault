import { Alert } from "react-native";
import { supabase } from "./supabase";
import { getSongsByArtist } from "./vocalRange";

export let errorCount = 0;

// Helper function to escape single quotes for PostgreSQL queries
const escapeQueryString = (query: string): string => {
  return query.replace(/'/g, "''");
};

// Fetch songs based on a query
export const searchSongsByQuery = async (query: string): Promise<any[]> => {
  try {
    const escapedQuery = escapeQueryString(query);
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .or(`name.ilike.%${escapedQuery}%, artist.ilike.%${escapedQuery}%`);

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

    // Deduplicate by song ID
    const seenIds = new Set();
    const uniqueSongs = scored.filter(song => {
      if (seenIds.has(song.id)) return false;
      seenIds.add(song.id);
      return true;
    });

    return uniqueSongs.sort((a, b) => b._score - a._score);
  } catch (err) {
    console.error("searchSongsByQuery failed:", err);
    return [];
  }
};


// SMART SEARCH: ************************
// Simplified but effective search with focus on relevance
export const smartSearchSongs = async (query: string): Promise<any[]> => {
  try {
    if (!query.trim()) return [];

    const tokens = normalizeQuery(query);
    // console.log(`Search query: "${query}" -> tokens:`, tokens);  ---- DEBUGGING LOGS, commented out for production
    
    const candidates = await getCandidates(query, tokens);
    // console.log(`Found ${candidates.length} candidates`);
    
    const scoredResults = scoreResults(candidates, tokens, query);
    const rankedResults = applyFiltering(scoredResults);
    
    // Final deduplication by song ID to ensure no duplicates
    const seenIds = new Set();
    const uniqueResults = rankedResults.filter(song => {
      if (seenIds.has(song.id)) {
        return false;
      }
      seenIds.add(song.id);
      return true;
    });
    
    // console.log(`Filtered results: ${candidates.length} → ${rankedResults.length}`);
    
    // Enhanced debug logging
    // rankedResults.slice(0, 8).forEach((result, i) => {
    //   console.log(`#${i + 1}: "${result.name}" by ${result.artist} (Score: ${result._score})`, {
    //     strategy: result._searchStrategy,
    //     splitType: result._splitType,
    //     matchDetails: result._matchDetails
    //   });
    // });
    
    return uniqueResults.slice(0, 15);
    
  } catch (err) {
    console.error("smartSearchSongs failed:", err);
    return [];
  }
};

const normalizeQuery = (query: string): string[] => {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .split(' ')
    .filter(token => token.length > 0);
};

const getCandidates = async (originalQuery: string, tokens: string[]): Promise<any[]> => {
  const searchPromises: Promise<any[]>[] = [];
  
  // Detect if query ends with space (user might be typing more)
  const hasTrailingSpace = originalQuery.endsWith(' ');
  const trimmedQuery = originalQuery.trim();
  
  // Strategy 1: Exact and prefix matches (highest priority)
  if (!hasTrailingSpace) {
    const escapedQuery = escapeQueryString(trimmedQuery);
    searchPromises.push(
      supabase
        .from("songs")
        .select("*")
        .or(`name.eq.${escapedQuery}, artist.eq.${escapedQuery}`)
        .then(({ data }) => (data || []).map(song => ({ ...song, _searchStrategy: 'exact' })))
    );
  }
  
  // Always do prefix matches, but adjust for trailing space
  const prefixQuery = hasTrailingSpace ? trimmedQuery : trimmedQuery;
  const escapedPrefixQuery = escapeQueryString(prefixQuery);
  searchPromises.push(
    supabase
      .from("songs")
      .select("*")
      .or(`name.ilike.${escapedPrefixQuery}%, artist.ilike.${escapedPrefixQuery}%`)
      .then(({ data }) => (data || []).map(song => ({ ...song, _searchStrategy: 'prefix' })))
  );
  
  // Strategy 2: Contains matches (always useful)
  const escapedContainsQuery = escapeQueryString(trimmedQuery);
  searchPromises.push(
    supabase
      .from("songs")
      .select("*")
      .or(`name.ilike.%${escapedContainsQuery}%, artist.ilike.%${escapedContainsQuery}%`)
      .then(({ data }) => (data || []).map(song => ({ ...song, _searchStrategy: 'contains' })))
  );
  
  // Strategy 3: If there's a trailing space, treat it as potential "song artist" format
  if (hasTrailingSpace && trimmedQuery.length >= 2) {
    const escapedTitleQuery = escapeQueryString(trimmedQuery);
    // Look for songs where the trimmed query is the complete song title
    searchPromises.push(
      supabase
        .from("songs")
        .select("*")
        .eq('name', escapedTitleQuery)
        .then(({ data }) => (data || []).map(song => ({ 
          ...song, 
          _searchStrategy: 'title_complete',
          _isTrailingSpace: true 
        })))
    );
    
    // Also look for prefix matches on song titles (in case they're still typing the title)
    searchPromises.push(
      supabase
        .from("songs")
        .select("*")
        .ilike('name', `${escapedTitleQuery}%`)
        .then(({ data }) => (data || []).map(song => ({ 
          ...song, 
          _searchStrategy: 'title_prefix',
          _isTrailingSpace: true 
        })))
    );
  }
  
  // Strategy 4: Smart splits for multi-word queries (but not if trailing space)
  if (!hasTrailingSpace && tokens.length >= 2 && tokens.length <= 5) {
    const splits = generateSplits(tokens);
    
    splits.forEach(split => {
      const escapedTitle = escapeQueryString(split.title);
      const escapedArtist = escapeQueryString(split.artist);
      searchPromises.push(
        supabase
          .from("songs")
          .select("*")
          .ilike('name', `%${escapedTitle}%`)
          .ilike('artist', `%${escapedArtist}%`)
          .then(({ data }) => (data || []).map(song => ({
            ...song,
            _searchStrategy: 'split',
            _splitInfo: split
          })))
      );
    });
  }
  
  const results = await Promise.all(searchPromises);
  const allCandidates = results.flat();
  
  // Deduplicate while preserving best strategy per song
  const songMap = new Map();
  allCandidates.forEach(song => {
    const existing = songMap.get(song.id);
    if (!existing || getStrategyPriority(song._searchStrategy) > getStrategyPriority(existing._searchStrategy)) {
      songMap.set(song.id, song);
    }
  });
  
  return Array.from(songMap.values());
};

const generateSplits = (tokens: string[]) => {
  const splits = [];
  
  // Generate all reasonable splits
  for (let i = 1; i < tokens.length; i++) {
    const titlePart = tokens.slice(0, i).join(' ');
    const artistPart = tokens.slice(i).join(' ');
    
    // Only include if both parts are reasonable length
    if (titlePart.length >= 2 && artistPart.length >= 2) {
      splits.push({ 
        title: titlePart, 
        artist: artistPart, 
        type: `title_first_${i}`,
        confidence: calculateSplitConfidence(titlePart, artistPart)
      });
      
      splits.push({ 
        title: artistPart, 
        artist: titlePart, 
        type: `artist_first_${i}`,
        confidence: calculateSplitConfidence(artistPart, titlePart) * 0.9
      });
    }
  }
  
  // Return best splits only
  return splits
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);
};

const calculateSplitConfidence = (title: string, artist: string) => {
  let confidence = 0.5;
  
  // Prefer shorter artist names (more common)
  const artistWords = artist.split(' ').length;
  if (artistWords <= 2) confidence += 0.3;
  else if (artistWords === 3) confidence += 0.1;
  
  // Prefer longer titles
  const titleWords = title.split(' ').length;
  if (titleWords >= 2) confidence += 0.2;
  
  return confidence;
};

const getStrategyPriority = (strategy: string) => {
  const priorities = {
    exact: 100,
    title_complete: 95, // Complete title match with trailing space
    prefix: 90,
    title_prefix: 85,   // Title prefix with trailing space
    split: 80,
    contains: 70,
    token: 60
  };
  return priorities[strategy] || 0;
};

const scoreResults = (candidates: any[], tokens: string[], originalQuery: string) => {
  const lowerQuery = originalQuery.toLowerCase().trim();
  const hasTrailingSpace = originalQuery.endsWith(' ');
  
  return candidates.map(song => {
    const name = (song.name || "").toLowerCase();
    const artist = (song.artist || "").toLowerCase();
    let score = 0;
    
    const matchDetails = {
      exactMatch: false,
      perfectMatch: false,
      titleMatch: false,
      artistMatch: false,
      multiFieldMatch: false,
      strategy: song._searchStrategy,
      trailingSpace: hasTrailingSpace
    };
    
    // Score based on search strategy and match quality
    switch (song._searchStrategy) {
      case 'exact':
        if (name === lowerQuery) {
          score = 10000;
          matchDetails.perfectMatch = true;
          matchDetails.exactMatch = true;
          matchDetails.titleMatch = true;
        } else if (artist === lowerQuery) {
          score = 9500;
          matchDetails.perfectMatch = true;
          matchDetails.exactMatch = true;
          matchDetails.artistMatch = true;
        }
        break;
        
      case 'title_complete':
        if (name === lowerQuery) {
          score = 9800; // Very high score for complete title match with trailing space
          matchDetails.perfectMatch = true;
          matchDetails.titleMatch = true;
        }
        break;
        
      case 'title_prefix':
        if (name.startsWith(lowerQuery)) {
          score = 8500; // High score for title prefix with trailing space
          matchDetails.titleMatch = true;
        }
        break;
        
      case 'prefix':
        if (name.startsWith(lowerQuery)) {
          score = 8000;
          matchDetails.titleMatch = true;
        } else if (artist.startsWith(lowerQuery)) {
          score = 7500;
          matchDetails.artistMatch = true;
        }
        break;
        
      case 'contains':
        if (name.includes(lowerQuery)) {
          score = 6000;
          matchDetails.titleMatch = true;
        } else if (artist.includes(lowerQuery)) {
          score = 5500;
          matchDetails.artistMatch = true;
        }
        break;
        
      case 'split':
        if (song._splitInfo) {
          const split = song._splitInfo;
          const titleMatch = checkMatch(name, split.title);
          const artistMatch = checkMatch(artist, split.artist);
          
          if (titleMatch.matched && artistMatch.matched) {
            score = 7000; // High score for successful splits
            score += split.confidence * 500; // Confidence bonus
            score += titleMatch.quality * 300; // Match quality bonus
            score += artistMatch.quality * 300;
            
            matchDetails.multiFieldMatch = true;
            matchDetails.titleMatch = true;
            matchDetails.artistMatch = true;
            
            // console.log(`Split success: "${name}" by "${artist}" | Looking for: "${split.title}" by "${split.artist}" | Score: ${score}`);
          }
        }
        break;
    }
    
    return {
      ...song,
      _score: Math.round(score),
      _matchDetails: matchDetails
    };
  }).filter(song => song._score > 0); // Only keep songs that actually scored
};

// Helper function to check match quality
const checkMatch = (haystack: string, needle: string) => {
  const lower_needle = needle.toLowerCase();
  const lower_haystack = haystack.toLowerCase();
  
  if (lower_haystack === lower_needle) {
    return { matched: true, quality: 1.0 }; // Perfect match
  } else if (lower_haystack.startsWith(lower_needle)) {
    return { matched: true, quality: 0.8 }; // Prefix match
  } else if (lower_haystack.includes(lower_needle)) {
    return { matched: true, quality: 0.6 }; // Contains match
  }
  
  // Check for partial word matches (e.g., "blue" matches "blue october")
  const haystackWords = lower_haystack.split(' ');
  const needleWords = lower_needle.split(' ');
  
  let matchedWords = 0;
  needleWords.forEach(needleWord => {
    if (haystackWords.some(haystackWord => 
      haystackWord.includes(needleWord) || needleWord.includes(haystackWord)
    )) {
      matchedWords++;
    }
  });
  
  if (matchedWords === needleWords.length) {
    return { matched: true, quality: 0.4 + (matchedWords / needleWords.length) * 0.2 };
  }
  
  return { matched: false, quality: 0 };
};

const applyFiltering = (scoredResults: any[]) => {
  // Simple but effective filtering
  return scoredResults
    .filter(result => {
      // Keep all high-scoring results
      if (result._score >= 5000) return true;
      
      // Keep multi-field matches with decent scores
      if (result._matchDetails.multiFieldMatch && result._score >= 3000) return true;
      
      // Keep strong single-field matches
      if (result._score >= 6000) return true;
      
      return false;
    })
    .sort((a, b) => {
      // Primary sort: score
      if (b._score !== a._score) return b._score - a._score;
      
      // Tie breaker: prefer multi-field matches
      if (b._matchDetails.multiFieldMatch !== a._matchDetails.multiFieldMatch) {
        return b._matchDetails.multiFieldMatch ? 1 : -1;
      }
      
      // Final tie breaker: alphabetical
      return (a.name || "").localeCompare(b.name || "");
    });
};

// Simplified artist search
export const smartSearchArtists = async (
  query: string,
  limit: number = 20
): Promise<any[]> => {
  try {
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase();
    const escapedQuery = escapeQueryString(query);
    
    const { data: matchingSongs, error } = await supabase
      .from("songs")
      .select("artist")
      .or(`artist.eq.${escapedQuery}, artist.ilike.${escapedQuery}%, artist.ilike.%${escapedQuery}%`)
      .limit(100);
    
    if (error || !matchingSongs) return [];
    
    const artistMap = new Map();
    
    matchingSongs.forEach(song => {
      if (!song.artist) return;
      
      const artistLower = song.artist.toLowerCase();
      const current = artistMap.get(song.artist) || { name: song.artist, score: 0, count: 0 };
      
      let score = current.score;
      if (artistLower === lowerQuery) score += 1000;
      else if (artistLower.startsWith(lowerQuery)) score += 500;
      else if (artistLower.includes(lowerQuery)) score += 200;
      
      artistMap.set(song.artist, {
        name: song.artist,
        score,
        count: current.count + 1
      });
    });
    
    return Array.from(artistMap.values())
      .filter(artist => artist.score >= 100)
      .sort((a, b) => b.score - a.score || b.count - a.count)
      .slice(0, limit);
      
  } catch (err) {
    console.error("smartSearchArtists failed:", err);
    return [];
  }
};

// Simplified suggestions
export const getSearchSuggestions = async (query: string): Promise<string[]> => {
  try {
    if (!query.trim()) return [];
    
    const escapedQuery = escapeQueryString(query);
    const { data, error } = await supabase
      .from("songs")
      .select("name, artist")
      .or(`name.ilike.${escapedQuery}%, artist.ilike.${escapedQuery}%`)
      .limit(20);
    
    if (error || !data) return [];
    
    const suggestions = new Set<string>();
    data.forEach(song => {
      if (song.name) suggestions.add(song.name);
      if (song.artist) suggestions.add(song.artist);
    });
    
    return Array.from(suggestions)
      .filter(s => s.toLowerCase() !== query.toLowerCase())
      .slice(0, 5);
      
  } catch (err) {
    console.error("getSearchSuggestions failed:", err);
    return [];
  }
};

// SMART SEARCH ^^^^ ***************************************************

// Fetch artists based on a query, ensuring the artist's name contains the query
export const searchArtistsByQuery = async (
  query: string,
  limit: number = 20
): Promise<any[]> => {
  try {
    const escapedQuery = escapeQueryString(query);
    // Step 1: Find songs where the artist name matches the query
    const { data: matchingSongs, error: songError } = await supabase
      .from("songs")
      .select("artist, name")
      .ilike("artist", `%${escapedQuery}%`); // Only match on artist name

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
        // Deduplicate before adding
        const newUniqueSongs = data.filter(
          (song: any) => !selectedSongs.some((s) => s.id === song.id)
        );
        selectedSongs.push(...newUniqueSongs);
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

// ********* ADD SONG SECTION:  **********

// Add a new song to the pending_songs table for admin review
export const addSong = async (song: {
  name: string;
  vocalRange: string;
  artist: string;
  username?: string;
}): Promise<void> => {
  try {
    const user = supabase.auth.user();
    if (!user) {
      throw new Error("You must be logged in to submit a song.");
    }

    console.log("Submitting song to pending_songs:", {
      name: song.name,
      vocal_range: song.vocalRange,
      artist: song.artist,
      user_id: user.id,
      username: song.username || null,
      status: "pending",
    });

    const { data, error } = await supabase.from("pending_songs").insert([
      {
        name: song.name,
        vocal_range: song.vocalRange,
        artist: song.artist,
        user_id: user.id,
        username: song.username || null,
        status: "pending",
      },
    ]);

    if (error) {
      console.error("Error submitting song for review:", error.message);
      console.error("Full error object:", error);
      throw error;
    }

    console.log("Song submitted for review successfully:", data);
  } catch (error) {
    console.error("Error in addSong:", (error as any).message);
    throw error;
  }
};

// Check for similar songs in BOTH songs and pending_songs tables
export const checkForSimilarSong = async (
  songName: string,
  artistName: string
) => {
  try {
    const escapedSongName = escapeQueryString(songName);
    const escapedArtistName = escapeQueryString(artistName);
    
    // Check in main songs table (assuming it uses 'vocalRange' column)
    const { data: existingSongs, error: songsError } = await supabase
      .from("songs")
      .select("name, artist")
      .ilike("artist", `%${escapedArtistName}%`)
      .ilike("name", `%${escapedSongName}%`);

    if (songsError) {
      console.error("Error checking existing songs:", songsError);
    }

    // Check in pending songs table (assuming it uses 'vocal_range' column)
    const { data: pendingSongs, error: pendingError } = await supabase
      .from("pending_songs")
      .select("name, artist, status")
      .ilike("artist", `%${escapedArtistName}%`)
      .ilike("name", `%${escapedSongName}%`)
      .in("status", ["pending", "approved"]); // Don't warn about rejected songs

    if (pendingError) {
      console.error("Error checking pending songs:", pendingError);
    }

    // Return the first match found (prioritize existing songs over pending)
    if (existingSongs && existingSongs.length > 0) {
      return { ...existingSongs[0], source: "existing" };
    }

    if (pendingSongs && pendingSongs.length > 0) {
      return { ...pendingSongs[0], source: "pending" };
    }

    return null;
  } catch (err) {
    console.error("Unexpected error checking for similar songs:", err);
    return null;
  }
};

// Fetch user's pending song submissions
export const fetchUserPendingSongs = async (): Promise<any[]> => {
  try {
    const user = supabase.auth.user();
    if (!user) {
      throw new Error("You must be logged in to view your submissions.");
    }

    const { data, error } = await supabase
      .from("pending_songs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching user's pending songs:", error.message);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error in fetchUserPendingSongs:", error);
    return [];
  }
};

// Admin function to approve a pending song (moves it to main songs table)
export const approvePendingSong = async (
  pendingSongId: number
): Promise<void> => {
  try {
    const user = supabase.auth.user();
    if (!user) {
      throw new Error("You must be logged in to perform this action.");
    }

    // First, get the pending song data
    const { data: pendingSong, error: fetchError } = await supabase
      .from("pending_songs")
      .select("*")
      .eq("id", pendingSongId)
      .single();

    if (fetchError || !pendingSong) {
      throw new Error("Pending song not found.");
    }

    // Insert into main songs table
    const { error: insertError } = await supabase.from("songs").insert([
      {
        name: pendingSong.name,
        vocalRange: pendingSong.vocal_range, // Convert from pending_songs column name to songs column name
        artist: pendingSong.artist,
        user_id: pendingSong.user_id,
        username: pendingSong.username,
      },
    ]);

    if (insertError) {
      throw new Error(
        `Error adding song to main database: ${insertError.message}`
      );
    }

    // Update pending song status to approved
    const { error: updateError } = await supabase
      .from("pending_songs")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", pendingSongId);

    if (updateError) {
      throw new Error(
        `Error updating pending song status: ${updateError.message}`
      );
    }

    console.log("Song approved and added to main database successfully");
  } catch (error) {
    console.error("Error in approvePendingSong:", error);
    throw error;
  }
};

// Admin function to reject a pending song
export const rejectPendingSong = async (
  pendingSongId: number,
  adminNotes?: string
): Promise<void> => {
  try {
    const user = supabase.auth.user();
    if (!user) {
      throw new Error("You must be logged in to perform this action.");
    }

    const { error } = await supabase
      .from("pending_songs")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: adminNotes || null,
      })
      .eq("id", pendingSongId);

    if (error) {
      throw new Error(`Error rejecting song: ${error.message}`);
    }

    console.log("Song rejected successfully");
  } catch (error) {
    console.error("Error in rejectPendingSong:", error);
    throw error;
  }
};