// app/util/transposeSuggestion.ts
//
// Pure math for the "transpose this song to fit your range" suggestion
// shown on the song details screen. No backend involved.

import { NOTES, noteToValue } from "./vocalRange";

export type TransposeSuggestion =
  | { type: "fits" } // song already sits fully inside the user's range
  | { type: "transpose"; semitones: number } // positive = up, negative = down
  | { type: "impossible"; extraSemitonesNeeded: number }; // song span wider than user's

/**
 * Work out the smallest transposition (in semitones) that moves a song's
 * range fully inside the user's range, or report that none exists.
 *
 * Returns null when either range can't be parsed.
 */
export const getTransposeSuggestion = (
  songRange: string,
  userMinNote: string,
  userMaxNote: string
): TransposeSuggestion | null => {
  if (!songRange) return null;

  const [songMinNote, songMaxNote] = songRange
    .split(/ - | – /)
    .map((note) => note?.trim());
  if (!songMinNote || !songMaxNote) return null;

  const songMin = noteToValue(songMinNote);
  const songMax = noteToValue(songMaxNote);
  const userMin = noteToValue(userMinNote);
  const userMax = noteToValue(userMaxNote);

  if (songMin === -1 || songMax === -1 || userMin === -1 || userMax === -1) {
    return null;
  }

  const songSpan = songMax - songMin;
  const userSpan = userMax - userMin;
  if (songSpan < 0 || userSpan < 0) return null;

  // A song wider than the user's whole range can never fit, in any key.
  if (songSpan > userSpan) {
    return { type: "impossible", extraSemitonesNeeded: songSpan - userSpan };
  }

  // Smallest shift that pulls the song inside the user's range.
  let semitones = 0;
  if (songMin < userMin) {
    semitones = userMin - songMin; // too low -> shift up
  } else if (songMax > userMax) {
    semitones = userMax - songMax; // too high -> shift down (negative)
  }

  if (semitones === 0) return { type: "fits" };
  return { type: "transpose", semitones };
};

export type OctaveShiftSuggestion = {
  /** Whole octaves to move the song: negative = down, positive = up. */
  octaves: number;
  /** The song's range after the shift, e.g. "C3 - G4". */
  newRange: string;
};

/**
 * Check whether moving the whole song down or up one or two octaves lands it
 * inside the user's range. Octave shifts are special: the key and chords
 * stay the same, so a singer can just sing in their own octave — no
 * re-arranging needed. Prefers the smallest shift, trying down before up.
 *
 * Returns null when no octave shift fits (or either range can't be parsed).
 */
export const getOctaveShiftSuggestion = (
  songRange: string,
  userMinNote: string,
  userMaxNote: string
): OctaveShiftSuggestion | null => {
  if (!songRange) return null;

  const [songMinNote, songMaxNote] = songRange
    .split(/ - | – /)
    .map((note) => note?.trim());
  if (!songMinNote || !songMaxNote) return null;

  const songMin = noteToValue(songMinNote);
  const songMax = noteToValue(songMaxNote);
  const userMin = noteToValue(userMinNote);
  const userMax = noteToValue(userMaxNote);

  if (songMin === -1 || songMax === -1 || userMin === -1 || userMax === -1) {
    return null;
  }

  for (const octaves of [-1, 1, -2, 2]) {
    const shiftedMin = songMin + octaves * 12;
    const shiftedMax = songMax + octaves * 12;

    if (
      shiftedMin >= userMin &&
      shiftedMax <= userMax &&
      NOTES[shiftedMin] &&
      NOTES[shiftedMax]
    ) {
      return {
        octaves,
        newRange: `${NOTES[shiftedMin]} - ${NOTES[shiftedMax]}`,
      };
    }
  }

  return null;
};

/** Human-readable message for an octave suggestion, or null when none fits. */
export const formatOctaveSuggestion = (
  suggestion: OctaveShiftSuggestion | null
): string | null => {
  if (!suggestion) return null;

  const magnitude = Math.abs(suggestion.octaves);
  const octaveWord = magnitude === 1 ? "an octave" : `${magnitude} octaves`;
  const direction = suggestion.octaves < 0 ? "down" : "up";

  return (
    `You could sing this song ${octaveWord} ${direction} (${suggestion.newRange}) — ` +
    `it fits your range that way, and the key stays the same, so no ` +
    `re-arranging is needed.`
  );
};

/** Human-readable message for a suggestion, or null when nothing needs saying. */
export const formatTransposeSuggestion = (
  suggestion: TransposeSuggestion | null
): string | null => {
  if (!suggestion || suggestion.type === "fits") return null;

  if (suggestion.type === "impossible") {
    const extra = suggestion.extraSemitonesNeeded;
    return `This song spans ${extra} semitone${extra !== 1 ? "s" : ""} more than your range, so no key change fits it fully.`;
  }

  const direction = suggestion.semitones > 0 ? "up" : "down";
  const amount = Math.abs(suggestion.semitones);
  return `Transpose ${direction} ${amount} semitone${amount !== 1 ? "s" : ""} and this song fits your range.`;
};
