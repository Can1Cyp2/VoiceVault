// app/util/preferences.ts
//
// Device-local user preferences (AsyncStorage). These are UI/behaviour
// toggles that don't need to live on the backend. The "show recents on
// search" preference lives in recentlyViewed.ts for historical reasons and
// is re-exported here so all preference reads have a single import site.

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getSearchRecentsEnabled,
  setSearchRecentsEnabled,
} from "./recentlyViewed";
import {
  setCacheAutoClearInterval,
  DEFAULT_CACHE_AUTO_CLEAR_INTERVAL,
} from "./cacheManager";

// Re-export so all preference reads/writes have a single import site.
export { getSearchRecentsEnabled, setSearchRecentsEnabled };

const SONG_IMAGES_ENABLED_KEY = "voicevault:songImagesEnabled";
const SONG_IMAGE_SOURCE_KEY = "voicevault:songImageSource";
const VERIFIED_SONGS_ONLY_KEY = "voicevault:verifiedSongsOnly";

/**
 * Which catalog to pull song artwork from.
 * - "auto": try Apple Music (iTunes), then Deezer as a fallback (recommended)
 * - "itunes" / "deezer": force a single source
 */
export type SongImageSource = "auto" | "itunes" | "deezer";
export const SONG_IMAGE_SOURCES: SongImageSource[] = ["auto", "itunes", "deezer"];

export const SONG_IMAGE_SOURCE_LABELS: Record<SongImageSource, string> = {
  auto: "Automatic",
  itunes: "Apple Music",
  deezer: "Deezer",
};

// Generic boolean helpers with an explicit default when nothing is stored.
const getBool = async (key: string, defaultValue: boolean): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === "true";
  } catch (error) {
    console.error(`Failed to read preference ${key}:`, error);
    return defaultValue;
  }
};

const setBool = async (key: string, value: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value ? "true" : "false");
  } catch (error) {
    console.error(`Failed to save preference ${key}:`, error);
  }
};

/**
 * Whether to show album/song artwork (future feature). Defaults to on so
 * the feature is enabled by default once images ship, but the toggle lets
 * users opt out ahead of time.
 */
export const getSongImagesEnabled = (): Promise<boolean> =>
  getBool(SONG_IMAGES_ENABLED_KEY, true);

export const setSongImagesEnabled = (enabled: boolean): Promise<void> =>
  setBool(SONG_IMAGES_ENABLED_KEY, enabled);

/** Which artwork catalog to use. Defaults to "auto" (Apple Music then Deezer). */
export const getSongImageSource = async (): Promise<SongImageSource> => {
  try {
    const raw = await AsyncStorage.getItem(SONG_IMAGE_SOURCE_KEY);
    if (raw === "itunes" || raw === "deezer" || raw === "auto") return raw;
    return "auto";
  } catch (error) {
    console.error("Failed to read song image source preference:", error);
    return "auto";
  }
};

export const setSongImageSource = async (source: SongImageSource): Promise<void> => {
  try {
    await AsyncStorage.setItem(SONG_IMAGE_SOURCE_KEY, source);
  } catch (error) {
    console.error("Failed to save song image source preference:", error);
  }
};

/**
 * When true, search only shows admin-added ("verified") songs. Defaults to
 * false so users see the full community catalog unless they opt in.
 */
export const getVerifiedSongsOnly = (): Promise<boolean> =>
  getBool(VERIFIED_SONGS_ONLY_KEY, false);

export const setVerifiedSongsOnly = (enabled: boolean): Promise<void> =>
  setBool(VERIFIED_SONGS_ONLY_KEY, enabled);

/** A song is "verified" when it has no uploader username (added by an admin). */
export const isVerifiedSong = (song: { username?: string | null }): boolean =>
  !song?.username;

/** Default values for every preference, used by "Reset to default". */
export const PREFERENCE_DEFAULTS = {
  searchRecentsEnabled: true,
  songImagesEnabled: true,
  songImageSource: "auto" as SongImageSource,
  verifiedSongsOnly: false,
  cacheAutoClearInterval: DEFAULT_CACHE_AUTO_CLEAR_INTERVAL,
};

/**
 * Restore every preference to its default value. Note: this resets the
 * auto-clear *schedule*, it does not clear the cache itself - that's a
 * separate, explicit action (see cacheManager.clearAppCache).
 */
export const resetPreferencesToDefault = async (): Promise<void> => {
  await Promise.all([
    setSearchRecentsEnabled(PREFERENCE_DEFAULTS.searchRecentsEnabled),
    setSongImagesEnabled(PREFERENCE_DEFAULTS.songImagesEnabled),
    setSongImageSource(PREFERENCE_DEFAULTS.songImageSource),
    setVerifiedSongsOnly(PREFERENCE_DEFAULTS.verifiedSongsOnly),
    setCacheAutoClearInterval(PREFERENCE_DEFAULTS.cacheAutoClearInterval),
  ]);
};
