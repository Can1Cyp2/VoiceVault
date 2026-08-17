// util/useSearch.ts
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import debounce from "lodash.debounce";
import Fuse from "fuse.js";
import {
  searchArtistsByQuery,
  getRandomSongs,
  getFilteredSongsPage,
  getTrendingSongs,
  smartSearchSongs,
} from "../util/api";
import { checkInternetConnection } from "../util/network";
import {
  getSongsByArtist,
  calculateOverallRange,
  noteToValue,
} from "./vocalRange";
import {
  SongInfoFilters,
  hasActiveSongInfoFilters,
  songMatchesSongInfoFilters,
} from "./songFilters";

// Cache for search results and artist data
const searchCache = new Map<string, any[]>();
const artistCache = new Map<
  string,
  { name: string; songs: { vocalRange: any }[]; songCount: number }
>();
const SONGS_PAGE_SIZE = 25;

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
  /** When true, browse (no query) results are ordered by recent search popularity. */
  trendingFirst?: boolean;
  /** Filters over BPM/genre/year/length/key/tessitura - see songFilters.ts. */
  songInfoFilters?: SongInfoFilters;
  /** Only admin-added songs. Passed in so it can be applied DB-side while
   *  browsing, which keeps pages full instead of hollowing them out after
   *  the fact. */
  verifiedOnly?: boolean;
}

