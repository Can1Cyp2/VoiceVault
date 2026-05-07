import { getNoteFrequency } from "../../util/pitchDetection";

export const SING_HOLD_DURATION_MS = 2000;
export const SING_MAX_RECORD_MS = 6000;
export const SING_TUNER_RANGE_CENTS = 60;
export const SING_PERFECT_CENTS = 5;
export const SING_CLOSE_CENTS = 25;
export const SING_COUNTABLE_CENTS = 50;

export type SingModalView = "intro" | "note" | "complete";
export type SingNoteStatus = "pending" | "recording" | "passed" | "failed";
export type SingPitchTone = "idle" | "perfect" | "close" | "off";

export type SingTestStepResult = {
  target: string;
  status: SingNoteStatus;
  heldMs: number;
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
