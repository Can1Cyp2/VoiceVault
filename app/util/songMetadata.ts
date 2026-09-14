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
  /** 0-1 synthesized confidence behind songKey; see keyConfidenceTier below -
   *  this alone is NOT comparable across songs, since it blends differently-
   *  scaled source metrics. Source agreement is the trustworthy signal. */
  keyConfidence: number | null;
  /** How many independent sources (AcousticBrainz / our tab-detection /
   *  Musicnotes) were checked for this song's key. Null = pre-2026-07-26
   *  data, treated the same as 1 (single source, nothing to cross-check). */
  keySourcesChecked: number | null;
  /** How many of keySourcesChecked landed on the exact songKey stored.
   *  agree < checked means sources genuinely disagreed. */
  keySourcesAgree: number | null;
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
  keySourcesChecked: toNumber(row?.key_sources_checked),
  keySourcesAgree: toNumber(row?.key_sources_agree),
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
        "bpm, tessitura_low, tessitura_median, tessitura_high, genre, duration_sec, release_year, explicit, song_key, key_confidence, key_sources_checked, key_sources_agree"
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

export type TempoBand = "Slow" | "Relaxed" | "Moderate" | "Upbeat" | "Fast";

/**
 * Single source of truth for tempo band boundaries. describeTempo() below
 * and the Song Info search filters (songFilters.ts / api.ts) both derive
 * from this list, so a song can never land in "Upbeat" on one screen and a
 * different band on another - the numbers only exist in one place.
 * maxBpm is exclusive; null means unbounded (Fast has no ceiling).
 */
export const TEMPO_BAND_RANGES: { band: TempoBand; minBpm: number; maxBpm: number | null }[] = [
  { band: "Slow", minBpm: 0, maxBpm: 70 },
  { band: "Relaxed", minBpm: 70, maxBpm: 100 },
  { band: "Moderate", minBpm: 100, maxBpm: 130 },
  { band: "Upbeat", minBpm: 130, maxBpm: 160 },
  { band: "Fast", minBpm: 160, maxBpm: null },
];

/**
 * "under 70" / "70-99" / "160+" for a band, derived from TEMPO_BAND_RANGES so
 * the numbers shown in the UI can never disagree with the numbers actually
 * filtered on. maxBpm is exclusive, hence the -1 on the upper label.
 */
export const formatTempoBandRange = (band: TempoBand): string => {
  const r = TEMPO_BAND_RANGES.find((x) => x.band === band);
  if (!r) return "";
  if (r.maxBpm === null) return `${r.minBpm}+`;
  if (r.minBpm === 0) return `under ${r.maxBpm}`;
  return `${r.minBpm}-${r.maxBpm - 1}`;
};

/**
 * Plain-language description of the tempo, so the number means something to
 * someone who doesn't read tempo markings.
 */
export const describeTempo = (bpm: number | null): TempoBand | null => {
  if (bpm === null || bpm <= 0) return null;
  const match = TEMPO_BAND_RANGES.find(
    (r) => bpm >= r.minBpm && (r.maxBpm === null || bpm < r.maxBpm)
  );
  return match?.band ?? null;
};

/**
 * One or two sentences of practical advice per tempo band, instead of one
 * sentence reused for every song regardless of how fast it actually is.
 */
export const tempoBlurb = (bpm: number | null): string | null => {
  const word = describeTempo(bpm);
  if (!word) return null;
  switch (word) {
    case "Slow":
      return "Slow tempo - there's time to shape each phrase, which makes this a good one for warm-ups or breath control work.";
    case "Relaxed":
      return "Relaxed tempo, comfortable for working through tricky lines without feeling rushed.";
    case "Moderate":
      return "Moderate tempo - a steady, comfortable pace for most practice runs.";
    case "Upbeat":
      return "Upbeat tempo. Set your metronome to this before practicing so you can keep pace with the recording.";
    case "Fast":
      return "Fast tempo - worth practicing slower first, then building back up to speed with a metronome.";
    default:
      return null;
  }
};

