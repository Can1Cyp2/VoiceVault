// app/util/recentlyViewed.ts
//
// Device-local log of the last songs the user opened, shown on the Home
// screen. Works for guests too - nothing is sent to the backend. This is
// also the first building block for offline caching (the same pattern can
// cache full song payloads later).

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RecentlyViewedSong {
  name: string;
  artist: string;
  vocalRange: string;
  username?: string;
  viewedAt: number;
}

const STORAGE_KEY = "voicevault:recentlyViewedSongs";
export const RECENTLY_VIEWED_LIMIT = 10;

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

export const getRecentlyViewedSongs = async (): Promise<RecentlyViewedSong[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry) => entry && typeof entry.name === "string" && typeof entry.artist === "string"
    );
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
    const current = await getRecentlyViewedSongs();
    const next = addToRecentlyViewed(current, { ...song, viewedAt: Date.now() });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    // Never let history logging break the details screen.
    console.error("Failed to log recently viewed song:", error);
  }
};

export const clearRecentlyViewedSongs = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear recently viewed songs:", error);
  }
};
