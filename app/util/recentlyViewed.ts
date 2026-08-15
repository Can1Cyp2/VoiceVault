// app/util/recentlyViewed.ts
//
// Device-local log of the last songs and searches the user opened. Works for
// guests too - nothing is sent to the backend. This is also the first building
// block for offline caching (the same pattern can cache full song payloads
// later).

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RecentlyViewedSong {
  type?: "song";
  name: string;
  artist: string;
  vocalRange: string;
  username?: string;
  viewedAt: number;
}

export interface RecentSearchQuery {
  type: "query";
  query: string;
  filter: "songs" | "artists";
  searchedAt: number;
}

export type RecentHistoryItem = RecentlyViewedSong | RecentSearchQuery;

const STORAGE_KEY = "voicevault:recentlyViewedSongs";
const SEARCH_RECENTS_ENABLED_KEY = "voicevault:searchRecentsEnabled";
export const RECENTLY_VIEWED_LIMIT = 10;
export const RECENT_HISTORY_LIMIT = RECENTLY_VIEWED_LIMIT;

const normalizeQuery = (query: string): string => query.trim().replace(/\s+/g, " ");

export const isRecentSearchQuery = (
  item: RecentHistoryItem
): item is RecentSearchQuery => item.type === "query";

export const isRecentlyViewedSong = (
  item: RecentHistoryItem
): item is RecentlyViewedSong =>
  item.type !== "query" &&
  typeof item.name === "string" &&
  typeof item.artist === "string";

export const getRecentItemTimestamp = (item: RecentHistoryItem): number =>
  isRecentSearchQuery(item) ? item.searchedAt : item.viewedAt;

const normalizeStoredItem = (entry: any): RecentHistoryItem | null => {
  if (!entry || typeof entry !== "object") return null;

  if (entry.type === "query") {
    const query = typeof entry.query === "string" ? normalizeQuery(entry.query) : "";
    if (!query) return null;

    return {
      type: "query",
      query,
      filter: entry.filter === "artists" ? "artists" : "songs",
      searchedAt: typeof entry.searchedAt === "number" ? entry.searchedAt : Date.now(),
    };
  }

  if (typeof entry.name !== "string" || typeof entry.artist !== "string") {
    return null;
  }

  return {
    type: "song",
    name: entry.name,
    artist: entry.artist,
    vocalRange: typeof entry.vocalRange === "string" ? entry.vocalRange : "",
    username: typeof entry.username === "string" ? entry.username : undefined,
    viewedAt: typeof entry.viewedAt === "number" ? entry.viewedAt : Date.now(),
  };
};

const isSameRecentItem = (
  current: RecentHistoryItem,
  next: RecentHistoryItem
): boolean => {
  if (isRecentSearchQuery(current) && isRecentSearchQuery(next)) {
    return (
      normalizeQuery(current.query).toLowerCase() ===
        normalizeQuery(next.query).toLowerCase() && current.filter === next.filter
    );
  }

  if (isRecentlyViewedSong(current) && isRecentlyViewedSong(next)) {
    return (
      current.name.toLowerCase() === next.name.toLowerCase() &&
      current.artist.toLowerCase() === next.artist.toLowerCase()
    );
  }

  return false;
};

/**
 * Pure list update: newest first, deduplicated by name+artist, capped.
 * Exported separately so it can be unit tested without AsyncStorage.
 */
export const addToRecentlyViewed = (
  list: RecentlyViewedSong[],
  song: RecentlyViewedSong,
  limit: number = RECENTLY_VIEWED_LIMIT
): RecentlyViewedSong[] => {
  const withoutThisSong = list.filter(
    (entry) => !(entry.name === song.name && entry.artist === song.artist)
  );
  return [song, ...withoutThisSong].slice(0, limit);
};

/**
 * Pure mixed-history update: newest first, deduplicated per item type, capped.
 */
export const addToRecentHistory = (
  list: RecentHistoryItem[],
  item: RecentHistoryItem,
  limit: number = RECENT_HISTORY_LIMIT
): RecentHistoryItem[] => {
  const withoutThisItem = list.filter((entry) => !isSameRecentItem(entry, item));
  return [item, ...withoutThisItem].slice(0, limit);
};

export const getRecentHistoryItems = async (): Promise<RecentHistoryItem[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeStoredItem)
      .filter((entry): entry is RecentHistoryItem => !!entry)
      .sort((a, b) => getRecentItemTimestamp(b) - getRecentItemTimestamp(a))
      .slice(0, RECENT_HISTORY_LIMIT);
  } catch (error) {
    console.error("Failed to read recent history:", error);
    return [];
  }
};

export const getRecentlyViewedSongs = async (): Promise<RecentlyViewedSong[]> => {
  try {
    const history = await getRecentHistoryItems();
    return history.filter(isRecentlyViewedSong);
  } catch (error) {
    console.error("Failed to read recently viewed songs:", error);
    return [];
  }
};

export const logRecentlyViewedSong = async (
  song: Omit<RecentlyViewedSong, "viewedAt">
): Promise<void> => {
  if (!song?.name || !song?.artist) return;

  try {
    const current = await getRecentHistoryItems();
    const next = addToRecentHistory(current, {
      type: "song",
      ...song,
      viewedAt: Date.now(),
    });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    // Never let history logging break the details screen.
    console.error("Failed to log recently viewed song:", error);
  }
};

export const logRecentSearchQuery = async (
  query: string,
  filter: "songs" | "artists" = "songs"
): Promise<void> => {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return;

  try {
    const current = await getRecentHistoryItems();
    const next = addToRecentHistory(current, {
      type: "query",
      query: normalizedQuery,
      filter,
      searchedAt: Date.now(),
    });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    // Never let history logging break the search screen.
    console.error("Failed to log recent search:", error);
  }
};

/** Remove a single song or search query from the history. */
export const removeRecentHistoryItem = async (
  item: RecentHistoryItem
): Promise<void> => {
  try {
    const current = await getRecentHistoryItems();
    const next = current.filter((entry) => !isSameRecentItem(entry, item));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Failed to remove recent history item:", error);
  }
};

export const clearRecentHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear recent history:", error);
  }
};

export const clearRecentlyViewedSongs = clearRecentHistory;

export const getSearchRecentsEnabled = async (): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_RECENTS_ENABLED_KEY);
    return raw !== "false";
  } catch (error) {
    console.error("Failed to read recent-search setting:", error);
    return true;
  }
};

export const setSearchRecentsEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(SEARCH_RECENTS_ENABLED_KEY, enabled ? "true" : "false");
  } catch (error) {
    console.error("Failed to save recent-search setting:", error);
  }
};
