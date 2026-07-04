/**
 * Tests for app/util/rangeHistory.ts
 *
 * Covers the pure progress math used by the Range History screen's
 * "Your Progress" showcase.
 */

jest.mock("../../app/util/supabase", () =>
  require("../helpers/supabaseMock").createSupabaseModuleMock()
);

import {
  computeRangeProgress,
  RangeHistoryEntry,
} from "../../app/util/rangeHistory";

let nextId = 1;
const entry = (
  minRange: string,
  maxRange: string,
  createdAt: string
): RangeHistoryEntry => ({
  id: nextId++,
  min_range: minRange,
  max_range: maxRange,
  voice_type: null,
  reason: null,
  created_at: createdAt,
});

describe("computeRangeProgress", () => {
  it("returns null with fewer than two entries", () => {
    expect(computeRangeProgress([])).toBeNull();
    expect(computeRangeProgress([entry("C3", "C4", "2026-01-01")])).toBeNull();
  });

  it("compares the earliest and latest entries regardless of input order", () => {
    // Newest first, as fetchRangeHistory returns them.
    const progress = computeRangeProgress([
      entry("A2", "A4", "2026-06-01"), // latest: grew both directions
      entry("C3", "G4", "2026-01-01"), // first
    ]);

    expect(progress).not.toBeNull();
    expect(progress!.firstEntry.min_range).toBe("C3");
    expect(progress!.latestEntry.min_range).toBe("A2");
    // C3 -> A2 = 3 semitones lower; G4 -> A4 = 2 semitones higher.
    expect(progress!.semitonesGainedLow).toBe(3);
    expect(progress!.semitonesGainedHigh).toBe(2);
    expect(progress!.spanChange).toBe(5);
  });

  it("reports negative gains when the range shrank", () => {
    const progress = computeRangeProgress([
      entry("C3", "C5", "2026-01-01"),
      entry("D3", "B4", "2026-02-01"), // narrower on both ends
    ]);

    expect(progress!.semitonesGainedLow).toBe(-2);
    expect(progress!.semitonesGainedHigh).toBe(-1);
    expect(progress!.spanChange).toBe(-3);
  });

  it("reports zero change for identical ranges", () => {
    const progress = computeRangeProgress([
      entry("C3", "C4", "2026-01-01"),
      entry("C3", "C4", "2026-02-01"),
    ]);

    expect(progress!.semitonesGainedLow).toBe(0);
    expect(progress!.semitonesGainedHigh).toBe(0);
    expect(progress!.spanChange).toBe(0);
  });

  it("ignores entries with invalid notes", () => {
    const progress = computeRangeProgress([
      entry("C3", "C4", "2026-01-01"),
      entry("garbage", "C4", "2026-02-01"),
      entry("C3", "E4", "2026-03-01"),
    ]);

    expect(progress!.entryCount).toBe(2);
    expect(progress!.semitonesGainedHigh).toBe(4);
  });

  it("uses timestamps, not array position, to find first and latest", () => {
    const progress = computeRangeProgress([
      entry("C3", "C4", "2026-03-15"),
      entry("C3", "F4", "2026-06-20"), // actually the latest
      entry("D3", "C4", "2026-01-05"), // actually the first
    ]);

    expect(progress!.firstEntry.min_range).toBe("D3");
    expect(progress!.latestEntry.max_range).toBe("F4");
  });
});
