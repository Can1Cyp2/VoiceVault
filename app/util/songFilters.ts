// app/util/songFilters.ts
//
// Search result filters for the song list, configured from the filter
// popup on the Search screen. Persisted device-locally so the user's
// filter setup survives app restarts. The default (everything off) is
// the classic behaviour: randomized songs, nothing hidden.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { noteToValue, calculateOverallRange } from "./vocalRange";
import { TempoBand, TEMPO_BAND_RANGES, describeTempo } from "./songMetadata";

// Tempo bands reuse the exact boundaries from TEMPO_BAND_RANGES in
// songMetadata.ts, so a song filtered into "Upbeat" here is described as
// "Upbeat" on its own Song Details screen - the two can never drift apart.
export const TEMPO_BANDS: TempoBand[] = TEMPO_BAND_RANGES.map((r) => r.band);
export type { TempoBand };

// 1-minute buckets from under a minute through 10+, per the TODO spec.
export type LengthBucket =
  | "under1" | "1to2" | "2to3" | "3to4" | "4to5"
  | "5to6" | "6to7" | "7to8" | "8to9" | "9to10" | "10plus";
export const LENGTH_BUCKETS: { key: LengthBucket; label: string; minSec: number; maxSec: number | null }[] = [
  { key: "under1", label: "< 1 min", minSec: 0, maxSec: 60 },
  { key: "1to2", label: "1-2 min", minSec: 60, maxSec: 120 },
  { key: "2to3", label: "2-3 min", minSec: 120, maxSec: 180 },
  { key: "3to4", label: "3-4 min", minSec: 180, maxSec: 240 },
  { key: "4to5", label: "4-5 min", minSec: 240, maxSec: 300 },
  { key: "5to6", label: "5-6 min", minSec: 300, maxSec: 360 },
  { key: "6to7", label: "6-7 min", minSec: 360, maxSec: 420 },
  { key: "7to8", label: "7-8 min", minSec: 420, maxSec: 480 },
  { key: "8to9", label: "8-9 min", minSec: 480, maxSec: 540 },
  { key: "9to10", label: "9-10 min", minSec: 540, maxSec: 600 },
  { key: "10plus", label: "10+ min", minSec: 600, maxSec: null },
];

/**
 * Filters over the extra metadata columns (bpm, genre, release_year,
 * duration_sec, song_key, tessitura_*) added by
 * supabase/migrations/20260721_add_song_metadata.sql. Coverage is partial -
 * see hasBpm etc below - which is why "has this info at all" is its own
 * toggle, separate from narrowing to specific values.
 */
export type SongInfoFilters = {
  /** Only songs with a BPM value at all (~63% of the catalogue as of the
   *  2026-07-25 harvest - narrows results, on purpose, see the panel's
   *  disclaimer). */
  hasBpm: boolean;
  hasGenre: boolean;
  hasYear: boolean;
  hasLength: boolean;
  /** Only songs with an estimated key (~42% of the catalogue). Always an
   *  ESTIMATE - see keyConfidenceDetail in songMetadata.ts. */
  hasKey: boolean;
  hasTessitura: boolean;

  /** Specific genres to require, OR'd together. Empty = any (once hasGenre
   *  is on). Values come from the live distinct list in the songs table,
   *  never hardcoded - see fetchDistinctGenres in api.ts. */
  genres: string[];
  /** Specific estimated keys to require, OR'd together. Same sourcing as
   *  genres - see fetchDistinctKeys in api.ts. */
  keys: string[];
  /** Tempo bands to require, OR'd together - see TEMPO_BANDS. Ignored when
   *  an exact bpmMin/bpmMax is given, since a typed range is a more specific
   *  statement of intent than a preset band. */
  tempoBands: TempoBand[];
  /** Exact BPM bounds, inclusive. Empty string = unbounded on that side.
   *  Takes precedence over tempoBands when either is filled. */
  bpmMin: string;
  bpmMax: string;
  /** Length buckets to require, OR'd together - see LENGTH_BUCKETS. */
  lengthBuckets: LengthBucket[];
  /** Year range, inclusive. Empty string = unbounded on that side. */
  yearMin: string;
  yearMax: string;
};

