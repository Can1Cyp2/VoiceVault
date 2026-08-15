/**
 * Tests for app/util/audioAnalysis.ts
 *
 * Covers the vocal range detection pipeline: turning a stream of pitch
 * samples into a detected lowest/highest note, validating detected ranges,
 * and classifying voice type from a range.
 *
 * Sample timing reference (samples arrive every ~150ms):
 *   - a note must be held >= 13 consecutive samples (~2s) to count
 *   - a note needs >= 27 total counted samples (~4s) to be valid
 */

jest.mock("../../app/util/supabase", () =>
  require("../helpers/supabaseMock").createSupabaseModuleMock()
);
jest.mock("expo-av", () => ({
  Audio: { requestPermissionsAsync: jest.fn() },
}));
jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
}));
jest.mock("../../app/util/pitchDebug", () => ({
  addPitchDebugEvent: jest.fn(),
}));

import {
  analyzeVocalRange,
  validateRange,
  calculateRangeStats,
} from "../../app/util/audioAnalysis";
import { singNotes } from "../helpers/factories";

const E2 = { note: "E", octave: 2, frequency: 82.41 };
const C4 = { note: "C", octave: 4, frequency: 261.63 };
const C5 = { note: "C", octave: 5, frequency: 523.25 };

describe("analyzeVocalRange", () => {
  it("returns null when there are too few samples", () => {
    const samples = singNotes({ ...E2, count: 9 });
    expect(analyzeVocalRange(samples, "lowest")).toBeNull();
  });

  it("detects a note sustained long enough", () => {
    const samples = singNotes({ ...E2, count: 35 });
    const result = analyzeVocalRange(samples, "lowest");

    expect(result).not.toBeNull();
    expect(result!.note).toBe("E2");
    expect(result!.frequency).toBeCloseTo(82.41, 2);
  });

  it("scales confidence with hold duration (35 of 50 samples = 0.7)", () => {
    const samples = singNotes({ ...E2, count: 35 });
    expect(analyzeVocalRange(samples, "lowest")!.confidence).toBeCloseTo(0.7, 5);
  });

  it("caps confidence at 1.0 for very long holds", () => {
    const samples = singNotes({ ...E2, count: 80 });
    expect(analyzeVocalRange(samples, "lowest")!.confidence).toBe(1.0);
  });

  it("rejects notes only sung in short bursts (under 2s consecutive)", () => {
    // 12-sample bursts are each just below the 13-sample consecutive minimum.
    const samples = singNotes(
      { ...E2, count: 12 },
      { ...C4, count: 12 },
      { ...E2, count: 12 },
      { ...C4, count: 12 }
    );
    expect(analyzeVocalRange(samples, "lowest")).toBeNull();
  });

  it("sums multiple long holds of the same note toward the 4s total", () => {
    // Two valid holds (13 + 14 = 27 samples) separated by another note.
    const samples = singNotes(
      { ...E2, count: 13 },
      { ...C4, count: 20 },
      { ...E2, count: 14 }
    );
    const result = analyzeVocalRange(samples, "lowest");

    expect(result).not.toBeNull();
    expect(result!.note).toBe("E2");
  });

  it("rejects a note one sample short of the 4s total", () => {
    const samples = singNotes(
      { ...E2, count: 13 },
      { ...C4, count: 5 }, // too short to count at all
      { ...E2, count: 13 } // 13 + 13 = 26 < 27
    );
    expect(analyzeVocalRange(samples, "lowest")).toBeNull();
  });

  it("picks the lowest valid note in 'lowest' mode and the highest in 'highest' mode", () => {
    const samples = singNotes({ ...E2, count: 35 }, { ...C5, count: 35 });

    expect(analyzeVocalRange(samples, "lowest")!.note).toBe("E2");
    expect(analyzeVocalRange(samples, "highest")!.note).toBe("C5");
  });
});

describe("validateRange", () => {
  it("accepts a range of at least one octave", () => {
    expect(validateRange("C3", "C4")).toBe(true); // exactly 12 semitones
    expect(validateRange("E2", "A4")).toBe(true);
  });

  it("rejects ranges narrower than one octave", () => {
    expect(validateRange("C3", "B3")).toBe(false); // 11 semitones
    expect(validateRange("C3", "C3")).toBe(false);
  });

  it("rejects ranges wider than five octaves", () => {
    expect(validateRange("C0", "C7")).toBe(false); // 84 semitones
  });

  it("rejects inverted ranges", () => {
    expect(validateRange("C5", "C4")).toBe(false);
  });

  it("rejects unknown notes", () => {
    expect(validateRange("X1", "C4")).toBe(false);
    expect(validateRange("C3", "not-a-note")).toBe(false);
  });
});

describe("calculateRangeStats", () => {
  it("computes semitones and octaves", () => {
    const stats = calculateRangeStats("C3", "D4"); // 14 semitones

    expect(stats.semitones).toBe(14);
    expect(stats.octaves).toBe(1);
    expect(stats.remainingSemitones).toBe(2);
  });

  it("formats the range description with correct pluralization", () => {
    expect(calculateRangeStats("C3", "C4").rangeDescription).toBe("1 octave");
    expect(calculateRangeStats("C3", "C5").rangeDescription).toBe("2 octaves");
    expect(calculateRangeStats("C3", "C#4").rangeDescription).toBe(
      "1 octave, 1 semitone"
    );
    expect(calculateRangeStats("C3", "D4").rangeDescription).toBe(
      "1 octave, 2 semitones"
    );
  });

  it("classifies a textbook bass range", () => {
    expect(calculateRangeStats("E2", "E4").classification).toBe("Bass");
  });

  it("classifies a textbook soprano range", () => {
    expect(calculateRangeStats("C4", "A5").classification).toBe("Soprano");
  });

  it("classifies an extremely high range with no standard overlap", () => {
    expect(calculateRangeStats("C6", "C7").classification).toBe(
      "Soprano / High Voice"
    );
  });

  it("classifies an extremely low range with no standard overlap", () => {
    expect(calculateRangeStats("C1", "C2").classification).toBe(
      "Bass / Low Voice"
    );
  });
});