/**
 * How much to trust the estimated key, based on whether independent sources
 * agreed - not on any single source's own confidence number, which isn't
 * comparable across sources (see songKey doc comment above).
 *
 *   agreed   - 2+ independent sources landed on the exact same key
 *   single   - only one source had an answer, nothing to cross-check it with
 *   disputed - 2+ sources were checked and they did NOT all agree; the
 *              stored key only won a tiebreak, not a consensus
 */
export type KeyConfidenceTier = "agreed" | "single" | "disputed";

export const keyConfidenceTier = (
  checked: number | null,
  agree: number | null
): KeyConfidenceTier => {
  if (checked !== null && checked >= 2) {
    return agree === checked ? "agreed" : "disputed";
  }
  return "single";
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

/** 0.919 -> 92. The number shown on the tappable confidence marker. */
export const keyConfidencePercent = (confidence: number | null): number | null =>
  confidence === null ? null : Math.round(confidence * 100);

/**
 * Traditional mood/character associated with each key, independent of major
 * vs minor's general bright/dark split. Rooted in the old "key character"
 * tradition (writers like Schubart catalogued a distinct feeling for every
 * key as far back as the 1700s) and the looser associations that persist in
 * modern musical culture (D minor as "the saddest of all keys" is a familiar
 * bit precisely because the idea is widely shared).
 *
 * Stored as a two-adjective phrase ("open and joyful") rather than a full
 * verdict on the song, because a key's traditional mood and how a specific
 * RECORDING actually feels are not the same thing - a slow piano ballad in a
 * "traditionally joyful" key does not sound joyful (this was tested against
 * Adele's "Someone Like You", A major, and flatly did not fit as a bare
 * statement). keyEmotionalCharacter below composes this with the song's
 * actual tempo specifically so the text stays honest about an individual
 * recording instead of just restating key theory as if it were a fact.
 */
const KEY_CHARACTER: Record<string, string> = {
  "C major": "plain and bright",
  "C minor": "tragic and restless",
  "C# major": "warm and hazy",
  "C# minor": "uneasy and yearning",
  "D major": "bright and confident",
  "D minor": "serious and grave",
  "D# major": "uplifting and glowing",
  "D# minor": "dark and suspenseful",
  "E major": "clear and inspired",
  "E minor": "reflective and gentle",
  "F major": "calm and warm",
  "F minor": "mournful and heavy",
  "F# major": "soft and dreamlike",
  "F# minor": "moody and intense",
  "G major": "easygoing and friendly",
  "G minor": "restless and dramatic",
  "G# major": "gentle and intimate",
  "G# minor": "heavy and grave",
  "A major": "open and joyful",
  "A minor": "tender and reflective",
  "A# major": "graceful and warm",
  "A# minor": "dark and weighty",
  "B major": "bright and uplifting",
  "B minor": "dark and melancholic",
};

/**
 * A qualifying clause added ONLY when the song's actual tempo pulls against
 * what the key's traditional character would suggest - a bright major key
 * played slow, or a dark minor key played fast. When tempo and key already
 * point the same way (or the tempo is Moderate, which does not push either
 * direction), nothing is added: the plain key-character statement already
 * describes the song fine, and saying so again in different words is just
 * noise. This is deliberately conditional rather than always appending a
 * tempo remark - see keyEmotionalCharacter.
 *
 * Takes the formatted BPM ("67 BPM") so the clause names the song's actual
 * tempo rather than just the band it falls into - "this song's slow 67 BPM"
 * is a concrete, checkable claim; "this slow tempo" is not.
 */
const TEMPO_DIVERGENCE_CLAUSE: Partial<Record<TempoBand, (bpmText: string) => string>> = {
  Slow: (bpmText) =>
    `but at this slow ${bpmText}, it likely feels quieter and restrained, closer to reflection than an outward display of it`,
  Relaxed: (bpmText) =>
    `but at this relaxed ${bpmText}, it likely feels settled and easygoing rather than intense`,
  Upbeat: (bpmText) =>
    `but at this song's upbeat ${bpmText}, it likely feels more driven than heavy`,
  Fast: (bpmText) =>
    `but at this song's fast ${bpmText}, it likely feels intense rather than weighed down`,
};

/**
 * The traditional emotional character of a key. States the plain, "normal"
 * character first, and appends a tempo-based correction ONLY when the
 * song's actual BPM would genuinely change how that character reads - a
 * slow recording undercutting a "joyful" major key, or a fast one lifting a
 * "heavy" minor key. See the note on KEY_CHARACTER for why the correction
 * exists at all: a key's traditional mood and how a specific recording
 * feels are not the same thing.
 *
 * This is the text shown INLINE under the key on Song Details - the
 * tap-to-expand marker (keyConfidenceDetail) already covers confidence and
 * methodology, so this deliberately stays on mood rather than repeating
 * that. Falls back to the bare statement when there is no BPM to check
 * against (roughly 37% of songs with a key, as of the 2026-07-25 harvest).
 */
export const keyEmotionalCharacter = (
  key: string | null,
  bpm: number | null
): string | null => {
  if (!key) return null;
  const match = key.trim().match(/^([A-G]#?)\s+(major|minor)$/i);
  if (!match) return null;
  const normalizedKey = `${match[1].toUpperCase()} ${match[2].toLowerCase()}`;
  const isMajor = match[2].toLowerCase() === "major";
  const character = KEY_CHARACTER[normalizedKey];
  if (!character) return null;

  const article = /^[aeiou]/i.test(character) ? "an" : "a";
  const normal = `${normalizedKey} is normally associated with ${article} ${character} feel.`;

  const band = describeTempo(bpm);
  const isSubduedTempo = band === "Slow" || band === "Relaxed";
  const isEnergeticTempo = band === "Upbeat" || band === "Fast";
  // A bright (major) key undercut by a subdued tempo, or a dark (minor) key
  // lifted by an energetic one, is a real mismatch worth flagging. Anything
  // else (matching valence, or a Moderate/unknown tempo) is left alone.
  const diverges = (isMajor && isSubduedTempo) || (!isMajor && isEnergeticTempo);

  if (diverges && band) {
    // formatBpm already handles null/zero; bpmText is only ever null here if
    // bpm itself somehow disagreed with the band derived from it two lines
    // up, which should not happen, but the check avoids a broken sentence if
    // it ever did.
    const bpmText = formatBpm(bpm);
    const clauseFn = TEMPO_DIVERGENCE_CLAUSE[band];
    if (clauseFn && bpmText) {
      return `${normalizedKey} is normally associated with ${article} ${character} feel, ${clauseFn(bpmText)}.`;
    }
  }

  return normal;
};

/**
 * The full explanation shown when the confidence marker is tapped: what the
 * percentage actually means, how the key was arrived at, and what else it
 * could be. Longer than the inline line by design.
 */
export const keyConfidenceDetail = (
  key: string | null,
  confidence: number | null,
  checked: number | null,
  agree: number | null
): string | null => {
  if (!key) return null;
  const relKey = relativeKey(key);
  const pct = keyConfidencePercent(confidence);
  const tier = keyConfidenceTier(checked, agree);
  const heading = pct === null ? `${key}.` : `${key}, ${pct}% confidence.`;
  const alternative = relKey
    ? `\n\nThe most likely alternative is ${relKey}. It contains the same seven notes as ${key}, which is what makes the two easy to mistake for each other. If the key sounds wrong when you play along, that is the one to try.`
    : "";

  if (tier === "agreed") {
    const n = agree ?? 2;
    return (
      `${heading}\n\nThis key was identified independently by ${n} separate methods, ` +
      `all of them reached the same answer.${alternative}`
    );
  }

  if (tier === "disputed") {
    return (
      `${heading}\n\nMore than one method analyzed this song and they did not agree. ` +
      `${key} was the strongest key match, but with low confidence.${alternative}`
    );
  }

  return (
    `${heading}\n\nThis comes from a single analysis of the song's notes, so it is ` +
    `an educated estimate rather than a confirmed fact. ${alternative}`
  );
};
