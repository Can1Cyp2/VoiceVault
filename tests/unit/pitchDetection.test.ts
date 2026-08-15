/**
 * Tests for app/util/pitchDetection.ts
 *
 * Covers the pure frequency/note math: converting frequencies to notes,
 * cents-off-pitch calculation, and note-to-frequency lookup. The native
 * microphone integration is intentionally not tested here.
 */

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
  frequencyToNote,
  formatNote,
  calculateCents,
  getNoteFrequency,
  VALID_VOCAL_RANGE,
} from "../../app/util/pitchDetection";

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

describe("frequencyToNote", () => {
  it("maps standard pitches to the right note", () => {
    expect(frequencyToNote(440)).toEqual({ note: "A", octave: 4 });
    expect(frequencyToNote(261.63)).toEqual({ note: "C", octave: 4 });
    expect(frequencyToNote(82.41)).toEqual({ note: "E", octave: 2 });
    expect(frequencyToNote(1046.5)).toEqual({ note: "C", octave: 6 });
  });

  it("rounds slightly off-pitch frequencies to the nearest note", () => {
    expect(frequencyToNote(445)).toEqual({ note: "A", octave: 4 }); // ~20 cents sharp
    expect(frequencyToNote(435)).toEqual({ note: "A", octave: 4 }); // ~20 cents flat
  });

  it("rejects frequencies outside the valid vocal range", () => {
    expect(frequencyToNote(VALID_VOCAL_RANGE.minFrequency - 1)).toBeNull();
    expect(frequencyToNote(VALID_VOCAL_RANGE.maxFrequency + 1)).toBeNull();
  });

  it("accepts frequencies exactly on the range boundaries", () => {
    expect(frequencyToNote(VALID_VOCAL_RANGE.minFrequency)).not.toBeNull();
    expect(frequencyToNote(VALID_VOCAL_RANGE.maxFrequency)).not.toBeNull();
  });

  it("rejects invalid input", () => {
    expect(frequencyToNote(0)).toBeNull();
    expect(frequencyToNote(-100)).toBeNull();
    expect(frequencyToNote(NaN)).toBeNull();
    expect(frequencyToNote(Infinity)).toBeNull();
  });
});

describe("getNoteFrequency", () => {
  it("returns standard tuning frequencies", () => {
    expect(getNoteFrequency("A", 4)).toBeCloseTo(440, 1);
    expect(getNoteFrequency("C", 4)).toBeCloseTo(261.63, 1);
    expect(getNoteFrequency("E", 2)).toBeCloseTo(82.41, 1);
  });

  it("returns 0 for an unknown note name", () => {
    expect(getNoteFrequency("H", 4)).toBe(0);
    expect(getNoteFrequency("Bb", 3)).toBe(0);
  });

  it("round-trips with frequencyToNote for every note in the singable octaves", () => {
    for (let octave = 2; octave <= 5; octave++) {
      for (const note of NOTE_NAMES) {
        const frequency = getNoteFrequency(note, octave);
        expect(frequencyToNote(frequency)).toEqual({ note, octave });
      }
    }
  });
});

describe("calculateCents", () => {
  it("returns 0 for a perfectly tuned note", () => {
    expect(calculateCents(440)).toBe(0);
  });

  it("returns positive cents when sharp", () => {
    const sharp = 440 * Math.pow(2, 25 / 1200); // 25 cents above A4
    expect(calculateCents(sharp)).toBe(25);
  });

  it("returns negative cents when flat", () => {
    const flat = 440 * Math.pow(2, -25 / 1200); // 25 cents below A4
    expect(calculateCents(flat)).toBe(-25);
  });

  it("returns 0 for invalid input", () => {
    expect(calculateCents(0)).toBe(0);
    expect(calculateCents(NaN)).toBe(0);
    expect(calculateCents(-10)).toBe(0);
  });
});

describe("formatNote", () => {
  it("joins note and octave for display", () => {
    expect(formatNote("A", 4)).toBe("A4");
    expect(formatNote("C#", 3)).toBe("C#3");
  });
});
