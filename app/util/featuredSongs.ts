// app/util/featuredSongs.ts
//
// The "Featured" recommendation engine: works out where a user's voice is
// most comfortable, scores songs against it, and explains every pick in
// plain language. Pure math - fetching candidates lives in
// featuredSongsApi.ts so this file stays easy to test.
//
// HOW THE USER'S TESSITURA IS ESTIMATED
// A song's tessitura in our data is the 25th-75th percentile of its melody
// notes (see supabase/migrations/20260721_add_song_metadata.sql) - the band
// the voice sustains, rather than the extremes it touches once. The singer
// side of the comparison needs the same thing: the band they can SUSTAIN,
// not just reach. Titze ("Quantifying Tessitura in a Song", Journal of
// Singing 2008) frames a singer's ideal tessitura as centred where they have
// the most dynamic control, which falls away towards both ends of the range.
// The top end falls away faster: the highest notes a user records in a range
// test are usually brief, often in head voice or falsetto, and not something
// they can sing phrase after phrase. So we trim the bottom 20% and the top
// 25% of the user's measured range, which puts the centre of the comfort
// zone slightly below the middle of their range, as pedagogy expects.
//
// The zone is never allowed to shrink below a perfect fifth (7 semitones):
// melodies need room to move, and narrower than that would reject songs a
// singer handles comfortably. Ranges narrower than a fifth have no extremes
// worth trimming, so the whole range is used and flagged as low-confidence.
//
// This is an ESTIMATE from two numbers. It is presented as one in the UI,
// and Featured is labelled beta for exactly this reason.

import { NOTES } from "./vocalRange";

/** Bottom share of the range trimmed off to estimate the comfort zone. */
export const TESSITURA_BOTTOM_TRIM = 0.2;
/** Top share trimmed off - larger, since top notes are the least sustainable. */
export const TESSITURA_TOP_TRIM = 0.25;
/** A perfect fifth: the narrowest comfort zone we will ever estimate. */
export const MIN_TESSITURA_SPAN = 7;
/** Songs this many semitones (in total) outside the range can still be suggested. */
export const MAX_STRETCH_SEMITONES = 2;
/** Share of a song's tessitura that must be in the zone to count as a tessitura match. */
export const TESSITURA_MATCH_THRESHOLD = 0.6;

const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

/**
 * Note name -> semitone index into NOTES, or -1. More forgiving than
 * noteToValue: accepts flats ("Bb3") and the unicode accidentals some
 * community uploads use, since those must not silently drop songs.
 */
