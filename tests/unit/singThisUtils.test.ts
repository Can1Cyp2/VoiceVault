/**
 * Tests for app/screens/SongDetailsScreen/singThisUtils.ts
 *
 * Covers the "Sing This!" feature's pitch scoring: target frequency lookup,
 * cents-off measurement, tuner needle clamping, user-facing feedback labels,
 * and the pass/fail tolerance.
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
  getTargetFrequency,
  getCentsOffTarget,
  clampCents,
  getSingPitchFeedback,
  isCloseEnoughToCount,
  formatHeldSeconds,
  SING_TUNER_RANGE_CENTS,
  SING_COUNTABLE_CENTS,
  SING_HOLD_DURATION_MS,
} from "../../app/screens/SongDetailsScreen/singThisUtils";

describe("getTargetFrequency", () => {
  it("resolves natural and sharp note names", () => {
    expect(getTargetFrequency("A4")).toBeCloseTo(440, 1);
    expect(getTargetFrequency("C#3")).toBeCloseTo(138.59, 1);
  });

  it("returns null for strings that are not notes", () => {
    expect(getTargetFrequency("A")).toBeNull(); // missing octave
    expect(getTargetFrequency("H2")).toBeNull(); // not a note name
    expect(getTargetFrequency("Bb3")).toBeNull(); // flats unsupported
    expect(getTargetFrequency("")).toBeNull();
  });
});

describe("getCentsOffTarget", () => {
  it("returns 0 when exactly on target", () => {
    expect(getCentsOffTarget(440, 440)).toBe(0);
  });

  it("returns +100 cents one semitone above the target", () => {
    const semitoneUp = 440 * Math.pow(2, 1 / 12);
    expect(getCentsOffTarget(semitoneUp, 440)).toBe(100);
  });

  it("returns negative cents when singing flat", () => {
    const slightlyFlat = 440 * Math.pow(2, -30 / 1200);
    expect(getCentsOffTarget(slightlyFlat, 440)).toBe(-30);
  });

  it("returns null when the target or detected frequency is missing", () => {
    expect(getCentsOffTarget(440, null)).toBeNull();
    expect(getCentsOffTarget(0, 440)).toBeNull();
    expect(getCentsOffTarget(440, 0)).toBeNull();
  });
});

describe("clampCents", () => {
  it("treats null as centered", () => {
    expect(clampCents(null)).toBe(0);
  });

  it("passes through values inside the tuner range", () => {
    expect(clampCents(30)).toBe(30);
    expect(clampCents(-45)).toBe(-45);
  });

  it("clamps to the tuner display range on both sides", () => {
    expect(clampCents(999)).toBe(SING_TUNER_RANGE_CENTS);
    expect(clampCents(-999)).toBe(-SING_TUNER_RANGE_CENTS);
  });
});

describe("getSingPitchFeedback", () => {
  it("shows Ready before recording starts", () => {
    const feedback = getSingPitchFeedback(null, false);
    expect(feedback.label).toBe("Ready");
    expect(feedback.tone).toBe("idle");
  });

  it("shows Listening while recording without a clear pitch", () => {
    const feedback = getSingPitchFeedback(null, true);
    expect(feedback.label).toBe("Listening");
    expect(feedback.tone).toBe("idle");
  });

  it("shows Perfect within 5 cents", () => {
    expect(getSingPitchFeedback(0, true).label).toBe("Perfect");
    expect(getSingPitchFeedback(5, true).label).toBe("Perfect");
    expect(getSingPitchFeedback(-5, true).tone).toBe("perfect");
  });

  it("shows Close with a direction hint between 6 and 50 cents", () => {
    const slightlyHigh = getSingPitchFeedback(15, true);
    expect(slightlyHigh.label).toBe("Close");
    expect(slightlyHigh.detail).toContain("high");
    expect(slightlyHigh.tone).toBe("close");

    const aLittleLow = getSingPitchFeedback(-40, true);
    expect(aLittleLow.label).toBe("Close");
    expect(aLittleLow.detail).toContain("low");
  });

  it("shows Off beyond 50 cents", () => {
    expect(getSingPitchFeedback(70, true)).toMatchObject({
      label: "Off",
      detail: "Too high.",
      tone: "off",
    });
    expect(getSingPitchFeedback(-70, true).detail).toBe("Too low.");
  });
});

describe("isCloseEnoughToCount", () => {
  it("counts anything within the countable tolerance", () => {
    expect(isCloseEnoughToCount(0, "A4", "A4")).toBe(true);
    expect(isCloseEnoughToCount(SING_COUNTABLE_CENTS, "A#4", "A4")).toBe(true);
    expect(isCloseEnoughToCount(-SING_COUNTABLE_CENTS, "G#4", "A4")).toBe(true);
  });

  it("rejects pitches just outside the tolerance", () => {
    expect(isCloseEnoughToCount(SING_COUNTABLE_CENTS + 1, "A4", "A4")).toBe(false);
  });

  it("falls back to note-name equality when cents are unavailable", () => {
    expect(isCloseEnoughToCount(null, "A4", "A4")).toBe(true);
    expect(isCloseEnoughToCount(null, "G4", "A4")).toBe(false);
  });
});

describe("formatHeldSeconds", () => {
  it("formats milliseconds as seconds with one decimal", () => {
    expect(formatHeldSeconds(0)).toBe("0.0");
    expect(formatHeldSeconds(1234)).toBe("1.2");
  });

  it("caps the display at the required hold duration", () => {
    expect(formatHeldSeconds(SING_HOLD_DURATION_MS)).toBe("2.0");
    expect(formatHeldSeconds(99999)).toBe("2.0");
  });
});
