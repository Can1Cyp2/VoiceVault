// app/util/songMetadata.ts
//
// Extra per-song facts that sit alongside the vocal range: tempo, tessitura,
// genre, length, release year and the explicit flag.
//
// These columns are populated in bulk by the RangeHarvester tools and are
// NULL for songs that haven't been enriched yet, so every field here is
// optional and the UI must stay correct when they are all missing.

import { supabase } from "./supabase";

export type SongMetadata = {
  bpm: number | null;
  /** Where the voice actually sits (25th/50th/75th percentile melody note). */
  tessituraLow: string | null;
  tessituraMedian: string | null;
  tessituraHigh: string | null;
  genre: string | null;
  durationSec: number | null;
  releaseYear: number | null;
  explicit: boolean | null;
  /**
   * ESTIMATED key, e.g. "F# minor". Which pitches the song is built from -
   * NOT where the melody sits (that's tessitura). Always presented as an
   * estimate: a key a singer transposes by had better be flagged if unsure.
   */
  songKey: string | null;
  /** 0-1 strength behind songKey; drives how much the UI hedges. */
  keyConfidence: number | null;
};

/** True when there is at least one fact worth showing. */
export const hasAnyMetadata = (m: SongMetadata | null): m is SongMetadata =>
  !!m &&
  (m.bpm !== null ||
    m.genre !== null ||
    m.durationSec !== null ||
    m.releaseYear !== null ||
    m.explicit === true ||
    m.songKey !== null ||
    m.tessituraMedian !== null);

/** True when a full low/median/high tessitura is available. */
export const hasTessitura = (m: SongMetadata | null): boolean =>
  !!m && !!m.tessituraLow && !!m.tessituraMedian && !!m.tessituraHigh;

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** Normalise a raw songs row (any shape) into SongMetadata. */
export const parseSongMetadata = (row: any): SongMetadata => ({
  bpm: toNumber(row?.bpm),
  tessituraLow: toText(row?.tessitura_low),
  tessituraMedian: toText(row?.tessitura_median),
  tessituraHigh: toText(row?.tessitura_high),
  genre: toText(row?.genre),
  durationSec: toNumber(row?.duration_sec),
  releaseYear: toNumber(row?.release_year),
  explicit: typeof row?.explicit === "boolean" ? row.explicit : null,
  songKey: toText(row?.song_key),
  keyConfidence: toNumber(row?.key_confidence),
});

/**
 * Look up metadata for one song. Returns null when the song isn't found, the
 * columns don't exist yet (migration not run), or the network call fails -
 * callers treat null as "just don't show the extra section".
 */
export const fetchSongMetadata = async (
  name: string,
  artist: string | null
): Promise<SongMetadata | null> => {
  if (!name) return null;

  try {
    let query = supabase
      .from("songs")
      .select(
        "bpm, tessitura_low, tessitura_median, tessitura_high, genre, duration_sec, release_year, explicit, song_key, key_confidence"
      )
      .eq("name", name);

    // Titles repeat across artists ("With You" exists many times over), so the
    // artist has to be part of the match or the wrong song's facts show up.
    query = artist ? query.eq("artist", artist) : query.is("artist", null);

    const { data, error } = await query.limit(1);

    if (error) {
      // Most likely cause: the metadata columns don't exist yet because the
      // migration hasn't been run. That's not an error worth surfacing - the
      // screen simply renders without the extra section.
      console.warn("fetchSongMetadata:", error.message);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : null;
    return row ? parseSongMetadata(row) : null;
  } catch (err) {
    console.warn("fetchSongMetadata failed:", err);
    return null;
  }
};

/** 235 -> "3:55". Null-safe. */
export const formatDuration = (seconds: number | null): string | null => {
  if (seconds === null || seconds <= 0) return null;
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/** 107.9 -> "108 BPM". Tempo is never meaningfully fractional to a singer. */
export const formatBpm = (bpm: number | null): string | null =>
  bpm === null || bpm <= 0 ? null : `${Math.round(bpm)} BPM`;

/**
 * Plain-language description of the tempo, so the number means something to
 * someone who doesn't read tempo markings.
 */
export const describeTempo = (bpm: number | null): string | null => {
  if (bpm === null || bpm <= 0) return null;
  if (bpm < 70) return "Slow";
  if (bpm < 100) return "Relaxed";
  if (bpm < 130) return "Moderate";
  if (bpm < 160) return "Upbeat";
  return "Fast";
};

/**
 * The relative major/minor - the key built on the same seven notes.
 * Worth surfacing because it is exactly the pair key detection most often
 * mixes up, so it is the most likely alternative if the estimate is off.
 */
export const relativeKey = (key: string | null): string | null => {
  if (!key) return null;
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const match = key.trim().match(/^([A-G]#?)\s+(major|minor)$/i);
  if (!match) return null;

  const index = names.indexOf(match[1]);
  if (index < 0) return null;

  return match[2].toLowerCase() === "major"
    ? `${names[(index + 9) % 12]} minor`
    : `${names[(index + 3) % 12]} major`;
};

/** Below this the estimate is worth an explicit "roughly" in the UI. */
export const KEY_HEDGE_THRESHOLD = 0.8;