export const useSearch = ({
  query,
  filter,
  vocalRange,
  initialFetchDone,
  setInitialFetchDone,
  trendingFirst = false,
  songInfoFilters,
  verifiedOnly = false,
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
  const loadingMoreRef = useRef(false);
  // How many browse songs are currently loaded, used as the pagination
  // offset. Kept in a ref because fetchResults reads it inside an async
  // closure, where `state` would be the value from when the call started.
  const currentSongCountRef = useRef(0);

  useEffect(() => {
    currentSongCountRef.current = state.allSongs.length;
  }, [state.allSongs.length]);

  // Browsing uses real pagination when narrowed by filters, and random
  // sampling otherwise. That distinction decides what a SHORT page means:
  // on the paginated path it truly is the end of the matching set, but on
  // the random path it only means that draw happened to miss, and there are
  // always more songs to draw. Treating the latter as "no more results" is
  // what previously froze infinite scroll and forced a manual refresh.
  const browseIsPaginated =
    (!!songInfoFilters && hasActiveSongInfoFilters(songInfoFilters)) || verifiedOnly;

  const computeHasMoreSongs = (fetched: any[], isBrowse: boolean): boolean =>
    isBrowse && !browseIsPaginated ? true : fetched.length >= SONGS_PAGE_SIZE;

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

  // Songs shown when there's no query: trending-first when that filter is
  // on (topped up with random songs so the list is always full), otherwise
  // the classic random selection.
  //
  // Song Info filters: get_trending_songs() has no filter parameters (it is
  // a fixed-shape SQL function), so a Song Info filter is applied to the
  // trending set CLIENT-SIDE instead - safe here because it returns full
  // song rows (SELECT s.*) and the set is small enough that filtering it in
  // place is cheap. The random top-up, however, goes through the real
  // DB-side filter in getRandomSongs, since sampling random ids and
  // filtering client-side would hit the same thin-page problem browsing
  // without Trending already has to guard against.
  //
  // `offset` matters only on the filtered path, which is the one that
  // paginates for real; the random paths ignore it because each draw is
  // independent.
  const fetchBrowseSongs = async (
    limitCount: number,
    offset: number = 0
  ): Promise<any[]> => {
    const narrowed =
      (songInfoFilters && hasActiveSongInfoFilters(songInfoFilters)) || verifiedOnly;

    // Filtered browsing uses REAL pagination rather than random sampling, so
    // scrolling reaches every matching song exactly once and a short page
    // truthfully means "that is all of them". See getFilteredSongsPage for
    // why random sampling cannot do that.
    if (narrowed) {
      return getFilteredSongsPage(limitCount, offset, songInfoFilters, { verifiedOnly });
    }

    if (!trendingFirst) return getRandomSongs(limitCount);

    const trending = await getTrendingSongs(limitCount);
    if (trending.length >= limitCount) return trending;

    const random = await getRandomSongs(limitCount);
    const seenIds = new Set(trending.map((song: any) => song.id));
    return [
      ...trending,
      ...random.filter((song: any) => !seenIds.has(song.id)),
    ].slice(0, limitCount);
  };

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

    // Batch fetch songs for all artists in parallel
    const fetchPromises = artistNames.map(async (name) => {
      if (artistCache.has(name)) {
        return artistCache.get(name);
      } else {
        const songs = await getSongsByArtist(name);
        const artistData = {
          name,
          songs: songs.map((song: any) => ({ vocalRange: song.vocalRange })),
          songCount: artistMap.get(name)!.songCount,
        };
        artistCache.set(name, artistData);
        return artistData;
      }
    });

    const results = await Promise.all(fetchPromises);
    artistDetails.push(...results);

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
    if (append && loadingMoreRef.current) return;
    if (query.trim() === "" && filter === "songs" && !append && pageNum > 1) {
      return;
    }

    setState((prev) => ({
      ...prev,
      songsLoading: filter === "songs" && pageNum === 1,
      artistsLoading: filter === "artists",
      error: null,
    }));
    if (append) {
      loadingMoreRef.current = true;
      setEndReachedLoading(true);
    }

    const connected = await checkInternetConnection();
    if (!connected) {
      setState((prev) => ({
        ...prev,
        error:
          "No internet connection. Please check your network and try again.",
        songsLoading: false,
        artistsLoading: false,
      }));
      loadingMoreRef.current = false;
      setEndReachedLoading(false);
      return;
    }

    // Song Info filters must be part of the cache key - otherwise toggling a
    // filter on the same query/page would silently reuse a cached response
    // fetched under different filters and show the wrong results.
    const filtersKey =
      songInfoFilters && hasActiveSongInfoFilters(songInfoFilters)
        ? JSON.stringify(songInfoFilters)
        : "";
    const cacheKey = `${filter}-${query}-${pageNum}-${filtersKey}`;
    if (searchCache.has(cacheKey) && !append) {
      const cachedResults = searchCache.get(cacheKey)!;
      setState((prev) => ({
        ...prev,
        results: cachedResults,
        allSongs: filter === "songs" ? cachedResults : prev.allSongs,
        allArtists: filter === "artists" ? cachedResults : prev.allArtists,
        hasMoreSongs:
          filter === "songs"
            ? cachedResults.length >= SONGS_PAGE_SIZE
            : prev.hasMoreSongs,
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
              hasMoreSongs: computeHasMoreSongs(prev.randomSongs, true),
              songsLoading: false,
            }));
            loadingMoreRef.current = false;
            setEndReachedLoading(false);
            return;
          }
          // Browse "load more". Offset from what is already loaded so the
          // filtered path continues where it left off rather than re-serving
          // page 1; the random path ignores it (see fetchBrowseSongs).
          newSongs = await fetchBrowseSongs(SONGS_PAGE_SIZE, currentSongCountRef.current);
        } else {
          newSongs = await smartSearchSongs(
            query.trim(),
            SONGS_PAGE_SIZE,
            (pageNum - 1) * SONGS_PAGE_SIZE,
            songInfoFilters
          );
        }

        if (append) {
          setState((prev) => {
            const existingIds = new Set(prev.allSongs.map((song) => song.id));
            const uniqueSongs = newSongs.filter(
              (song: any) => !existingIds.has(song.id)
            );

            return {
              ...prev,
              allSongs: [...prev.allSongs, ...uniqueSongs],
              results: [...prev.results, ...uniqueSongs],
              hasMoreSongs: computeHasMoreSongs(newSongs, query.trim() === ""),
            };
          });
        } else {
          setState((prev) => ({
            ...prev,
            allSongs: newSongs,
            results: newSongs,
            hasMoreSongs: computeHasMoreSongs(newSongs, query.trim() === ""),
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
      loadingMoreRef.current = false;
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
        const songs = await fetchBrowseSongs(SONGS_PAGE_SIZE);
        setState((prev) => ({
          ...prev,
          randomSongs: songs,
          allSongs: songs,
          results: songs,
          error: null,
          hasMoreSongs: computeHasMoreSongs(songs, true),
          songsLoading: false,
        }));
        setInitialFetchDone(true);

        // Fetch artists in background after showing songs
        deriveArtistsFromSongs(songs, 20).then((artists) => {
          setState((prev) => ({ ...prev, allArtists: artists }));
        }).catch((err) => {
          console.error("Error loading artists:", err);
        });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error:
            "Failed to load songs: " +
            (err instanceof Error ? err.message : "Unknown error"),
          songsLoading: false,
        }));
        setInitialFetchDone(true);
      }
    };

    if (!initialFetchDone) {
      fetchInitialData();
    }
  }, [initialFetchDone, setInitialFetchDone]);

  useEffect(() => {
    if (query.trim() === "") {
      setSongsPage(1);
      setArtistsPage(1);
      if (filter === "songs") {
        setState((prev) => ({ 
          ...prev, 
          results: prev.randomSongs,
          allSongs: prev.randomSongs,
          hasMoreSongs: computeHasMoreSongs(prev.randomSongs, true),
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
        songsLoading: filter === "songs",
        artistsLoading: filter === "artists",
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
      setSongsPage(1);
      setArtistsPage(1);
      if (filter === "songs") {
        let newSongs: any[] = [];
        if (query.trim() === "") {
          newSongs = await fetchBrowseSongs(SONGS_PAGE_SIZE);
          const artists = await deriveArtistsFromSongs(newSongs, 20, query);
          setState((prev) => ({
            ...prev,
            hasMoreSongs: computeHasMoreSongs(newSongs, true),
            randomSongs: newSongs,
            allSongs: newSongs,
            results: newSongs,
            allArtists: artists,
          }));
        } else {
          newSongs = await smartSearchSongs(query, SONGS_PAGE_SIZE, 0, songInfoFilters);
          const artists = await deriveArtistsFromSongs(newSongs, 20, query);
          setState((prev) => ({
            ...prev,
            hasMoreSongs: newSongs.length >= SONGS_PAGE_SIZE,
            allSongs: newSongs,
            results: newSongs,
            allArtists: artists,
          }));
        }
      } else {
        let artists: any[] = [];
        if (query.trim() === "") {
          const newRandomSongs = await getRandomSongs(SONGS_PAGE_SIZE);
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

  // Re-fetch the browse list when the trending ordering is toggled, so the
  // new ordering shows up without a manual pull-to-refresh. Skips the first
  // render (the initial fetch handles that).
  const trendingMountedRef = useRef(false);
  useEffect(() => {
    if (!trendingMountedRef.current) {
      trendingMountedRef.current = true;
      return;
    }
    if (query.trim() === "" && filter === "songs") {
      void handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendingFirst]);

  // Re-fetch (browsing or searching) whenever Song Info filters change, the
  // same way the trending toggle does above. Keyed on a JSON snapshot rather
  // than the object reference, since callers are not guaranteed to memoize
  // songInfoFilters and a new-but-equal object must not re-trigger a fetch.
  const songInfoFiltersKey = JSON.stringify(songInfoFilters ?? {});
  const songInfoMountedRef = useRef(false);
  useEffect(() => {
    if (!songInfoMountedRef.current) {
      songInfoMountedRef.current = true;
      return;
    }
    if (filter === "songs") {
      void handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songInfoFiltersKey]);

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
