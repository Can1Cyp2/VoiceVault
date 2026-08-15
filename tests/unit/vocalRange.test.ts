/**
 * Tests for app/util/vocalRange.ts
 *
 * Covers the master NOTES scale, note-to-index conversion, overall range
 * calculation across a song list, and fetching songs by artist (against the
 * mocked Supabase backend).
 */

jest.mock("../../app/util/supabase", () =>
  require("../helpers/supabaseMock").createSupabaseModuleMock()
);

import {
  NOTES,
  noteToValue,
  calculateOverallRange,
  getSongsByArtist,
} from "../../app/util/vocalRange";
import { seedTable, setTableError, resetDb } from "../helpers/supabaseMock";
import { makeSong, resetSongIds } from "../helpers/factories";

describe("NOTES scale", () => {
  it("spans C0 to C7", () => {
    expect(NOTES[0]).toBe("C0");
    expect(NOTES[NOTES.length - 1]).toBe("C7");
  });

  it("contains 85 chromatic notes (7 octaves + final C)", () => {
    expect(NOTES).toHaveLength(85);
  });

  it("is ordered from low to high", () => {
    expect(noteToValue("B3")).toBeLessThan(noteToValue("C4"));
    expect(noteToValue("C4")).toBeLessThan(noteToValue("C#4"));
    expect(noteToValue("G5")).toBeLessThan(noteToValue("A5"));
  });

  it("has no duplicate notes", () => {
    expect(new Set(NOTES).size).toBe(NOTES.length);
  });
});

describe("noteToValue", () => {
  it("maps notes to their chromatic index", () => {
    expect(noteToValue("C0")).toBe(0);
    expect(noteToValue("C4")).toBe(48); // 4 octaves * 12
    expect(noteToValue("A4")).toBe(57); // C4 + 9 semitones
    expect(noteToValue("C7")).toBe(84);
  });

  it("returns -1 for unknown notes", () => {
    expect(noteToValue("H3")).toBe(-1); // not a note name
    expect(noteToValue("c4")).toBe(-1); // lowercase not supported
    expect(noteToValue("Db3")).toBe(-1); // flats not supported
    expect(noteToValue("")).toBe(-1);
  });
});

describe("calculateOverallRange", () => {
  it("returns the C0 placeholder range for an empty song list", () => {
    expect(calculateOverallRange([])).toEqual({
      lowestNote: "C0",
      highestNote: "C0",
    });
  });

  it("returns the song's own range for a single song", () => {
    const result = calculateOverallRange([{ vocalRange: "E2 - A4" }]);
    expect(result).toEqual({ lowestNote: "E2", highestNote: "A4" });
  });

  it("picks the extremes across multiple songs", () => {
    const result = calculateOverallRange([
      { vocalRange: "C3 - G4" },
      { vocalRange: "A2 - E4" }, // lowest low
      { vocalRange: "E3 - C5" }, // highest high
    ]);
    expect(result).toEqual({ lowestNote: "A2", highestNote: "C5" });
  });

  it("ignores songs with malformed range strings", () => {
    const result = calculateOverallRange([
      { vocalRange: "C3 - G4" },
      { vocalRange: "not a range" },
      { vocalRange: undefined as any },
      { vocalRange: "C2" }, // missing the high note
    ]);
    expect(result).toEqual({ lowestNote: "C3", highestNote: "G4" });
  });

  it("tolerates extra whitespace around the notes", () => {
    const result = calculateOverallRange([{ vocalRange: "  D3 -  B4" }]);
    expect(result).toEqual({ lowestNote: "D3", highestNote: "B4" });
  });

  it("falls back to C0 when every song is malformed", () => {
    const result = calculateOverallRange([
      { vocalRange: "garbage" },
      { vocalRange: "X1 - Y2" },
    ]);
    expect(result).toEqual({ lowestNote: "C0", highestNote: "C0" });
  });
});

describe("getSongsByArtist", () => {
  beforeEach(() => {
    resetDb();
    resetSongIds();
  });

  it("returns every song by the requested artist", async () => {
    seedTable("songs", [
      makeSong({ name: "Yellow", artist: "Coldplay" }),
      makeSong({ name: "Fix You", artist: "Coldplay" }),
      makeSong({ name: "Somebody to Love", artist: "Queen" }),
    ]);

    const songs = await getSongsByArtist("Coldplay");

    expect(songs).toHaveLength(2);
    expect(songs.map((song) => song.name).sort()).toEqual(["Fix You", "Yellow"]);
  });

  it("returns an empty array for an unknown artist", async () => {
    seedTable("songs", [makeSong({ artist: "Coldplay" })]);
    expect(await getSongsByArtist("Nobody")).toEqual([]);
  });

  it("returns an empty array when the query errors", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    setTableError("songs", { message: "connection lost" });
    expect(await getSongsByArtist("Coldplay")).toEqual([]);
  });

  it("matches artists containing apostrophes (regression: names used to be SQL-escaped before eq())", async () => {
    seedTable("songs", [makeSong({ name: "Patience", artist: "Guns N' Roses" })]);

    const songs = await getSongsByArtist("Guns N' Roses");

    expect(songs).toHaveLength(1);
    expect(songs[0].name).toBe("Patience");
  });
});