export const DEFAULT_SONG_INFO_FILTERS: SongInfoFilters = {
  hasBpm: false,
  hasGenre: false,
  hasYear: false,
  hasLength: false,
  hasKey: false,
  hasTessitura: false,
  genres: [],
  keys: [],
  tempoBands: [],
  bpmMin: "",
  bpmMax: "",
  lengthBuckets: [],
  yearMin: "",
  yearMax: "",
};

/** True when the user has typed an exact BPM bound (which overrides bands). */
export const hasCustomBpmRange = (f: SongInfoFilters): boolean =>
  f.bpmMin.trim() !== "" || f.bpmMax.trim() !== "";

/** True when the song-info panel has anything switched on. */
export const hasActiveSongInfoFilters = (f: SongInfoFilters): boolean =>
  f.hasBpm ||
  f.hasGenre ||
  f.hasYear ||
  f.hasLength ||
  f.hasKey ||
  f.hasTessitura ||
  f.genres.length > 0 ||
  f.keys.length > 0 ||
  f.tempoBands.length > 0 ||
  f.bpmMin.trim() !== "" ||
  f.bpmMax.trim() !== "" ||
  f.lengthBuckets.length > 0 ||
  f.yearMin.trim() !== "" ||
  f.yearMax.trim() !== "";

/** How many song-info options are switched on, for the panel's own badge. */
export const countActiveSongInfoFilters = (f: SongInfoFilters): number =>
  [
    f.hasBpm,
    f.hasGenre,
    f.hasYear,
    f.hasLength,
    f.hasKey,
    f.hasTessitura,
    f.genres.length > 0,
    f.keys.length > 0,
    // Bands and an exact range are alternatives, so they count as one
    // "tempo narrowed" either way rather than double-counting.
    f.tempoBands.length > 0 || hasCustomBpmRange(f),
    f.lengthBuckets.length > 0,
    f.yearMin.trim() !== "",
    f.yearMax.trim() !== "",
  ].filter(Boolean).length;

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
  /** Filters over BPM/genre/year/length/key/tessitura - see SongInfoFilters. */
  songInfo: SongInfoFilters;
};

export const DEFAULT_SONG_FILTERS: SongFilters = {
  inRangeOnly: false,
  trendingFirst: false,
  verifiedOnly: false,
  userAddedOnly: false,
  customRangeEnabled: false,
  customRangeMin: "C2",
  customRangeMax: "C6",
  songInfo: DEFAULT_SONG_INFO_FILTERS,
};

const SONG_FILTERS_KEY = "voicevault:songFilters";

