/**
 * Tests for app/screens/SongDetailsScreen/RangeBestFit.tsx
 *
 * Covers the MIDI-style note conversion and the "closest voice-type fit"
 * suggestion shown on the song details screen.
 */

import {
  noteToValue,
  findClosestVocalRangeFit,
} from "../../app/screens/SongDetailsScreen/RangeBestFit";

describe("noteToValue (MIDI-style)", () => {
  it("maps notes to MIDI numbers", () => {
    expect(noteToValue("C4")).toBe(60); // middle C
    expect(noteToValue("A4")).toBe(69); // concert A
    expect(noteToValue("C#4")).toBe(61);
    expect(noteToValue("E2")).toBe(40);
  });

  it("throws on invalid note names", () => {
    expect(() => noteToValue("H2")).toThrow();
    expect(() => noteToValue("Bb3")).toThrow(); // flats unsupported
  });
});

describe("findClosestVocalRangeFit", () => {
  it("classifies a textbook tenor song", () => {
    const result = findClosestVocalRangeFit("C3 - A4");

    expect(result.male).toBe("Tenor");
    expect(result.maleOutOfRange).toBeNull();
    // For a female singer the same song sits low: closest is Alto,
    // with the bottom of the song below the alto range.
    expect(result.female).toBe("Alto");
    expect(result.femaleOutOfRange).toBe("lower");
  });

  it("classifies a textbook bass song", () => {
    const result = findClosestVocalRangeFit("E2 - E4");

    expect(result.male).toBe("Bass");
    expect(result.maleOutOfRange).toBeNull();
    expect(result.femaleOutOfRange).toBe("lower");
  });

  it("classifies a textbook soprano song", () => {
    const result = findClosestVocalRangeFit("C4 - A5");

    expect(result.female).toBe("Soprano");
    expect(result.femaleOutOfRange).toBeNull();
  });

  it("flags a song wider than any voice type as out of range on both ends", () => {
    const result = findClosestVocalRangeFit("C2 - C6");

    expect(result.maleOutOfRange).toBe("both");
    expect(result.femaleOutOfRange).toBe("both");
  });

  it("still returns a closest category when the song does not overlap a voice type at all", () => {
    // Far above every male range.
    const result = findClosestVocalRangeFit("C6 - C7");

    expect(result.male).not.toBe("Unknown");
    expect(result.female).not.toBe("Unknown");
  });
});
