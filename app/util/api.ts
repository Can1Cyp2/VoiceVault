import { Alert } from "react-native";
import { supabase } from "./supabase";
import { getSongsByArtist } from "./vocalRange";
import {
  SongInfoFilters,
  LENGTH_BUCKETS,
  hasActiveSongInfoFilters,
  hasCustomBpmRange,
  songMatchesSongInfoFilters,
} from "./songFilters";
import { TEMPO_BAND_RANGES } from "./songMetadata";

export let errorCount = 0;

// Note: Supabase filter values are URL parameters, not SQL literals, so
// apostrophes must NOT be escaped ("don't" is sent as-is). Doubling quotes
// here used to silently break every search containing an apostrophe.

// Fetch songs based on a query
export const searchSongsByQuery = async (query: string): Promise<any[]> => {
  try {
    const tolerantPattern = buildTolerantPattern(query);
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .or(
        `name.ilike.${orValue(`%${query}%`)},` +
          `artist.ilike.${orValue(`%${query}%`)},` +
          `name.ilike.${orValue(tolerantPattern)},` +
          `artist.ilike.${orValue(tolerantPattern)}`
      );

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
      else if (tolerantIncludes(name, query) || tolerantIncludes(artist, query))
        score += 40; // matched only once punctuation like apostrophes is ignored

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
export const smartSearchSongs = async (
  rawQuery: string,
  limit: number = 15,
  offset: number = 0,
  songInfoFilters?: SongInfoFilters
): Promise<any[]> => {
  try {
    if (!rawQuery.trim()) return [];

    // Fold phone-keyboard punctuation to ASCII before anything else, so both
    // the database filters and the scoring below compare like with like.
    const query = canonicalizePunctuation(rawQuery);

    const tokens = normalizeQuery(query);
    // console.log(`Search query: "${query}" -> tokens:`, tokens);  ---- DEBUGGING LOGS, commented out for production

    let candidates = await getCandidates(query, tokens);
    // console.log(`Found ${candidates.length} candidates`);

    // Song Info filters applied here, not per-strategy in getCandidates:
    // this function always re-runs the full multi-strategy candidate search
    // on every call (offset/limit below is a client-side slice, not real DB
    // pagination), so the complete candidate set is already in memory before
    // ranking - filtering it now cannot produce a thin/empty page the way
    // filtering a paginated fetch could. See songMatchesSongInfoFilters.
    if (songInfoFilters && hasActiveSongInfoFilters(songInfoFilters)) {
      candidates = candidates.filter((song) =>
        songMatchesSongInfoFilters(song, songInfoFilters)
      );
    }

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
    
    return uniqueResults.slice(offset, offset + limit);
    
  } catch (err) {
    console.error("smartSearchSongs failed:", err);
    return [];
  }
};

/**
 * Folds the punctuation variants a phone keyboard produces down to the plain
 * ASCII forms the database actually stores.
 *
 * THIS IS THE "not all songs are working" BUG. iOS and Android autocorrect
 * type a CURLY apostrophe (U+2019) when you tap the apostrophe key, but song
 * titles are stored with the straight ASCII one (U+0027) - 1096 of them in
 * this catalogue, versus 3 curly. So "Can't help falling in" typed on a
 * phone never matched "Can't Help Falling in Love": every scoring path
 * compared U+2019 against U+0027 and failed, and the song was dropped even
 * though the database had returned it. Dropping the apostrophe entirely
 * ("help falling in") worked, which is exactly the behaviour reported.
 *
 * Applied to BOTH sides of every comparison, and to the query before it is
 * sent, so the two can never disagree about which apostrophe is "the" one.
 */
export const canonicalizePunctuation = (value: string): string =>
  value
    .replace(/[‘’ʼ՚＇]/g, "'") // curly/modifier apostrophes
    .replace(/[“”«»]/g, '"') // curly double quotes
    .replace(/[–—−]/g, "-") // en/em dash, minus
    .replace(/…/g, "..."); // ellipsis

const normalizeQuery = (query: string): string[] => {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .split(' ')
    .filter(token => token.length > 0);
};

/**
 * Wraps a value for use inside a PostgREST `.or(...)` filter.
 *
 * WHY THIS IS REQUIRED, and what breaks without it:
 * `.or()` builds a string like `name.ilike.%foo%,artist.ilike.%foo%`, where
 * the COMMA separates conditions and PARENTHESES group them. So any song
 * title containing those characters corrupts the filter itself:
 *
 *   "Hello, Dolly!"  ->  HTTP 400, the whole search request fails
 *   "(Reprise)"      ->  parses but silently returns 0 rows
 *
 * Both verified against the live catalogue, where 198 titles contain a comma
 * and 241 contain a parenthesis. That is the real reason "not all songs are
 * working" - it was never really about apostrophes.
 *
 * PostgREST's answer is to double-quote the value, with any inner double
 * quote or backslash backslash-escaped. Wildcards still work inside quotes.
 */
const orValue = (value: string): string =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * Widens a single token so an apostrophe INSIDE a word is tolerated:
 * "dont" -> "don%t", which matches "Don't". The gap goes before the final
 * character because that is where English contractions put the apostrophe
 * (don't, can't, what's, he'd).
 *
 * Safe to apply to every token, including ones with no apostrophe, because
 * "%" also matches the empty string - "stop" becomes "sto%p", which still
 * matches "stop". Tokens of 1-2 characters are left alone, since splitting
 * them ("a%t") matches far too much for far too little gain.
 */
const tolerantToken = (token: string): string =>
  token.length > 2 ? `${token.slice(0, -1)}%${token.slice(-1)}` : token;

/**
 * Builds an ILIKE pattern that matches even when the stored name has
 * punctuation the user didn't type. Wildcards go BETWEEN words, so typing
 * "guns n roses" finds "Guns N' Roses", and also INSIDE each word, so typing
 * "dont stop" finds "Don't Stop" - the second case used to fail, because
 * "dont" is not a substring of "Don't" and no amount of gaps between words
 * can bridge that.
 *
 * Verified against the live catalogue: "%don%t%sto%p%" returns 19 rows, all
 * genuine matches. Deliberately not a gap between EVERY character
 * ("%d%o%n%t%"), which does find the right songs but also matches things
 * like "Does Anybody Really Know What Time It Is?" and pulls thousands of
 * rows the scorer then has to throw away.
 *
 * Falls back to a plain contains pattern for an empty query.
 */
const buildTolerantPattern = (query: string): string => {
  const tokens = normalizeQuery(query);
  if (tokens.length === 0) return `%${query}%`;
  return `%${tokens.map(tolerantToken).join('%')}%`;
};

/** True when every normalized token of the query appears somewhere in the
 *  haystack. Punctuation is stripped from the haystack as well as the query,
 *  so "dont" matches "Don't Stop" rather than silently failing. */
const tolerantIncludes = (haystack: string, query: string): boolean => {
  const tokens = normalizeQuery(query);
  if (tokens.length === 0) return false;
  const strippedHaystack = haystack.toLowerCase().replace(/[^\w\s]/g, "");
  return tokens.every(token => strippedHaystack.includes(token));
};

const getCandidates = async (originalQuery: string, tokens: string[]): Promise<any[]> => {
  const searchPromises: Promise<any[]>[] = [];
  
  // Detect if query ends with space (user might be typing more)
  const hasTrailingSpace = originalQuery.endsWith(' ');
  const trimmedQuery = originalQuery.trim();
  
  // Strategy 1: Exact and prefix matches (highest priority)
  if (!hasTrailingSpace) {
    searchPromises.push(
      supabase
        .from("songs")
        .select("*")
        .or(`name.eq.${orValue(trimmedQuery)},artist.eq.${orValue(trimmedQuery)}`)
        .then(({ data }) => (data || []).map(song => ({ ...song, _searchStrategy: 'exact' })))
    );
  }
  
  // Always do prefix matches, but adjust for trailing space
  searchPromises.push(
    supabase
      .from("songs")
      .select("*")
      .or(
        `name.ilike.${orValue(`${trimmedQuery}%`)},` +
          `artist.ilike.${orValue(`${trimmedQuery}%`)}`
      )
      .then(({ data }) => (data || []).map(song => ({ ...song, _searchStrategy: 'prefix' })))
  );
  
  // Strategy 2: Contains matches (always useful)
  searchPromises.push(
    supabase
      .from("songs")
      .select("*")
      .or(
        `name.ilike.${orValue(`%${trimmedQuery}%`)},` +
          `artist.ilike.${orValue(`%${trimmedQuery}%`)}`
      )
      .then(({ data }) => (data || []).map(song => ({ ...song, _searchStrategy: 'contains' })))
  );
  
  // Strategy 3: If there's a trailing space, treat it as potential "song artist" format
  if (hasTrailingSpace && trimmedQuery.length >= 2) {
    // Look for songs where the trimmed query is the complete song title
    searchPromises.push(
      supabase
        .from("songs")
        .select("*")
        .eq('name', trimmedQuery)
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
        .ilike('name', `${trimmedQuery}%`)
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
      searchPromises.push(
        supabase
          .from("songs")
          .select("*")
          .ilike('name', `%${split.title}%`)
          .ilike('artist', `%${split.artist}%`)
          .then(({ data }) => (data || []).map(song => ({
            ...song,
            _searchStrategy: 'split',
            _splitInfo: split
          })))
      );
    });
  }

  // Strategy 5: Punctuation-tolerant match - lets a query typed without
  // apostrophes find names that have them, both between words
  // ("guns n roses" -> "Guns N' Roses") and inside a word
  // ("dont stop" -> "Don't Stop"). Shares buildTolerantPattern with the
  // other search paths so all of them tolerate punctuation identically.
  //
  // Runs for SINGLE-token queries too (it previously required two or more),
  // which is why searching just "dont" or "cant" used to find nothing. Short
  // tokens are skipped because a 1-2 character pattern matches most of the
  // catalogue without narrowing anything.
  if (tokens.length >= 2 || (tokens.length === 1 && tokens[0].length >= 3)) {
    const tolerantPattern = buildTolerantPattern(originalQuery);
    searchPromises.push(
      supabase
        .from("songs")
        .select("*")
        .or(
          `name.ilike.${orValue(tolerantPattern)},` +
            `artist.ilike.${orValue(tolerantPattern)}`
        )
        .then(({ data }) => (data || []).map(song => ({ ...song, _searchStrategy: 'fuzzy' })))
    );
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
    fuzzy: 65,
    token: 60
  };
  return priorities[strategy] || 0;
};

const scoreResults = (candidates: any[], tokens: string[], originalQuery: string) => {
  // Canonicalised on BOTH sides so a curly apostrophe from a phone keyboard
  // compares equal to the straight one stored in the database.
  const lowerQuery = canonicalizePunctuation(originalQuery).toLowerCase().trim();
  const hasTrailingSpace = originalQuery.endsWith(' ');

  return candidates.map(song => {
    const name = canonicalizePunctuation(song.name || "").toLowerCase();
    const artist = canonicalizePunctuation(song.artist || "").toLowerCase();
    // Punctuation removed entirely, for comparing against normalizeQuery
    // tokens (which have already had it stripped). Without this, the token
    // "cant" is never found in "can't help falling in love" and the fuzzy
    // strategy scores 0 even when the database returned the right song.
    const strippedName = name.replace(/[^\w\s]/g, "");
    const strippedArtist = artist.replace(/[^\w\s]/g, "");
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
        
      case 'fuzzy':
        // Every token must appear somewhere in the field. Compared against
        // the PUNCTUATION-STRIPPED name/artist, because the tokens have had
        // theirs stripped too - matching "cant" against a raw "can't ..."
        // silently fails and was throwing away correct results.
        if (tokens.every(token => strippedName.includes(token))) {
          score = 5600;
          matchDetails.titleMatch = true;
        } else if (tokens.every(token => strippedArtist.includes(token))) {
          score = 5400;
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
    const tolerantPattern = buildTolerantPattern(query);

    const { data: matchingSongs, error } = await supabase
      .from("songs")
      .select("artist")
      .or(
        `artist.eq.${orValue(query)},` +
          `artist.ilike.${orValue(`${query}%`)},` +
          `artist.ilike.${orValue(`%${query}%`)},` +
          `artist.ilike.${orValue(tolerantPattern)}`
      )
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
      else if (tolerantIncludes(song.artist, query)) score += 150; // e.g. missing apostrophe

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
    
    const tolerantPattern = buildTolerantPattern(query);
    const { data, error } = await supabase
      .from("songs")
      .select("name, artist")
      .or(
        `name.ilike.${orValue(`${query}%`)},` +
          `artist.ilike.${orValue(`${query}%`)},` +
          `name.ilike.${orValue(tolerantPattern)},` +
          `artist.ilike.${orValue(tolerantPattern)}`
      )
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
    // Step 1: Find songs where the artist name matches the query. The
    // tolerant pattern also catches names with punctuation the user didn't
    // type, e.g. "guns n roses" finding "Guns N' Roses".
    const tolerantPattern = buildTolerantPattern(query);
    const { data: matchingSongs, error: songError } = await supabase
      .from("songs")
      .select("artist, name")
      .or(
        `artist.ilike.${orValue(`%${query}%`)},` +
          `artist.ilike.${orValue(tolerantPattern)}`
      );

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

      const queryLower = query.toLowerCase();
      const artistLower = song.artist.toLowerCase();
      const isTolerantMatch = tolerantIncludes(song.artist, query);

      // Skip if the artist name doesn't match at all, even tolerantly
      if (!artistLower.includes(queryLower) && !isTolerantMatch) return;

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
      } else if (isTolerantMatch) {
        score += 30; // Matched only once punctuation like apostrophes is ignored
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
    .select("min_range, max_range, voice_type")
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

// Helper function to generate unique random IDs, optionally skipping ones
// already tried in an earlier attempt (see getRandomSongs) so a retry after
// a filtered miss doesn't waste a draw re-picking the same id.
const generateRandomIds = (
  min: number,
  max: number,
  count: number,
  exclude?: Set<number>
): number[] => {
  const ids = new Set<number>();
  const rangeSize = max - min + 1;
  // Guards against an unreachable infinite loop (e.g. exclude somehow
  // covering the whole id space) rather than hanging the app.
  const attemptCap = Math.max(count * 50, 2000);
  let tries = 0;
  while (ids.size < count && tries < attemptCap) {
    tries++;
    const randomId = Math.floor(Math.random() * rangeSize) + min;
    if (exclude?.has(randomId)) continue;
    ids.add(randomId);
  }
  return Array.from(ids);
};

/**
 * Chains Song Info filter conditions (BPM/genre/year/length/key/tessitura)
 * onto a Supabase query builder for the songs table. Used wherever a real
 * DB-side filter is needed rather than a client-side one - see
 * songMatchesSongInfoFilters in songFilters.ts for the client-side twin used
 * by smartSearchSongs, and the comment on hasActiveSongInfoFilters for why
 * the two paths differ.
 *
 * Tempo bands and length buckets each become their own .or() group over one
 * column (bpm, duration_sec respectively); PostgREST ANDs independent
 * top-level logical filters together, the same way repeated .eq()/.in()
 * calls do, so this composes correctly with everything else chained on the
 * same query.
 */
const applySongInfoDbFilters = (query: any, f: SongInfoFilters) => {
  if (f.hasBpm) query = query.not("bpm", "is", null);
  if (f.hasGenre) query = query.not("genre", "is", null);
  if (f.hasYear) query = query.not("release_year", "is", null);
  if (f.hasLength) query = query.not("duration_sec", "is", null);
  if (f.hasKey) query = query.not("song_key", "is", null);
  if (f.hasTessitura) query = query.not("tessitura_median", "is", null);

  if (f.genres.length > 0) query = query.in("genre", f.genres);
  if (f.keys.length > 0) query = query.in("song_key", f.keys);

  // An exact typed BPM range takes precedence over the preset bands, matching
  // songMatchesSongInfoFilters. Bounds here are inclusive, unlike the bands'
  // exclusive upper edge, because a user typing "120 to 130" means both ends.
  if (hasCustomBpmRange(f)) {
    const min = f.bpmMin.trim() ? parseInt(f.bpmMin, 10) : null;
    const max = f.bpmMax.trim() ? parseInt(f.bpmMax, 10) : null;
    if (min !== null && !Number.isNaN(min)) query = query.gte("bpm", min);
    if (max !== null && !Number.isNaN(max)) query = query.lte("bpm", max);
  } else if (f.tempoBands.length > 0) {
    const groups = f.tempoBands
      .map((band) => TEMPO_BAND_RANGES.find((r) => r.band === band))
      .filter((r): r is (typeof TEMPO_BAND_RANGES)[number] => !!r)
      .map((r) =>
        r.maxBpm === null ? `bpm.gte.${r.minBpm}` : `and(bpm.gte.${r.minBpm},bpm.lt.${r.maxBpm})`
      );
    if (groups.length > 0) query = query.or(groups.join(","));
  }

  if (f.lengthBuckets.length > 0) {
    const groups = f.lengthBuckets
      .map((key) => LENGTH_BUCKETS.find((b) => b.key === key))
      .filter((b): b is (typeof LENGTH_BUCKETS)[number] => !!b)
      .map((b) =>
        b.maxSec === null
          ? `duration_sec.gte.${b.minSec}`
          : `and(duration_sec.gte.${b.minSec},duration_sec.lt.${b.maxSec})`
      );
    if (groups.length > 0) query = query.or(groups.join(","));
  }

  const yearMin = f.yearMin.trim() ? parseInt(f.yearMin, 10) : null;
  const yearMax = f.yearMax.trim() ? parseInt(f.yearMax, 10) : null;
  if (yearMin !== null && !Number.isNaN(yearMin)) query = query.gte("release_year", yearMin);
  if (yearMax !== null && !Number.isNaN(yearMax)) query = query.lte("release_year", yearMax);

  return query;
};

/**
 * A real, deterministically-paginated page of songs matching the given
 * filters, ordered by title.
 *
 * WHY THIS EXISTS, vs getRandomSongs:
 * Random-id sampling is great for unfiltered discovery but is the wrong tool
 * once a filter is on. It re-draws ids that were already shown, never
 * systematically covers the matching set, and - worst - a short page from a
 * missed draw is indistinguishable from "no results left", which made
 * infinite scroll give up early and forced a manual refresh to see more.
 *
 * Real offset pagination fixes all three: every matching song is reachable by
 * scrolling, nothing repeats, and a short page genuinely means the end.
 *
 * Ordered by name rather than id because ids are clustered by artist in this
 * catalogue, so id order would show 30 songs by one artist before reaching
 * the next. Alphabetical mixes artists and is stable across pages, which
 * offset pagination requires. There is no index on name; at this catalogue
 * size the sort is cheap, and filters shrink the set further before sorting.
 */
export const getFilteredSongsPage = async (
  limit: number,
  offset: number,
  songInfoFilters?: SongInfoFilters,
  opts?: { verifiedOnly?: boolean }
): Promise<any[]> => {
  try {
    let query = supabase.from("songs").select("*");

    if (songInfoFilters && hasActiveSongInfoFilters(songInfoFilters)) {
      query = applySongInfoDbFilters(query, songInfoFilters);
    }
    // Verified means "no community username attached" (see isVerifiedSong).
    // Applied here rather than client-side so it narrows the page BEFORE the
    // limit, instead of hollowing it out afterwards.
    if (opts?.verifiedOnly) {
      query = query.is("username", null);
    }

    const { data, error } = await query
      .order("name", { ascending: true })
      .order("id", { ascending: true }) // tie-break, keeps paging stable
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching filtered songs page:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error in getFilteredSongsPage:", err);
    return [];
  }
};

// Admin/search: distinct, non-null genres actually present in the songs
// table, sorted alphabetically. Never hardcoded - the set changes as songs
// are added, so the filter panel must read it live.
export const fetchDistinctGenres = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from("songs")
      .select("genre")
      .not("genre", "is", null);
    if (error) {
      console.warn("Error fetching distinct genres:", error.message);
      return [];
    }
    const set = new Set<string>();
    for (const row of data || []) {
      if (row.genre) set.add(row.genre);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  } catch (err) {
    console.warn("Error in fetchDistinctGenres:", err);
    return [];
  }
};

// Same as fetchDistinctGenres, for the estimated musical key. Pulled live
// rather than hardcoded from music theory's 24 possible keys, so the filter
// list can never drift from what normalise_key() in RangeHarvester actually
// writes (all-sharps, "Tonic mode" casing).
export const fetchDistinctKeys = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from("songs")
      .select("song_key")
      .not("song_key", "is", null);
    if (error) {
      console.warn("Error fetching distinct keys:", error.message);
      return [];
    }
    const set = new Set<string>();
    for (const row of data || []) {
      if (row.song_key) set.add(row.song_key);
    }
    // Musical order (chromatic, major before relative minor) reads better
    // than alphabetical for a list of keys.
    const order = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return Array.from(set).sort((a, b) => {
      const [tonicA, modeA] = a.split(" ");
      const [tonicB, modeB] = b.split(" ");
      const iA = order.indexOf(tonicA);
      const iB = order.indexOf(tonicB);
      if (iA !== iB) return iA - iB;
      return modeA.localeCompare(modeB);
    });
  } catch (err) {
    console.warn("Error in fetchDistinctKeys:", err);
    return [];
  }
};

// Fetch 50 random songs by selecting random song IDs
export const getRandomSongs = async (
  limit: number = 50,
  songInfoFilters?: SongInfoFilters
): Promise<any[]> => {
  try {
    const { minId, maxId } = await getSongIdRange();
    if (minId === maxId) {
      console.warn("No valid ID found for songs");
      return [];
    }

    const filtersActive = !!songInfoFilters && hasActiveSongInfoFilters(songInfoFilters);

    let selectedSongs: any[] = [];
    let attempts = 0;
    // Random-id sampling has a lower hit rate once filters narrow the
    // catalogue (e.g. only ~42% of songs have an estimated key), so a
    // filtered browse gets more attempts to still fill the requested count
    // rather than quietly returning a half-empty page.
    const maxAttempts = filtersActive ? 8 : 3;
    const triedIds = new Set<number>();

    while (selectedSongs.length < limit && attempts < maxAttempts) {
      const remaining = limit - selectedSongs.length;
      const randomIds = generateRandomIds(minId, maxId, remaining, triedIds);
      randomIds.forEach((id) => triedIds.add(id));

      let query = supabase.from("songs").select("*").in("id", randomIds);
      if (filtersActive) query = applySongInfoDbFilters(query, songInfoFilters!);
      const { data, error } = await query;

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
        `Only found ${selectedSongs.length} songs out of requested ${limit}` +
          (filtersActive ? " (Song Info filters active)" : "")
      );
    }

    return selectedSongs.sort(() => 0.5 - Math.random()).slice(0, limit);
  } catch (error) {
    console.error("Error in getRandomSongs:", error);
    return [];
  }
};

// Fire-and-forget: log that a song was opened from search, so the
// "Trending" filter can rank songs by recent popularity. Never throws -
// trending is a nice-to-have and must not break navigation.
export const logSongSearch = async (
  songId: number | null | undefined
): Promise<void> => {
  if (!songId) return;
  try {
    const { error } = await supabase
      .from("song_search_events")
      .insert([{ song_id: songId }]);
    if (error) {
      // warn, not error: telemetry only, must never red-box the app
      console.warn("Failed to log song search event:", error.message);
    }
  } catch (err) {
    console.warn("Failed to log song search event:", err);
  }
};

// Fetch the most-searched songs over the recent window (see the
// get_trending_songs SQL function). Returns [] on any failure so callers
// can fall back to random songs.
export const getTrendingSongs = async (
  limit: number = 50,
  days: number = 7
): Promise<any[]> => {
  try {
    const { data, error } = await supabase.rpc("get_trending_songs", {
      p_days: days,
      p_limit: limit,
    });
    if (error) {
      console.warn("Error fetching trending songs:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("Error in getTrendingSongs:", err);
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
    // Check in main songs table (assuming it uses 'vocalRange' column)
    const { data: existingSongs, error: songsError } = await supabase
      .from("songs")
      .select("name, artist")
      .ilike("artist", `%${artistName}%`)
      .ilike("name", `%${songName}%`);

    if (songsError) {
      console.error("Error checking existing songs:", songsError);
    }

    // Check in pending songs table (assuming it uses 'vocal_range' column)
    const { data: pendingSongs, error: pendingError } = await supabase
      .from("pending_songs")
      .select("name, artist, status")
      .ilike("artist", `%${artistName}%`)
      .ilike("name", `%${songName}%`)
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

// ********* SONG REQUESTS SECTION:  **********

export type SongRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "edited_and_approved";

export interface SongRequest {
  id: number;
  user_id: string | null;
  username: string | null;
  song_name: string;
  artist_name: string;
  status: SongRequestStatus;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Submit a song request (works for both guests and logged-in users)
export const submitSongRequest = async (
  songName: string,
  artistName: string
): Promise<void> => {
  try {
    const user = supabase.auth.user();

    const { error } = await supabase.from("song_requests").insert([
      {
        song_name: songName.trim(),
        artist_name: artistName.trim(),
        user_id: user?.id ?? null,
        username: user?.user_metadata?.display_name ?? null,
        status: "pending",
      },
    ]);

    if (error) {
      console.error("Error submitting song request:", error.message);
      throw error;
    }
  } catch (error) {
    console.error("Error in submitSongRequest:", error);
    throw error;
  }
};

// Fetch the logged-in user's own song requests (RLS limits rows to their own)
export const fetchMySongRequests = async (): Promise<SongRequest[]> => {
  try {
    const user = supabase.auth.user();
    if (!user) {
      throw new Error("You must be logged in to view your song requests.");
    }

    const { data, error } = await supabase
      .from("song_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching song requests:", error.message);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error in fetchMySongRequests:", error);
    return [];
  }
};

// Admin: fetch all song requests (RLS grants full read to active admins)
export const fetchAllSongRequests = async (): Promise<SongRequest[]> => {
  try {
    const { data, error } = await supabase
      .from("song_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching all song requests:", error.message);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error in fetchAllSongRequests:", error);
    throw error;
  }
};

// Admin: update a song request's status (and optionally attach notes)
export const updateSongRequest = async (
  requestId: number,
  status: SongRequestStatus,
  notes?: string
): Promise<void> => {
  try {
    const { error } = await supabase.rpc("admin_update_song_request", {
      p_request_id: requestId,
      p_status: status,
      p_notes: notes ?? null,
    });

    if (error) {
      console.error("Error updating song request:", error.message);
      throw error;
    }
  } catch (error) {
    console.error("Error in updateSongRequest:", error);
    throw error;
  }
};

// Admin: permanently delete a song request
export const deleteSongRequest = async (requestId: number): Promise<void> => {
  try {
    const { error } = await supabase.rpc("admin_delete_song_request", {
      p_request_id: requestId,
    });

    if (error) {
      console.error("Error deleting song request:", error.message);
      throw error;
    }
  } catch (error) {
    console.error("Error in deleteSongRequest:", error);
    throw error;
  }
};

// User: edit and resubmit their own rejected song request
export const resubmitSongRequest = async (
  requestId: number,
  songName: string,
  artistName: string
): Promise<void> => {
  try {
    const { error } = await supabase.rpc("resubmit_song_request", {
      p_request_id: requestId,
      p_song_name: songName.trim(),
      p_artist_name: artistName.trim(),
    });

    if (error) {
      console.error("Error resubmitting song request:", error.message);
      throw error;
    }
  } catch (error) {
    console.error("Error in resubmitSongRequest:", error);
    throw error;
  }
};

