/**
 * Tests for app/util/songFilters.ts
 *
 * Covers persistence (defaults, saving, merging over defaults for forward
 * compatibility), the active-filter count that drives the filter button
 * badge, and the chosen-range bounds check.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// songFilters -> vocalRange -> supabase, which throws without env config
jest.mock("../../app/util/supabase", () =>
  require("../helpers/supabaseMock").createSupabaseModuleMock()
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  countActiveSongFilters,
  DEFAULT_SONG_FILTERS,
  getSongFilters,
  isSongWithinBounds,
  saveSongFilters,
} from "../../app/util/songFilters";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("song filter persistence", () => {
  it("returns defaults when nothing is stored", async () => {
    expect(await getSongFilters()).toEqual(DEFAULT_SONG_FILTERS);
  });

  it("round-trips saved filters", async () => {
    const filters = {
      ...DEFAULT_SONG_FILTERS,
      inRangeOnly: true,
      trendingFirst: true,
      customRangeEnabled: true,
      customRangeMin: "E2",
      customRangeMax: "A5",
    };
    await saveSongFilters(filters);
    expect(await getSongFilters()).toEqual(filters);
  });

  it("merges stored values over defaults so new fields get sane values", async () => {
    // Simulate an older version that stored fewer fields
    await AsyncStorage.setItem(
      "voicevault:songFilters",
      JSON.stringify({ verifiedOnly: true })
    );

    const filters = await getSongFilters();
    expect(filters.verifiedOnly).toBe(true);
    expect(filters.trendingFirst).toBe(DEFAULT_SONG_FILTERS.trendingFirst);
    expect(filters.customRangeMin).toBe(DEFAULT_SONG_FILTERS.customRangeMin);
  });

  it("returns defaults when the stored value is corrupt", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    await AsyncStorage.setItem("voicevault:songFilters", "not json {");
    expect(await getSongFilters()).toEqual(DEFAULT_SONG_FILTERS);
  });
});

describe("countActiveSongFilters", () => {
  it("is zero for the defaults", () => {
    expect(countActiveSongFilters(DEFAULT_SONG_FILTERS)).toBe(0);
  });

  it("counts each enabled filter once", () => {
    expect(
      countActiveSongFilters({
        ...DEFAULT_SONG_FILTERS,
        inRangeOnly: true,
        trendingFirst: true,
        customRangeEnabled: true,
      })
    ).toBe(3);
  });

  it("does not count the picked notes themselves", () => {
    expect(
      countActiveSongFilters({
        ...DEFAULT_SONG_FILTERS,
        customRangeMin: "E2",
        customRangeMax: "A5",
      })
    ).toBe(0);
  });
});

describe("isSongWithinBounds", () => {
  it("accepts a song range fully inside the bounds", () => {
    expect(isSongWithinBounds("C3 - A4", "C2", "C6")).toBe(true);
    expect(isSongWithinBounds("C3 - A4", "C3", "A4")).toBe(true); // exact fit
  });

  it("rejects a song range that goes below the lower bound", () => {
    expect(isSongWithinBounds("A2 - A4", "C3", "C6")).toBe(false);
  });

  it("rejects a song range that goes above the upper bound", () => {
    expect(isSongWithinBounds("C3 - C6", "C3", "A5")).toBe(false);
  });

  it("rejects unparseable ranges", () => {
    expect(isSongWithinBounds(undefined, "C2", "C6")).toBe(false);
    expect(isSongWithinBounds(null, "C2", "C6")).toBe(false);
    expect(isSongWithinBounds("", "C2", "C6")).toBe(false);
    expect(isSongWithinBounds("C3", "C2", "C6")).toBe(false); // no " - " separator
    expect(isSongWithinBounds("X9 - Y9", "C2", "C6")).toBe(false); // unknown notes
  });

  it("rejects when the bounds themselves are invalid notes", () => {
    expect(isSongWithinBounds("C3 - A4", "bogus", "C6")).toBe(false);
  });
});
