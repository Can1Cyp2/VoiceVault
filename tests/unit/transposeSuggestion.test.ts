/**
 * Tests for app/util/transposeSuggestion.ts
 *
 * Covers the "transpose N semitones to fit your range" suggestion:
 * direction, minimal shift, impossible ranges, and message formatting.
 */

jest.mock("../../app/util/supabase", () =>
  require("../helpers/supabaseMock").createSupabaseModuleMock()
);

import {
  getTransposeSuggestion,
  formatTransposeSuggestion,
} from "../../app/util/transposeSuggestion";

describe("getTransposeSuggestion", () => {
  // User range used throughout: E2 - E4 (a classic two-octave bass range).
  const USER_MIN = "E2";
  const USER_MAX = "E4";

  it("reports a song already inside the range as fitting", () => {
    expect(getTransposeSuggestion("G2 - C4", USER_MIN, USER_MAX)).toEqual({
      type: "fits",
    });
  });

  it("reports an exact-boundary song as fitting", () => {
    expect(getTransposeSuggestion("E2 - E4", USER_MIN, USER_MAX)).toEqual({
      type: "fits",
    });
  });

  it("suggests shifting up when the song dips too low", () => {
    // C2 is 4 semitones below E2.
    expect(getTransposeSuggestion("C2 - C4", USER_MIN, USER_MAX)).toEqual({
      type: "transpose",
      semitones: 4,
    });
  });

  it("suggests shifting down when the song reaches too high", () => {
    // G4 is 3 semitones above E4.
    expect(getTransposeSuggestion("G2 - G4", USER_MIN, USER_MAX)).toEqual({
      type: "transpose",
      semitones: -3,
    });
  });

  it("suggests the minimal shift that still fits the top end", () => {
    // A2 sits 3 semitones below C3; shifting up 3 keeps D4 -> F4 under C5.
    const result = getTransposeSuggestion("A2 - D4", "C3", "C5");
    expect(result).toEqual({ type: "transpose", semitones: 3 });
  });

  it("reports songs wider than the user's whole range as impossible", () => {
    // F2 - A5 spans 40 semitones; E2 - E4 spans 24.
    expect(getTransposeSuggestion("F2 - A5", USER_MIN, USER_MAX)).toEqual({
      type: "impossible",
      extraSemitonesNeeded: 16,
    });
  });

  it("returns null for malformed input", () => {
    expect(getTransposeSuggestion("", USER_MIN, USER_MAX)).toBeNull();
    expect(getTransposeSuggestion("garbage", USER_MIN, USER_MAX)).toBeNull();
    expect(getTransposeSuggestion("C3 - X9", USER_MIN, USER_MAX)).toBeNull();
    expect(getTransposeSuggestion("C3 - C4", "nope", USER_MAX)).toBeNull();
  });

  it("accepts en-dash separated ranges (as used by some songs)", () => {
    expect(getTransposeSuggestion("G2 – C4", USER_MIN, USER_MAX)).toEqual({
      type: "fits",
    });
  });
});

describe("formatTransposeSuggestion", () => {
  it("says nothing when the song fits or input was invalid", () => {
    expect(formatTransposeSuggestion({ type: "fits" })).toBeNull();
    expect(formatTransposeSuggestion(null)).toBeNull();
  });

  it("describes upward and downward shifts with pluralization", () => {
    expect(
      formatTransposeSuggestion({ type: "transpose", semitones: 1 })
    ).toBe("Transpose up 1 semitone and this song fits your range.");
    expect(
      formatTransposeSuggestion({ type: "transpose", semitones: -2 })
    ).toBe("Transpose down 2 semitones and this song fits your range.");
  });

  it("explains impossible ranges", () => {
    const message = formatTransposeSuggestion({
      type: "impossible",
      extraSemitonesNeeded: 5,
    });
    expect(message).toContain("5 semitones more than your range");
  });
});
