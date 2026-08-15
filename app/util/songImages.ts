// app/util/songImages.ts
//
// Fetches artwork for a specific SONG (not just an artist) from free music
// catalogs, with a fallback chain and a two-level cache.
//
// Legal note: we only ever store and hotlink the artwork *URL* returned by
// the provider - never re-host the image bytes. Both Apple Music (iTunes)
// and Deezer allow displaying their artwork alongside the track with
// attribution + a link back, which the UI provides.
//
// "Song image" vs "album image": we search by track, so a single with its
// own cover returns that single's art; songs that only exist on an album
// return the album cover (the closest thing to a per-song image that these
// catalogs expose).

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SongImageSource } from "./preferences";

export interface SongImage {
  imageUrl: string; // high-resolution artwork
  thumbUrl: string; // smaller artwork for list rows
  source: "itunes" | "deezer";
  attributionLabel: string; // e.g. "Apple Music"
  attributionUrl?: string; // link back to the track on the provider
}

const FETCH_TIMEOUT_MS = 8000;
const CACHE_STORAGE_KEY = "voicevault:songImageCache";
const CACHE_LIMIT = 300;

// Session cache: also holds negative (null) results so we don't re-hit the
// network for a song with no artwork while the app is open.
const memoryCache = new Map<string, SongImage | null>();

export const songImageCacheKey = (name: string, artist: string): string =>
  `${name.trim().toLowerCase()}::${artist.trim().toLowerCase()}`;

// --- string matching helpers -------------------------------------------------

const normalize = (value: string): string =>
  (value || "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "") // drop "(Remastered)", "[Live]", ...
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** True when two titles/artists are close enough to be the same thing. */
const looselyMatches = (a: string, b: string): boolean => {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
};

const fetchJsonWithTimeout = async (url: string): Promise<any | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    // Network error / timeout / abort - treated as "no image".
    return null;
  } finally {
    clearTimeout(timer);
  }
};

// --- providers ---------------------------------------------------------------

/**
 * Apple Music (iTunes Search API). No key required. Returns the specific
 * track's release artwork; artworkUrl100 is upgraded to 600x600.
 */
const fetchFromItunes = async (
  name: string,
  artist: string
): Promise<SongImage | null> => {
  const term = encodeURIComponent(`${name} ${artist}`.trim());
  const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=8`;
  const data = await fetchJsonWithTimeout(url);
  const results: any[] = data?.results ?? [];
  if (results.length === 0) return null;

  // Prefer a result whose track AND artist both match; else track match;
  // else the first result.
  const best =
    results.find(
      (r) =>
        looselyMatches(r.trackName ?? "", name) &&
        looselyMatches(r.artistName ?? "", artist)
    ) ||
    results.find((r) => looselyMatches(r.trackName ?? "", name)) ||
    results[0];

  const art100: string | undefined = best?.artworkUrl100;
  if (!art100) return null;

  return {
    imageUrl: art100.replace(/\/\d+x\d+bb\./, "/600x600bb."),
    thumbUrl: art100,
    source: "itunes",
    attributionLabel: "Apple Music",
    attributionUrl: best?.trackViewUrl,
  };
};

/**
 * Deezer search API. No key required. Uses the precise `track:"" artist:""`
 * query syntax and returns the track's album cover.
 */
const fetchFromDeezer = async (
  name: string,
  artist: string
): Promise<SongImage | null> => {
  const q = encodeURIComponent(`track:"${name}" artist:"${artist}"`);
  const url = `https://api.deezer.com/search?q=${q}&limit=8`;
  let data = await fetchJsonWithTimeout(url);

  // Fall back to a looser free-text query if the strict one finds nothing.
  if (!data?.data?.length) {
    const loose = encodeURIComponent(`${name} ${artist}`.trim());
    data = await fetchJsonWithTimeout(`https://api.deezer.com/search?q=${loose}&limit=8`);
  }

  const results: any[] = data?.data ?? [];
  if (results.length === 0) return null;

  const best =
    results.find(
      (r) =>
        looselyMatches(r.title ?? "", name) &&
        looselyMatches(r.artist?.name ?? "", artist)
    ) ||
    results.find((r) => looselyMatches(r.title ?? "", name)) ||
    results[0];

  const album = best?.album;
  const imageUrl: string | undefined =
    album?.cover_xl || album?.cover_big || album?.cover_medium;
  if (!imageUrl) return null;

  return {
    imageUrl,
    thumbUrl: album?.cover_medium || album?.cover_small || imageUrl,
    source: "deezer",
    attributionLabel: "Deezer",
    attributionUrl: best?.link,
  };
};

const PROVIDERS: Record<"itunes" | "deezer", typeof fetchFromItunes> = {
  itunes: fetchFromItunes,
  deezer: fetchFromDeezer,
};

const providerOrder = (source: SongImageSource): ("itunes" | "deezer")[] => {
  if (source === "itunes") return ["itunes"];
  if (source === "deezer") return ["deezer"];
  return ["itunes", "deezer"]; // auto
};

// --- persistent cache --------------------------------------------------------

const readPersistentCache = async (): Promise<Record<string, SongImage>> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writePersistentCacheEntry = async (
  key: string,
  image: SongImage
): Promise<void> => {
  try {
    const cache = await readPersistentCache();
    cache[key] = image;

    // Trim oldest-ish entries if we blow past the cap (insertion order).
    const keys = Object.keys(cache);
    if (keys.length > CACHE_LIMIT) {
      for (const staleKey of keys.slice(0, keys.length - CACHE_LIMIT)) {
        delete cache[staleKey];
      }
    }
    await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("Failed to cache song image:", error);
  }
};

/**
 * A snapshot of what's persisted on disk: every cached image record plus
 * the raw byte size of the URL cache itself (this JSON blob, not the image
 * files - those are measured separately via expo-image's cache).
 */
export const getSongImageCacheSnapshot = async (): Promise<{
  entries: SongImage[];
  rawCacheBytes: number;
}> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return { entries: [], rawCacheBytes: 0 };

    const parsed = JSON.parse(raw);
    const entries: SongImage[] =
      parsed && typeof parsed === "object" ? Object.values(parsed) : [];
    return { entries, rawCacheBytes: raw.length };
  } catch {
    return { entries: [], rawCacheBytes: 0 };
  }
};

export const clearSongImageCache = async (): Promise<void> => {
  memoryCache.clear();
  try {
    await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear song image cache:", error);
  }
};

// --- public API --------------------------------------------------------------

/**
 * Resolve artwork for a song. Returns null when nothing is found (the UI
 * then shows its generated placeholder). Results are cached in memory for
 * the session and on disk across sessions.
 */
export const fetchSongImage = async (
  name: string,
  artist: string,
  source: SongImageSource = "auto"
): Promise<SongImage | null> => {
  if (!name?.trim() || !artist?.trim()) return null;

  const key = songImageCacheKey(name, artist);

  if (memoryCache.has(key)) {
    return memoryCache.get(key) ?? null;
  }

  const persisted = await readPersistentCache();
  if (persisted[key]) {
    memoryCache.set(key, persisted[key]);
    return persisted[key];
  }

  for (const provider of providerOrder(source)) {
    const image = await PROVIDERS[provider](name, artist);
    if (image) {
      memoryCache.set(key, image);
      await writePersistentCacheEntry(key, image);
      return image;
    }
  }

  // Cache the miss for this session only (a later reopen can retry).
  memoryCache.set(key, null);
  return null;
};

/** Test-only: reset the in-memory session cache. */
export const __resetSongImageMemoryCache = (): void => {
  memoryCache.clear();
};
