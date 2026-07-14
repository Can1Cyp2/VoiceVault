// app/util/songFilters.ts
//
// Search result filters for the song list, configured from the filter
// popup on the Search screen. Persisted device-locally so the user's
// filter setup survives app restarts. The default (everything off) is
// the classic behaviour: randomized songs, nothing hidden.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { noteToValue } from "./vocalRange";

export type SongFilters = {
  /** Only songs fully inside the signed-in user's vocal range. */
  inRangeOnly: boolean;
  /** Order browse results by recent search popularity instead of randomly. */
  trendingFirst: boolean;
  /** Only admin-added (verified) songs. Mutually exclusive with userAddedOnly. */
  verifiedOnly: boolean;
  /** Only community-added songs. Mutually exclusive with verifiedOnly. */
  userAddedOnly: boolean;
  /** Only songs whose range fits inside a chosen note range. */
  customRangeEnabled: boolean;
  customRangeMin: string;
  customRangeMax: string;
};

export const DEFAULT_SONG_FILTERS: SongFilters = {
  inRangeOnly: false,
  trendingFirst: false,
  verifiedOnly: false,
  userAddedOnly: false,
  customRangeEnabled: false,
  customRangeMin: "C2",
  customRangeMax: "C6",
};

const SONG_FILTERS_KEY = "voicevault:songFilters";

export const getSongFilters = async (): Promise<SongFilters> => {
  try {
    const raw = await AsyncStorage.getItem(SONG_FILTERS_KEY);
    if (!raw) return { ...DEFAULT_SONG_FILTERS };
    const parsed = JSON.parse(raw);
    // Merge over defaults so new filter fields added later get sane values.
    return { ...DEFAULT_SONG_FILTERS, ...parsed };
  } catch (error) {
    console.error("Failed to read song filters:", error);
    return { ...DEFAULT_SONG_FILTERS };
  }
};

export const saveSongFilters = async (filters: SongFilters): Promise<void> => {
  try {
    await AsyncStorage.setItem(SONG_FILTERS_KEY, JSON.stringify(filters));
  } catch (error) {
    console.error("Failed to save song filters:", error);
  }
};

/** How many filters are switched on (drives the badge on the filter button). */
export const countActiveSongFilters = (filters: SongFilters): number =>
  [
    filters.inRangeOnly,
    filters.trendingFirst,
    filters.verifiedOnly,
    filters.userAddedOnly,
    filters.customRangeEnabled,
  ].filter(Boolean).length;

/**
 * True when the song's range (e.g. "C3 - A4") fits entirely inside the
 * chosen [minNote, maxNote] bounds. Unparseable ranges never match.
 */
export const isSongWithinBounds = (
  songRange: unknown,
  minNote: string,
  maxNote: string
): boolean => {
  if (typeof songRange !== "string") return false;
  const [songMin, songMax] = songRange.split(" - ").map((note) => note.trim());
  if (!songMin || !songMax) return false;

  const songMinVal = noteToValue(songMin);
  const songMaxVal = noteToValue(songMax);
  const minVal = noteToValue(minNote);
  const maxVal = noteToValue(maxNote);
  if (songMinVal === -1 || songMaxVal === -1 || minVal === -1 || maxVal === -1) {
    return false;
  }

  return songMinVal >= minVal && songMaxVal <= maxVal;
};