export const getSongFilters = async (): Promise<SongFilters> => {
  try {
    const raw = await AsyncStorage.getItem(SONG_FILTERS_KEY);
    if (!raw) return { ...DEFAULT_SONG_FILTERS };
    const parsed = JSON.parse(raw);
    // Merge over defaults so new filter fields added later get sane values.
    // songInfo is nested, so it needs its own merge or a filters blob saved
    // before it existed (or missing a field added to it later) would come
    // back with sub-fields silently undefined instead of falling back.
    return {
      ...DEFAULT_SONG_FILTERS,
      ...parsed,
      songInfo: { ...DEFAULT_SONG_INFO_FILTERS, ...(parsed?.songInfo ?? {}) },
    };
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

/** How many filters are switched on (drives the badge on the filter button).
 *  Includes the Song Info options, since those live inside the same popup. */
export const countActiveSongFilters = (filters: SongFilters): number =>
  [
    filters.inRangeOnly,
    filters.trendingFirst,
    filters.verifiedOnly,
    filters.userAddedOnly,
    filters.customRangeEnabled,
  ].filter(Boolean).length + countActiveSongInfoFilters(filters.songInfo);

/** Which half of the Search screen the filters are being applied to. */
export type SearchView = "songs" | "artists";

/**
 * Badge count for the current view: only the filters that actually narrow
 * the list being shown.
 *
 * An artist row is derived from its songs and carries only a name and the
 * vocal ranges of those songs (see searchArtistsByQuery in api.ts), so the
 * two range filters - In Range and Chosen Range - are the only ones with
 * anything to work on. Sorting, Song Type and Song Info describe individual
 * songs and have no meaning for an artist, so in the Artists view they stay
 * switched on but sit out until the user goes back to Songs; they are never
 * silently cleared.
 */
export const countActiveFiltersForView = (
  filters: SongFilters,
  view: SearchView
): number =>
  view === "songs"
    ? countActiveSongFilters(filters)
    : [filters.inRangeOnly, filters.customRangeEnabled].filter(Boolean).length;

/** How many switched-on filters are being ignored in the current view. */
export const countPausedFiltersForView = (
  filters: SongFilters,
  view: SearchView
): number =>
  countActiveSongFilters(filters) - countActiveFiltersForView(filters, view);

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

/**
 * Artist-level version of isSongWithinBounds: true when the artist's overall
 * range (lowest note across their songs to the highest) fits entirely inside
 * the chosen bounds. Matches how the Artist Details screen presents an
 * artist, so a "Chosen Range" filter and that screen always agree.
 */
export const isArtistWithinBounds = (
  artist: { songs?: { vocalRange: string }[] } | null | undefined,
  minNote: string,
  maxNote: string
): boolean => {
  const songs = artist?.songs;
  if (!songs || songs.length === 0) return false;

  const { lowestNote, highestNote } = calculateOverallRange(songs);
  return isSongWithinBounds(`${lowestNote} - ${highestNote}`, minNote, maxNote);
};

/**
 * True when a raw song row (as returned by `.from("songs").select("*")`,
 * snake_case columns) satisfies every active Song Info filter.
 *
 * Used for the text-search path (smartSearchSongs), which always fetches its
 * full candidate set before ranking/slicing client-side - so filtering here
 * is safe and cannot produce the "thin page" problem that random/trending
 * browsing has to guard against with real DB-side filters instead (see
 * applySongInfoDbFilters in api.ts).
 */
export const songMatchesSongInfoFilters = (song: any, f: SongInfoFilters): boolean => {
  if (f.hasBpm && !(typeof song?.bpm === "number" && song.bpm > 0)) return false;
  if (f.hasGenre && !song?.genre) return false;
  if (f.hasYear && !(typeof song?.release_year === "number")) return false;
  if (f.hasLength && !(typeof song?.duration_sec === "number" && song.duration_sec > 0)) return false;
  if (f.hasKey && !song?.song_key) return false;
  if (f.hasTessitura && !song?.tessitura_median) return false;

  if (f.genres.length > 0 && !f.genres.includes(song?.genre)) return false;
  if (f.keys.length > 0 && !f.keys.includes(song?.song_key)) return false;

  // An exact typed range wins over preset bands - see bpmMin's doc comment.
  if (hasCustomBpmRange(f)) {
    const bpm = song?.bpm;
    if (typeof bpm !== "number") return false;
    const min = f.bpmMin.trim() ? parseInt(f.bpmMin, 10) : null;
    const max = f.bpmMax.trim() ? parseInt(f.bpmMax, 10) : null;
    if (min !== null && !Number.isNaN(min) && bpm < min) return false;
    if (max !== null && !Number.isNaN(max) && bpm > max) return false;
  } else if (f.tempoBands.length > 0) {
    const band = describeTempo(typeof song?.bpm === "number" ? song.bpm : null);
    if (!band || !f.tempoBands.includes(band)) return false;
  }

  if (f.lengthBuckets.length > 0) {
    const sec = song?.duration_sec;
    if (typeof sec !== "number" || sec <= 0) return false;
    const matches = f.lengthBuckets.some((key) => {
      const bucket = LENGTH_BUCKETS.find((b) => b.key === key);
      return !!bucket && sec >= bucket.minSec && (bucket.maxSec === null || sec < bucket.maxSec);
    });
    if (!matches) return false;
  }

  const yearMin = f.yearMin.trim() ? parseInt(f.yearMin, 10) : null;
  const yearMax = f.yearMax.trim() ? parseInt(f.yearMax, 10) : null;
  if (yearMin !== null || yearMax !== null) {
    const year = song?.release_year;
    if (typeof year !== "number") return false;
    if (yearMin !== null && year < yearMin) return false;
    if (yearMax !== null && year > yearMax) return false;
  }

  return true;
};