export const parseNote = (raw: unknown): number => {
  if (typeof raw !== "string") return -1;
  const cleaned = raw.trim().replace(/♯/g, "#").replace(/♭/g, "b");
  const match = cleaned.match(/^([A-Ga-g])([#b]?)(-?\d)$/);
  if (!match) return -1;
  let pitch = match[1].toUpperCase() + match[2];
  pitch = FLAT_TO_SHARP[pitch] ?? pitch;
  // Cb / Fb / E# / B# would need an octave shift; the catalogue never uses
  // them, so treat them as unparseable rather than guess.
  return NOTES.indexOf(`${pitch}${match[3]}`);
};

const noteName = (value: number): string => NOTES[value] ?? "?";

/** "C3 - A4" (or with an en dash) -> [low, high] indices, or null. */
export const parseRange = (range: unknown): [number, number] | null => {
  if (typeof range !== "string") return null;
  const parts = range.split(/\s*[-–]\s+|\s+[-–]\s*/);
  if (parts.length !== 2) return null;
  const low = parseNote(parts[0]);
  const high = parseNote(parts[1]);
  if (low === -1 || high === -1 || high < low) return null;
  return [low, high];
};

export type VoiceProfile = {
  low: number;
  high: number;
  /** Estimated comfortable zone (inclusive). */
  tessLow: number;
  tessHigh: number;
  /** Middle of the comfortable zone - may be a half step, e.g. 52.5. */
  center: number;
  /** True when the range was too narrow to trim, so the zone is the whole range. */
  lowConfidence: boolean;
};

/**
 * Estimate where a user's voice sits most comfortably from their measured
 * range. Returns null for missing, unset ("C0") or unparseable ranges.
 */
export const estimateVoiceProfile = (
  minNote: string | null | undefined,
  maxNote: string | null | undefined
): VoiceProfile | null => {
  const low = parseNote(minNote);
  const high = parseNote(maxNote);
  // C0 is the app's "no range set" placeholder, never a real measurement.
  if (low <= 0 || high <= 0 || high <= low) return null;

  const span = high - low;
  if (span < MIN_TESSITURA_SPAN) {
    return { low, high, tessLow: low, tessHigh: high, center: (low + high) / 2, lowConfidence: true };
  }

  let tessLow = low + Math.round(span * TESSITURA_BOTTOM_TRIM);
  let tessHigh = high - Math.round(span * TESSITURA_TOP_TRIM);

  // Widen back out to a fifth if trimming left too little, keeping the zone
  // inside the measured range.
  while (tessHigh - tessLow < MIN_TESSITURA_SPAN) {
    if (tessLow > low) tessLow--;
    if (tessHigh - tessLow < MIN_TESSITURA_SPAN && tessHigh < high) tessHigh++;
  }

  return { low, high, tessLow, tessHigh, center: (tessLow + tessHigh) / 2, lowConfidence: false };
};

export const describeVoiceProfile = (profile: VoiceProfile) => ({
  range: `${noteName(profile.low)} to ${noteName(profile.high)}`,
  tessitura: `${noteName(profile.tessLow)} to ${noteName(profile.tessHigh)}`,
});

export type FeaturedCategory = "tessitura" | "range" | "stretch";

export type FeaturedReasonKind =
  | "sweet-spot"
  | "mostly-comfortable"
  | "centered"
  | "leans-low"
  | "leans-high"
  | "fits-range"
  | "headroom"
  | "uses-top"
  | "showcase"
  | "stretch"
  | "stretch-fix"
  | "brief-peak";

export type FeaturedReason = {
  kind: FeaturedReasonKind;
  title: string;
  detail: string;
};

/** A tap-to-reveal note pinned to one section of Song Details. */
export type FeaturedHighlight = {
  title: string;
  detail: string;
};

/** What travels to Song Details, so it can explain the pick in full. */
export type FeaturedInfo = {
  category: FeaturedCategory;
  summary: string;
  reasons: FeaturedReason[];
  userRange: string;
  userTessitura: string;
  /** Section-level notes: why the song's range and tessitura suit this voice. */
  highlights: {
    range: FeaturedHighlight;
    /** Only when the tessitura is part of why it was picked. */
    tessitura?: FeaturedHighlight;
  };
  /** The user's voice type (saved, or estimated from their range), for Best Fit. */
  userVoiceType?: string | null;
};

export type FeaturedSong = {
  song: any;
  score: number;
  info: FeaturedInfo;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const semis = (n: number) => plural(n, "semitone");

type SongTessitura = { t25: number; t50: number; t75: number };

/**
 * The song's stored 25/50/75 percentile notes, or null when missing or
 * inconsistent (out of order, or outside the song's own range - a sign the
 * enrichment matched the wrong song, which we must not reason from).
 */
const readSongTessitura = (song: any, low: number, high: number): SongTessitura | null => {
  const t25 = parseNote(song?.tessitura_low);
  const t50 = parseNote(song?.tessitura_median);
  const t75 = parseNote(song?.tessitura_high);
  if (t25 === -1 || t50 === -1 || t75 === -1) return null;
  if (!(t25 <= t50 && t50 <= t75)) return null;
  if (t25 < low || t75 > high) return null;
  return { t25, t50, t75 };
};

/** Share (0-1) of the song's 25-75% band that falls inside the comfort zone. */
export const tessituraOverlap = (t: SongTessitura, profile: VoiceProfile): number => {
  const width = t.t75 - t.t25;
  if (width === 0) return t.t25 >= profile.tessLow && t.t25 <= profile.tessHigh ? 1 : 0;
  const overlap = Math.min(t.t75, profile.tessHigh) - Math.max(t.t25, profile.tessLow);
  return Math.max(0, Math.min(1, overlap / width));
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Score one song for this voice and explain it. Returns null when the song
 * can't be judged or is more than MAX_STRETCH_SEMITONES outside the range.
 *
 * `jitter` (0-1) adds a little randomness so a refresh surfaces new songs
 * instead of the same top scorers every time; pass 0 for deterministic
 * results.
 */
export const scoreSong = (song: any, profile: VoiceProfile, jitter = 0): FeaturedSong | null => {
  const parsed = parseRange(song?.vocalRange);
  if (!parsed || !song?.name) return null;
  const [low, high] = parsed;

  const below = Math.max(0, profile.low - low);
  const above = Math.max(0, high - profile.high);
  const outBy = below + above;
  if (outBy > MAX_STRETCH_SEMITONES) return null;

  const tess = readSongTessitura(song, low, high);
  const overlap = tess ? tessituraOverlap(tess, profile) : 0;
  const headroom = profile.high - high;
  const footroom = low - profile.low;
  const userSpan = profile.high - profile.low;
  const songSpan = high - low;

  const category: FeaturedCategory =
    outBy > 0 ? "stretch" : tess && overlap >= TESSITURA_MATCH_THRESHOLD ? "tessitura" : "range";

  // --- Score (0-100ish) ---------------------------------------------------
  // Range fit is the gate, tessitura is what separates a song you CAN sing
  // from one that sits well. Each stretch semitone costs more than any
  // tessitura bonus can win back, so a fitting song always outranks a
  // stretch with similar tessitura.
  let score = outBy === 0 ? 50 : 50 - 15 * outBy;
  if (tess) {
    const halfZone = (profile.tessHigh - profile.tessLow) / 2;
    score += 30 * overlap;
    score += 15 * clamp01(1 - Math.abs(tess.t50 - profile.center) / (halfZone + 2));
  } else {
    // Without tessitura data the range midpoint is a weaker proxy, so it is
    // worth less.
    score += 10 * clamp01(1 - Math.abs((low + high) / 2 - profile.center) / Math.max(1, userSpan / 2));
  }
  if (outBy === 0) score += Math.min(headroom, 3) + Math.min(footroom, 3);
  score += 10 * clamp01(jitter);

  // --- Reasons ------------------------------------------------------------
  const reasons: FeaturedReason[] = [];
  const zoneText = `${noteName(profile.tessLow)} to ${noteName(profile.tessHigh)}`;
  const coreText = tess ? `${noteName(tess.t25)} to ${noteName(tess.t75)}` : "";

  if (tess) {
    if (overlap >= 1) {
      reasons.push({
        kind: "sweet-spot",
        title: "Sits in your sweet spot",
        detail:
          `The middle half of this song's melody (${coreText}), the notes you sing again and again, ` +
          `falls entirely inside your estimated comfortable zone of ${zoneText}. You'll spend the song ` +
          `where your voice is strongest instead of straining at the edges.`,
      });
    } else if (overlap >= TESSITURA_MATCH_THRESHOLD) {
      const side = tess.t75 > profile.tessHigh ? "just above" : "just below";
      reasons.push({
        kind: "mostly-comfortable",
        title: "Mostly in your comfort zone",
        detail:
          `${Math.round(overlap * 100)}% of the song's core singing area (${coreText}) sits inside your ` +
          `comfortable zone of ${zoneText}; the rest drifts ${side} it, so it feels natural with a few ` +
          `moments that ask a bit more.`,
      });
    }

    const offset = tess.t50 - profile.center;
    if (Math.abs(offset) <= 2) {
      reasons.push({
        kind: "centered",
        title: "Centred on your voice",
        detail:
          `The melody's centre note, ${noteName(tess.t50)}, is ` +
          (Math.abs(offset) < 1
            ? "right at the middle of your comfortable zone"
            : `within ${semis(Math.ceil(Math.abs(offset)))} of the middle of your comfortable zone`) +
          `, so it should feel balanced, neither pushed nor buried.`,
      });
    } else if (overlap >= TESSITURA_MATCH_THRESHOLD) {
      reasons.push(
        offset < 0
          ? {
              kind: "leans-low",
              title: "Uses the warmer, lower part of your voice",
              detail:
                `The melody centres on ${noteName(tess.t50)}, in the lower part of your comfort zone. ` +
                `Lower-lying songs tend to be easier on the voice and good for longer sessions.`,
            }
          : {
              kind: "leans-high",
              title: "Uses the brighter, upper part of your voice",
              detail:
                `The melody centres on ${noteName(tess.t50)}, in the upper part of your comfort zone. ` +
                `That's great for building strength and brightness without leaving the zone.`,
            }
      );
    }
  }

  if (outBy === 0) {
    reasons.push({
      kind: "fits-range",
      title: "Every note fits your range",
      detail:
        `The song runs from ${noteName(low)} to ${noteName(high)}, entirely inside your range of ` +
        `${noteName(profile.low)} to ${noteName(profile.high)}, with ${semis(footroom)} to spare at the ` +
        `bottom and ${semis(headroom)} at the top.`,
    });
    if (headroom >= 3) {
      reasons.push({
        kind: "headroom",
        title: "Plenty of headroom",
        detail:
          `Its highest note is ${semis(headroom)} below your top note, so the big moments won't push ` +
          `you to your limit. Your top notes are the hardest to sustain.`,
      });
    } else if (headroom === 0) {
      reasons.push({
        kind: "uses-top",
        title: "Reaches your top note",
        detail:
          `It touches ${noteName(high)}, your highest recorded note. Very singable, but warm up first ` +
          `so that note is there when you need it.`,
      });
    }
    if (userSpan > 0 && songSpan / userSpan >= 0.75) {
      reasons.push({
        kind: "showcase",
        title: "Shows off your range",
        detail:
          `It covers ${Math.round((songSpan / userSpan) * 100)}% of your range, so it's a great song for ` +
          `showing what your voice can do from top to bottom.`,
      });
    }
  } else {
    const highText = `${semis(above)} above your highest recorded note (${noteName(high)} vs your ${noteName(profile.high)})`;
    const lowText = `${semis(below)} below your lowest (${noteName(low)} vs your ${noteName(profile.low)})`;
    const where = above > 0 && below > 0 ? `${lowText} and ${highText}` : above > 0 ? highText : lowText;
    reasons.push({
      kind: "stretch",
      title: `A stretch goal: ${semis(outBy)} out of range`,
      detail:
        `This song goes ${where}. We include a few of ` +
        `these on purpose: the extreme notes of a song are usually brief, and most singers' ranges ` +
        `grow by a semitone or two with warm-ups and regular practice, which makes it a realistic ` +
        `next target.`,
    });
    if (songSpan <= userSpan) {
      const shift = above > 0 ? `down ${semis(above)}` : `up ${semis(below)}`;
      reasons.push({
        kind: "stretch-fix",
        title: "Or make it fit today",
        detail: `Transpose it ${shift} and every note lands inside your range.`,
      });
    }
    if (tess && overlap >= TESSITURA_MATCH_THRESHOLD) {
      reasons.push({
        kind: "brief-peak",
        title: "The hard part is brief",
        detail:
          `Most of the melody (${coreText}) still sits inside your comfortable zone of ${zoneText}, ` +
          `so only a few peak notes are a reach.`,
      });
    }
  }

  // --- Section highlights -------------------------------------------------
  // The same facts as the reasons above, regrouped by the part of Song
  // Details they sit beside: the vocal range header and the tessitura card.
  const reasonDetail = (kind: FeaturedReasonKind) => reasons.find((r) => r.kind === kind)?.detail;
  const range: FeaturedHighlight =
    outBy === 0
      ? { title: "Fits your range", detail: reasonDetail("fits-range")! }
      : {
          title: "Just outside your range",
          detail: [reasonDetail("stretch"), reasonDetail("stretch-fix")].filter(Boolean).join(" "),
        };

  let tessitura: FeaturedHighlight | undefined;
  if (tess && overlap >= TESSITURA_MATCH_THRESHOLD) {
    const share = overlap >= 1 ? "All" : `${Math.round(overlap * 100)}%`;
    const offset = tess.t50 - profile.center;
    const centre =
      Math.abs(offset) <= 2
        ? `Its centre note, ${noteName(tess.t50)}, sits near the middle of that zone.`
        : `Its centre note, ${noteName(tess.t50)}, sits in the ${offset < 0 ? "lower" : "upper"} part of that zone.`;
    tessitura = {
      title: "Sits where your voice is comfortable",
      detail:
        `This song's tessitura, where the melody spends most of its time, is ${coreText}. ` +
        `We compare it with your estimated comfortable zone of ${zoneText}, and ${share.toLowerCase()} ` +
        `of it is inside your zone. ${centre}`,
    };
  }

  return {
    song,
    score,
    info: {
      category,
      summary: summarize(category, { tess, overlap, outBy, above, headroom, songSpan, userSpan }),
      reasons,
      userRange: `${noteName(profile.low)} to ${noteName(profile.high)}`,
      userTessitura: `${noteName(profile.tessLow)} to ${noteName(profile.tessHigh)}`,
      highlights: { range, ...(tessitura && { tessitura }) },
    },
  };
};

/**
 * Best Fit Analysis labels a song with one male and one female voice type.
 * When either matches the user's voice type, explain it. A voice type can
 * be a blend ("Baritone / Tenor"), and any part of it counts as a match.
 */
export const voiceTypeHighlights = (
  userVoiceType: string | null | undefined,
  bestFit: { male: string; female: string }
): { male?: FeaturedHighlight; female?: FeaturedHighlight } => {
  if (!userVoiceType) return {};
  const parts = userVoiceType.split("/").map((p) => p.trim().toLowerCase());
  const explain = (type: string): FeaturedHighlight | undefined =>
    parts.includes(type.toLowerCase())
      ? {
          title: "Matches your voice type",
          detail:
            `This song's range fits the ${type} voice type best, and your voice type is ` +
            `${userVoiceType}. It's pitched for a voice like yours.`,
        }
      : undefined;
  const male = explain(bestFit.male);
  const female = explain(bestFit.female);
  return { ...(male && { male }), ...(female && { female }) };
};

/** The one-line "why" shown under the song in the Featured list. */
const summarize = (
  category: FeaturedCategory,
  s: {
    tess: SongTessitura | null;
    overlap: number;
    outBy: number;
    above: number;
    headroom: number;
    songSpan: number;
    userSpan: number;
  }
): string => {
  if (category === "stretch") {
    const where = s.above > 0 && s.above < s.outBy ? "outside" : s.above > 0 ? "above" : "below";
    return s.tess && s.overlap >= TESSITURA_MATCH_THRESHOLD
      ? `Mostly comfy, with peaks ${semis(s.outBy)} ${where} your range. A good stretch goal.`
      : `Just ${semis(s.outBy)} ${where} your range. A good stretch goal.`;
  }
  if (category === "tessitura" && s.tess) {
    return s.overlap >= 1
      ? `Most of the melody sits right in your comfortable zone.`
      : `${Math.round(s.overlap * 100)}% of the melody sits in your comfortable zone.`;
  }
  if (s.userSpan > 0 && s.songSpan / s.userSpan >= 0.75) {
    return "Uses most of your range, so it's a great showcase song.";
  }
  if (s.headroom >= 3) return `Fits your range with ${semis(s.headroom)} of headroom up top.`;
  return "Every note sits within your range.";
};

export type FeaturedSelectionOptions = {
  total?: number;
  /** How many tessitura picks to aim for before anything else. */
  tessituraTarget?: number;
  maxStretch?: number;
  maxPerArtist?: number;
  random?: () => number;
};

/**
 * Score every candidate and pick a balanced list: tessitura matches first
 * (the strongest signal), then songs that fit the range, then a few stretch
 * goals. Capped per artist so one prolific artist can't fill the list.
 * Returned in display order: tessitura, range, stretch; best first within each.
 */
export const selectFeaturedSongs = (
  candidates: any[],
  profile: VoiceProfile,
  {
    total = 15,
    tessituraTarget = 6,
    maxStretch = 3,
    maxPerArtist = 2,
    random = Math.random,
  }: FeaturedSelectionOptions = {}
): FeaturedSong[] => {
  const seen = new Set<string>();
  const scored: FeaturedSong[] = [];
  for (const song of candidates) {
    const key = `${String(song?.name ?? "").toLowerCase()}|${String(song?.artist ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    const result = scoreSong(song, profile, random());
    if (!result) continue;
    seen.add(key);
    scored.push(result);
  }
  scored.sort((a, b) => b.score - a.score);

  const picked: FeaturedSong[] = [];
  const perArtist = new Map<string, number>();
  const take = (pool: FeaturedSong[], limit: number) => {
    for (const item of pool) {
      if (picked.length >= total || limit <= 0) return;
      if (picked.includes(item)) continue;
      const artist = String(item.song.artist ?? "").toLowerCase();
      if ((perArtist.get(artist) ?? 0) >= maxPerArtist) continue;
      perArtist.set(artist, (perArtist.get(artist) ?? 0) + 1);
      picked.push(item);
      limit--;
    }
  };

  const byCategory = (c: FeaturedCategory) => scored.filter((s) => s.info.category === c);
  const stretchSlots = Math.min(maxStretch, byCategory("stretch").length);
  take(byCategory("tessitura"), tessituraTarget);
  take(byCategory("range"), total - picked.length - stretchSlots);
  take(byCategory("stretch"), stretchSlots);
  // Anything still free goes to the best remaining fits.
  take(scored.filter((s) => s.info.category !== "stretch"), total - picked.length);

  const order: Record<FeaturedCategory, number> = { tessitura: 0, range: 1, stretch: 2 };
  return picked.sort((a, b) => order[a.info.category] - order[b.info.category] || b.score - a.score);
};

/** Every note name inside the comfort zone - used to query tessitura matches DB-side. */
export const notesInZone = (profile: VoiceProfile): string[] =>
  NOTES.slice(profile.tessLow, profile.tessHigh + 1);
