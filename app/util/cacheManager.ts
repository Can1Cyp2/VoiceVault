// app/util/cacheManager.ts
//
// Manages VoiceVault's local caches: the song artwork URL cache (see
// songImages.ts) and expo-image's own disk/memory cache of the actual image
// files. Supports an on-demand "Clear App Cache" action plus an optional
// automatic clear on a schedule, so the cache doesn't grow unbounded or
// serve stale artwork forever.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { clearSongImageCache } from "./songImages";

export type CacheAutoClearInterval = "never" | "weekly" | "monthly";

export const CACHE_AUTO_CLEAR_INTERVALS: CacheAutoClearInterval[] = [
  "never",
  "weekly",
  "monthly",
];

export const CACHE_AUTO_CLEAR_LABELS: Record<CacheAutoClearInterval, string> = {
  never: "Never",
  weekly: "Weekly",
  monthly: "Monthly",
};

// Monthly is the sensible default: long enough that the cache still saves
// almost all repeat lookups/network calls, short enough that stale or
// broken artwork URLs and unbounded disk usage don't linger indefinitely.
export const DEFAULT_CACHE_AUTO_CLEAR_INTERVAL: CacheAutoClearInterval = "monthly";

const INTERVAL_MS: Record<CacheAutoClearInterval, number | null> = {
  never: null,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

const AUTO_CLEAR_INTERVAL_KEY = "voicevault:cacheAutoClearInterval";
const LAST_CLEAR_AT_KEY = "voicevault:cacheLastClearedAt";

export const getCacheAutoClearInterval = async (): Promise<CacheAutoClearInterval> => {
  try {
    const raw = await AsyncStorage.getItem(AUTO_CLEAR_INTERVAL_KEY);
    if (raw === "never" || raw === "weekly" || raw === "monthly") return raw;
    return DEFAULT_CACHE_AUTO_CLEAR_INTERVAL;
  } catch (error) {
    console.error("Failed to read cache auto-clear preference:", error);
    return DEFAULT_CACHE_AUTO_CLEAR_INTERVAL;
  }
};

export const setCacheAutoClearInterval = async (
  interval: CacheAutoClearInterval
): Promise<void> => {
  try {
    await AsyncStorage.setItem(AUTO_CLEAR_INTERVAL_KEY, interval);
  } catch (error) {
    console.error("Failed to save cache auto-clear preference:", error);
  }
};

export const getLastCacheClearAt = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(LAST_CLEAR_AT_KEY);
    return raw ? Number(raw) : 0;
  } catch (error) {
    console.error("Failed to read last cache clear time:", error);
    return 0;
  }
};

const setLastCacheClearAt = async (timestamp: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_CLEAR_AT_KEY, String(timestamp));
  } catch (error) {
    console.error("Failed to save last cache clear time:", error);
  }
};

/**
 * Clears the song artwork URL cache and expo-image's own disk/memory cache
 * of downloaded image files, then records when this happened (which also
 * restarts the auto-clear countdown).
 */
export const clearAppCache = async (): Promise<void> => {
  await clearSongImageCache();
  try {
    await Image.clearDiskCache();
    await Image.clearMemoryCache();
  } catch (error) {
    // Not fatal - the URL cache above is the part that matters most.
    console.error("Failed to clear expo-image cache:", error);
  }
  await setLastCacheClearAt(Date.now());
};

/**
 * Call once per app launch. If the configured auto-clear interval has
 * elapsed since the last clear, silently clears the cache. Returns true
 * when it actually cleared, so callers can log/telemetry if useful.
 */
export const maybeAutoClearCache = async (): Promise<boolean> => {
  const interval = await getCacheAutoClearInterval();
  const intervalMs = INTERVAL_MS[interval];
  if (intervalMs === null) return false; // "never"

  const lastClearAt = await getLastCacheClearAt();
  if (lastClearAt === 0) {
    // First launch: nothing to clear yet, just start the countdown.
    await setLastCacheClearAt(Date.now());
    return false;
  }

  if (Date.now() - lastClearAt < intervalMs) return false;

  await clearAppCache();
  return true;
};
