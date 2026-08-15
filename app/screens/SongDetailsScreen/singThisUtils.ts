import { getNoteFrequency } from "../../util/pitchDetection";

export const SING_HOLD_DURATION_MS = 2000;
export const SING_MAX_RECORD_MS = 6000;
export const SING_TUNER_RANGE_CENTS = 60;
export const SING_PERFECT_CENTS = 5;
export const SING_CLOSE_CENTS = 25;
export const SING_COUNTABLE_CENTS = 50;

// Octave-shifted matches: right pitch class, wrong octave (e.g. C4 for a C5
// target). We accept up to this many octaves away, with the residual cents
// held to the same countable tolerance as an exact match.
export const SING_MAX_OCTAVE_SHIFT = 3;

export type SingModalView = "intro" | "note" | "complete";
export type SingNoteStatus =
  | "pending"
  | "recording"
  | "passed"
  | "octave"
  | "failed";
export type SingPitchTone = "idle" | "perfect" | "close" | "off";

export type SingTestStepResult = {
  target: string;
  status: SingNoteStatus;
  heldMs: number;
  /** For "octave" results: octaves sung above (+) or below (-) the target. */
  octaveShift?: number;
};

export type SingOctaveMatch = {
  /** Whole octaves between sung pitch and target: + is higher, - is lower. */
  octaveShift: number;
  /** Cents off the octave-shifted target (already inside countable range). */
  residualCents: number;
};

export type SingPitchFeedback = {
  label: string;
  detail: string;
  tone: SingPitchTone;
};

const NOTE_PATTERN = /^([A-G]#?)(-?\d+)$/;

export const getTargetFrequency = (target: string): number | null => {
  const match = target.match(NOTE_PATTERN);
  if (!match) return null;

  const note = match[1];
  const octave = Number(match[2]);
  if (!Number.isFinite(octave)) return null;

  const frequency = getNoteFrequency(note, octave);
  return frequency > 0 ? frequency : null;
};

export const getCentsOffTarget = (
  frequency: number,
  targetFrequency: number | null
): number | null => {
  if (!targetFrequency || !frequency || frequency <= 0) return null;
  return Math.round(1200 * Math.log2(frequency / targetFrequency));
};

/**
 * When the pitch is roughly a whole number of octaves off the target and the
 * leftover cents sit inside the countable window, report it as an octave
 * match so we can suggest singing the song transposed.
 */
export const getOctaveMatch = (
  centsOff: number | null
): SingOctaveMatch | null => {
  if (centsOff === null) return null;

  const octaveShift = Math.round(centsOff / 1200);
  if (octaveShift === 0 || Math.abs(octaveShift) > SING_MAX_OCTAVE_SHIFT) {
    return null;
  }

  const residualCents = centsOff - octaveShift * 1200;
  if (Math.abs(residualCents) > SING_COUNTABLE_CENTS) return null;

  return { octaveShift, residualCents };
};

/** Move a note like "C#3" up or down whole octaves ("C#3" + 1 -> "C#4"). */
export const shiftNoteOctaves = (note: string, octaves: number): string => {
  const match = note.match(NOTE_PATTERN);
  if (!match) return note;
  return `${match[1]}${Number(match[2]) + octaves}`;
};

/** "an octave lower", "2 octaves higher" — for user-facing copy. */
export const describeOctaveShift = (octaveShift: number): string => {
  const magnitude = Math.abs(octaveShift);
  const direction = octaveShift > 0 ? "higher" : "lower";
  return magnitude === 1
    ? `an octave ${direction}`
    : `${magnitude} octaves ${direction}`;
};

/**
 * Message for the results view when the user matched every note's pitch but
 * some (or all) landed in a different octave. Null when nothing to say.
 */
export const getTransposedSummary = (
  stepResults: SingTestStepResult[]
): string | null => {
  if (stepResults.length === 0) return null;

  const allMatched = stepResults.every(
    (step) => step.status === "passed" || step.status === "octave"
  );
  const octaveSteps = stepResults.filter((step) => step.status === "octave");
  if (!allMatched || octaveSteps.length === 0) return null;

  const shifts = new Set(
    stepResults.map((step) =>
      step.status === "octave" ? step.octaveShift ?? 0 : 0
    )
  );

  if (shifts.size === 1) {
    const shift = octaveSteps[0].octaveShift ?? 0;
    const magnitude = Math.abs(shift);
    const octaveWord = magnitude === 1 ? "an octave" : `${magnitude} octaves`;
    const direction = shift > 0 ? "up" : "down";
    return (
      `You hit every note, just ${describeOctaveShift(shift)} than written. ` +
      `You can sing this song transposed ${direction} ${octaveWord} — the ` +
      `melody and key stay the same, just moved into your comfortable range.`
    );
  }

  return (
    "You matched every note's pitch, but in different octaves. The song " +
    "doesn't sit in your voice exactly as written — try shifting it toward " +
    "the octave that felt comfortable. A single transposition may not fit " +
    "every note, so adjust to taste."
  );
};

export const clampCents = (cents: number | null): number => {
  if (cents === null) return 0;
  return Math.max(
    -SING_TUNER_RANGE_CENTS,
    Math.min(SING_TUNER_RANGE_CENTS, cents)
  );
};

export const getSingPitchFeedback = (
  centsOff: number | null,
  isListening: boolean
): SingPitchFeedback => {
  if (!isListening && centsOff === null) {
    return {
      label: "Ready",
      detail: "Play the target note when recording starts.",
      tone: "idle",
    };
  }

  if (centsOff === null) {
    return {
      label: "Listening",
      detail: "Waiting for a clear pitch.",
      tone: "idle",
    };
  }

  const absCents = Math.abs(centsOff);
  if (absCents <= SING_PERFECT_CENTS) {
    return {
      label: "Perfect",
      detail: "Centered on the target.",
      tone: "perfect",
    };
  }

  const direction = centsOff < 0 ? "low" : "high";
  if (absCents <= SING_CLOSE_CENTS) {
    return {
      label: "Close",
      detail: `Slightly ${direction}. This still counts.`,
      tone: "close",
    };
  }

  if (absCents <= SING_COUNTABLE_CENTS) {
    return {
      label: "Close",
      detail: `A little ${direction}. This still counts.`,
      tone: "close",
    };
  }

  const octaveMatch = getOctaveMatch(centsOff);
  if (octaveMatch) {
    return {
      label: "Right note, different octave",
      detail: `You're singing ${describeOctaveShift(
        octaveMatch.octaveShift
      )}. Hold it to count as a transposed match.`,
      tone: "close",
    };
  }

  return {
    label: "Off",
    detail: centsOff < 0 ? "Too low." : "Too high.",
    tone: "off",
  };
};

export const isCloseEnoughToCount = (
  centsOff: number | null,
  detectedNote: string,
  targetNote: string
): boolean => {
  if (centsOff !== null) {
    return Math.abs(centsOff) <= SING_COUNTABLE_CENTS;
  }

  return detectedNote === targetNote;
};

export const formatHeldSeconds = (heldMs: number): string => {
  return (Math.min(heldMs, SING_HOLD_DURATION_MS) / 1000).toFixed(1);
};
