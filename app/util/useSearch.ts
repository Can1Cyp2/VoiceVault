// util/useSearch.ts
import { useState, useEffect, useMemo, useCallback } from "react";
import debounce from "lodash.debounce";
import Fuse from "fuse.js";
import {
  searchArtistsByQuery,
  getRandomSongs,
  smartSearchSongs,
} from "../util/api";
import { checkInternetConnection } from "../util/network";
import {
  getSongsByArtist,
  calculateOverallRange,
  noteToValue,
} from "./vocalRange";

// Cache for search results and artist data
const searchCache = new Map<string, any[]>();
const artistCache = new Map<
  string,
  { name: string; songs: { vocalRange: any }[]; songCount: number }
>();

interface SearchState {
  results: any[];
  songsLoading: boolean;
  artistsLoading: boolean;
  error: string | null;
  allSongs: any[];
  allArtists: any[];
  randomSongs: any[];
  hasMoreSongs: boolean;
}

interface UseSearchProps {
  query: string;
  filter: "songs" | "artists";
  vocalRange: { min_range: string; max_range: string } | null;
  initialFetchDone: boolean;
  setInitialFetchDone: (done: boolean) => void;
}

export const useSearch = ({
  query,
  filter,
  vocalRange,
  initialFetchDone,
  setInitialFetchDone,
}: UseSearchProps) => {
  const [state, setState] = useState<SearchState>({
    results: [],
    songsLoading: true,
    artistsLoading: false,
    error: null,
    allSongs: [],
    allArtists: [],
    randomSongs: [],
    hasMoreSongs: true,
  });

  const [songsPage, setSongsPage] = useState(1);
  const [artistsPage, setArtistsPage] = useState(1);
  const [hasMoreArtists, setHasMoreArtists] = useState(true);
  const [endReachedLoading, setEndReachedLoading] = useState(false);

  // Memoize range checking functions
  const isSongInRange = useCallback(
    (songRange: string) => {
      if (!vocalRange || typeof songRange !== "string") return false;
      const [songMin, songMax] = songRange
        .split(" - ")
        .map((note) => note.trim());
      if (!songMin || !songMax) return false;

      const songMinVal = noteToValue(songMin);
      const songMaxVal = noteToValue(songMax);
      const userMinVal = noteToValue(vocalRange.min_range);
      const userMaxVal = noteToValue(vocalRange.max_range);

      if (songMinVal === -1 || songMaxVal === -1) return false;

      return songMinVal >= userMinVal && songMaxVal <= userMaxVal;
    },
    [vocalRange]
  );

  const getRangeOverlapScore = (
    userMin: number,
    userMax: number,
    songMin: number,
    songMax: number
  ) => {
    const overlap = Math.min(userMax, songMax) - Math.max(userMin, songMin);
    return overlap >= 0 ? overlap : -1;
  };

  const isArtistInRange = useCallback(
    (artist: { name: string; songs: { vocalRange: string }[] }) => {
      if (!vocalRange || !artist.songs || artist.songs.length === 0)
        return false;
      const { lowestNote, highestNote } = calculateOverallRange(artist.songs);
      const artistMinIndex = noteToValue(lowestNote);
      const artistMaxIndex = noteToValue(highestNote);
      const userMinIndex = noteToValue(vocalRange.min_range);
      const userMaxIndex = noteToValue(vocalRange.max_range);
      if (
        isNaN(artistMinIndex) ||
        isNaN(artistMaxIndex) ||
        isNaN(userMinIndex) ||
        isNaN(userMaxIndex)
      ) {
        return false;
      }
      return artistMinIndex >= userMinIndex && artistMaxIndex <= userMaxIndex;
    },
    [vocalRange]
  );

  // Optimize artist derivation with batch fetching and caching
  const deriveArtistsFromSongs = async (
    songs: any[],
    limit: number = 20,
    query: string = ""
  ): Promise<any[]> => {
    if (!songs || songs.length === 0) return [];

    const artistMap = new Map<string, { name: string; songCount: number }>();
    songs.forEach((song) => {
      if (!song.artist) return;
      const current = artistMap.get(song.artist) || {
        name: song.artist,
        songCount: 0,
      };
      artistMap.set(song.artist, {
        ...current,
        songCount: current.songCount + 1,
      });
    });

    const artistNames = Array.from(artistMap.keys());
    const artistDetails: any[] = [];

    // Batch fetch songs for all artists in one query
    for (const name of artistNames) {
      if (artistCache.has(name)) {
        artistDetails.push(artistCache.get(name));
      } else {
        const songs = await getSongsByArtist(name);
        const artistData = {
          name,
          songs: songs.map((song: any) => ({ vocalRange: song.vocalRange })),
          songCount: artistMap.get(name)!.songCount,
        };
        artistCache.set(name, artistData);
        artistDetails.push(artistData);
      }
    }

    // Fuzzy search for query matching
    let filteredArtists = artistDetails.filter(
      (artist) => artist.songs.length > 0
    );
    if (query) {
      const fuse = new Fuse(filteredArtists, {
        keys: ["name"],
        threshold: 0.3,
        includeScore: true,
      });
      filteredArtists = fuse
        .search(query)
        .sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity))
        .map((result) => result.item);
    } else {
      filteredArtists.sort(
        (a, b) => b.songCount - a.songCount || a.name.localeCompare(b.name)
      );
    }

    return filteredArtists.slice(0, limit);
  };

  const fetchResults = async (pageNum = 1, append = false) => {
    if (endReachedLoading) return;
    if (query.trim() === "" && filter === "songs" && !append && pageNum > 1) {
      return;
    }

    setState((prev) => ({
      ...prev,
      songsLoading: filter === "songs" && pageNum === 1,
      artistsLoading: filter === "artists",
      error: null,
    }));
    if (pageNum > 1) setEndReachedLoading(true);

    const connected = await checkInternetConnection();
    if (!connected) {
      setState((prev) => ({
        ...prev,
        error:
          "No internet connection. Please check your network and try again.",
        songsLoading: false,
        artistsLoading: false,
      }));
      setEndReachedLoading(false);
      return;
    }

    const cacheKey = `${filter}-${query}-${pageNum}`;
    if (searchCache.has(cacheKey) && !append) {
      setState((prev) => ({
        ...prev,
        results: searchCache.get(cacheKey)!,
        songsLoading: false,
        artistsLoading: false,
      }));
      setEndReachedLoading(false);
      return;
    }

    try {
      setState((prev) => ({ ...prev, error: null }));
      if (filter === "songs") {
        let newSongs: any[] = [];
        if (query.trim() === "") {
          if (!append) {
            setState((prev) => ({
              ...prev,
              allSongs: prev.randomSongs,
              results: prev.randomSongs,
              songsLoading: false,
            }));
            setEndReachedLoading(false);
            return;
          }
          newSongs = await getRandomSongs(25);
          setState((prev) => ({
            ...prev,
            hasMoreSongs: newSongs.length >= 25,
          }));
        } else {
          newSongs = await smartSearchSongs(query.trim());
          setState((prev) => ({ ...prev, hasMoreSongs: false }));
        }

        if (append) {
          const uniqueSongs = newSongs.filter(
            (song: any) => !state.allSongs.some((s) => s.id === song.id)
          );
          setState((prev) => ({
            ...prev,
            allSongs: [...prev.allSongs, ...uniqueSongs],
            results: [...prev.results, ...uniqueSongs],
          }));
        } else {
          setState((prev) => ({
            ...prev,
            allSongs: newSongs,
            results: newSongs,
          }));
        }

        const artists = await deriveArtistsFromSongs(
          newSongs,
          20,
          query.trim()
        );
        setState((prev) => ({ ...prev, allArtists: artists }));
        searchCache.set(cacheKey, newSongs);
      } else {
        let artists: any[] = [];
        if (query.trim() === "") {
          artists = await searchArtistsByQuery(query.trim(), 20 * pageNum);
          setState((prev) => ({
            ...prev,
            hasMoreArtists: artists.length >= 20 * pageNum,
          }));
        } else {
          artists = await searchArtistsByQuery(query, 20 * pageNum);
          setState((prev) => ({
            ...prev,
            hasMoreArtists: artists.length >= 20 * pageNum,
          }));
        }
        setState((prev) => ({
          ...prev,
          results: append ? [...prev.results, ...artists] : artists,
          allArtists: append ? [...prev.allArtists, ...artists] : artists,
        }));
        searchCache.set(cacheKey, artists);
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: `Unable to load ${filter}. Please try again later.`,
      }));
    } finally {
      setState((prev) => ({
        ...prev,
        songsLoading: false,
        artistsLoading: false,
      }));
      setEndReachedLoading(false);
    }
  };

  // Debounce the fetchResults call
  const debouncedFetchResults = useMemo(
    () =>
      debounce((pageNum: number, append: boolean) => {
        fetchResults(pageNum, append);
      }, 300),
    [filter, query, vocalRange]
  );

  useEffect(() => {
    const fetchInitialData = async () => {
      if (state.randomSongs.length > 0) return;

      const connected = await checkInternetConnection();
      if (!connected) {
        setState((prev) => ({
          ...prev,
          error:
            "No internet connection. Please check your network and try again.",
          songsLoading: false,
        }));
        setInitialFetchDone(true);
        return;
      }

      try {
        const songs = await getRandomSongs(25);
        setState((prev) => ({
          ...prev,
          randomSongs: songs,
          allSongs: songs,
          results: songs,
          error: null,
        }));

        const artists = await deriveArtistsFromSongs(songs, 20);
        setState((prev) => ({ ...prev, allArtists: artists }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error:
            "Failed to load songs: " +
            (err instanceof Error ? err.message : "Unknown error"),
        }));
      } finally {
        setState((prev) => ({ ...prev, songsLoading: false }));
        setInitialFetchDone(true);
      }
    };

    if (!initialFetchDone) {
      fetchInitialData();
    }
  }, [initialFetchDone, setInitialFetchDone]);

  useEffect(() => {
    if (query.trim() === "") {
      if (filter === "songs") {
        setState((prev) => ({ 
          ...prev, 
          results: prev.randomSongs,
          allSongs: prev.randomSongs 
        }));
      } else {
        setState((prev) => ({ ...prev, results: prev.allArtists }));
      }
    } else {
      setSongsPage(1);
      setArtistsPage(1);
      setState((prev) => ({
        ...prev,
        results: [],
        hasMoreSongs: true,
        hasMoreArtists: true,
      }));
      debouncedFetchResults(1, false);
    }
    return () => debouncedFetchResults.cancel();
  }, [query, filter, debouncedFetchResults]);

  const handleRefresh = async () => {
    setState((prev) => ({
      ...prev,
      songsLoading: filter === "songs",
      artistsLoading: filter === "artists",
      error: null,
    }));
    try {
      if (filter === "songs") {
        let newSongs: any[] = [];
        if (query.trim() === "") {
          newSongs = await getRandomSongs(25);
          const artists = await deriveArtistsFromSongs(newSongs, 20, query);
          setState((prev) => ({
            ...prev,
            hasMoreSongs: newSongs.length >= 25,
            randomSongs: newSongs,
            allSongs: newSongs,
            results: newSongs,
            allArtists: artists,
          }));
        } else {
          newSongs = await smartSearchSongs(query);
          const artists = await deriveArtistsFromSongs(newSongs, 20, query);
          setState((prev) => ({
            ...prev,
            hasMoreSongs: false,
            allSongs: newSongs,
            results: newSongs,
            allArtists: artists,
          }));
        }
      } else {
        let artists: any[] = [];
        if (query.trim() === "") {
          const newRandomSongs = await getRandomSongs(25);
          artists = await deriveArtistsFromSongs(newRandomSongs, 20);
          setState((prev) => ({
            ...prev,
            randomSongs: newRandomSongs,
            allArtists: artists,
            results: artists,
          }));
        } else {
          artists = await searchArtistsByQuery(query, 20);
          setState((prev) => ({
            ...prev,
            results: artists,
            allArtists: artists,
          }));
        }
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error:
          "An error occurred while loading new content: " +
          (err instanceof Error ? err.message : "Unknown error"),
      }));
    } finally {
      setState((prev) => ({
        ...prev,
        songsLoading: false,
        artistsLoading: false,
      }));
    }
  };

  const handleLoadMore = () => {
    if (filter === "songs" && state.hasMoreSongs && !endReachedLoading) {
      setSongsPage((prev) => {
        const nextPage = prev + 1;
        fetchResults(nextPage, true);
        return nextPage;
      });
    } else if (filter === "artists" && hasMoreArtists && !endReachedLoading) {
      setArtistsPage((prev) => {
        const nextPage = prev + 1;
        fetchResults(nextPage, true);
        return nextPage;
      });
    }
  };

  return {
    ...state,
    songsPage,
    artistsPage,
    hasMoreArtists,
    endReachedLoading,
    isSongInRange,
    isArtistInRange,
    handleRefresh,
    handleLoadMore,
    handleRetry: () => {
      setState((prev) => ({ ...prev, error: null, results: [] }));
      setSongsPage(1);
      setArtistsPage(1);
      setState((prev) => ({
        ...prev,
        hasMoreSongs: true,
        hasMoreArtists: true,
      }));
      fetchResults(1, false);
    },
  };
};
