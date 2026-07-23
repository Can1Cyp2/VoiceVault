/**
 * Tests for app/util/songMetadata.ts
 *
 * The metadata columns are populated in bulk and are NULL for many songs, so
 * the important behaviour is graceful degradation: partial data, absent data,
 * a missing song, and a database that doesn't have the columns yet must all
 * resolve to something the UI can render without breaking.
 */

jest.mock("../../app/util/supabase", () =>
  require("../helpers/supabaseMock").createSupabaseModuleMock()
);

import {
  fetchSongMetadata,
  parseSongMetadata,
  hasAnyMetadata,
  hasTessitura,
  formatBpm,
  formatDuration,
  describeTempo,
  relativeKey,
} from "../../app/util/songMetadata";
import { seedTable, resetDb, setTableError } from "../helpers/supabaseMock";

const FULL_ROW = {
  id: 1,
  name: "Bohemian Rhapsody",
  artist: "Queen",
  bpm: 143.9,
  tessitura_low: "C4",
  tessitura_median: "D#4",
  tessitura_high: "G4",
  genre: "Rock",
  duration_sec: 355,
  release_year: 1975,
  explicit: false,
};

beforeEach(() => {
  resetDb();
});

describe("formatting helpers", () => {
  test("duration renders as m:ss with a padded seconds field", () => {
    expect(formatDuration(355)).toBe("5:55");
    expect(formatDuration(605)).toBe("10:05"); // padding matters here
    expect(formatDuration(60)).toBe("1:00");
  });

  test("duration rejects missing and nonsensical values", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(-30)).toBeNull();
  });

  test("bpm is rounded - fractional tempo means nothing to a singer", () => {
    expect(formatBpm(143.9)).toBe("144 BPM");
    expect(formatBpm(120)).toBe("120 BPM");
    expect(formatBpm(null)).toBeNull();
    expect(formatBpm(0)).toBeNull();
  });

  test("tempo is described in plain language across the band boundaries", () => {
    expect(describeTempo(60)).toBe("Slow");
    expect(describeTempo(69)).toBe("Slow");
    expect(describeTempo(70)).toBe("Relaxed");
    expect(describeTempo(99)).toBe("Relaxed");
    expect(describeTempo(100)).toBe("Moderate");
    expect(describeTempo(129)).toBe("Moderate");
    expect(describeTempo(130)).toBe("Upbeat");
    expect(describeTempo(159)).toBe("Upbeat");
    expect(describeTempo(160)).toBe("Fast");
    expect(describeTempo(null)).toBeNull();
  });
});

describe("parseSongMetadata", () => {
  test("maps snake_case columns onto the camelCase shape", () => {
    const m = parseSongMetadata(FULL_ROW);
    expect(m).toEqual({
      bpm: 143.9,
      tessituraLow: "C4",
      tessituraMedian: "D#4",
      tessituraHigh: "G4",
      genre: "Rock",
      durationSec: 355,
      releaseYear: 1975,
      explicit: false,
      songKey: null,
      keyConfidence: null,
    });
  });

  test("empty strings and blanks become null, not falsy junk", () => {
    const m = parseSongMetadata({
      bpm: "",
      genre: "   ",
      tessitura_low: "",
      duration_sec: null,
      release_year: undefined,
      explicit: null,
    });
    expect(m.bpm).toBeNull();
    expect(m.genre).toBeNull();
    expect(m.tessituraLow).toBeNull();
    expect(m.durationSec).toBeNull();
    expect(m.releaseYear).toBeNull();
    expect(m.explicit).toBeNull();
  });

  test("numeric columns arriving as strings are coerced", () => {
    const m = parseSongMetadata({ bpm: "107.9", duration_sec: "235", release_year: "2010" });
    expect(m.bpm).toBeCloseTo(107.9);
    expect(m.durationSec).toBe(235);
    expect(m.releaseYear).toBe(2010);
  });

  test("a row of all nulls parses without throwing", () => {
    expect(() => parseSongMetadata({})).not.toThrow();
    expect(hasAnyMetadata(parseSongMetadata({}))).toBe(false);
  });
});

describe("presence checks that drive whether the card renders", () => {
  test("hasAnyMetadata is false for an empty row and true for any single fact", () => {
    expect(hasAnyMetadata(null)).toBe(false);
    expect(hasAnyMetadata(parseSongMetadata({}))).toBe(false);
    expect(hasAnyMetadata(parseSongMetadata({ genre: "Pop" }))).toBe(true);
    expect(hasAnyMetadata(parseSongMetadata({ bpm: 120 }))).toBe(true);
  });

  test("explicit=false alone is not a reason to show the card", () => {
    // A false explicit flag renders nothing, so a card containing only that
    // would be empty.
    expect(hasAnyMetadata(parseSongMetadata({ explicit: false }))).toBe(false);
    expect(hasAnyMetadata(parseSongMetadata({ explicit: true }))).toBe(true);
  });

  test("tessitura requires all three notes - a partial set is not displayable", () => {
    expect(hasTessitura(parseSongMetadata(FULL_ROW))).toBe(true);
    expect(
      hasTessitura(parseSongMetadata({ tessitura_low: "C4", tessitura_high: "G4" }))
    ).toBe(false);
    expect(hasTessitura(null)).toBe(false);
  });
});

describe("fetchSongMetadata", () => {
  test("returns the metadata for a matching song", async () => {
    seedTable("songs", [FULL_ROW]);
    const m = await fetchSongMetadata("Bohemian Rhapsody", "Queen");
    expect(m?.genre).toBe("Rock");
    expect(m?.tessituraMedian).toBe("D#4");
    expect(m?.releaseYear).toBe(1975);
  });

  test("matches on artist too - shared titles must not cross-contaminate", async () => {
    // "With You" genuinely exists many times over in this database.
    seedTable("songs", [
      { name: "With You", artist: "Linkin Park", genre: "Rock", bpm: 100 },
      { name: "With You", artist: "Mariah Carey", genre: "Pop", bpm: 70 },
    ]);

    const rock = await fetchSongMetadata("With You", "Linkin Park");
    const pop = await fetchSongMetadata("With You", "Mariah Carey");

    expect(rock?.genre).toBe("Rock");
    expect(pop?.genre).toBe("Pop");
  });

  test("returns null when the song isn't in the table", async () => {
    seedTable("songs", [FULL_ROW]);
    expect(await fetchSongMetadata("Nonexistent Song", "Nobody")).toBeNull();
  });

  test("returns null rather than throwing when the query fails", async () => {
    // This is what happens when the migration hasn't been run yet: the
    // columns don't exist, PostgREST errors, and the screen must still work.
    seedTable("songs", [FULL_ROW]);
    setTableError("songs", { message: 'column "bpm" does not exist' });
    expect(await fetchSongMetadata("Bohemian Rhapsody", "Queen")).toBeNull();
  });

  test("an un-enriched song yields metadata that renders nothing", async () => {
    seedTable("songs", [{ name: "Obscure Track", artist: "Someone" }]);
    const m = await fetchSongMetadata("Obscure Track", "Someone");
    expect(m).not.toBeNull();
    expect(hasAnyMetadata(m)).toBe(false);
  });

  test("an empty song name short-circuits without querying", async () => {
    seedTable("songs", [FULL_ROW]);
    expect(await fetchSongMetadata("", "Queen")).toBeNull();
  });

  test("handles a song stored with no artist", async () => {
    seedTable("songs", [{ name: "Untitled", artist: null, genre: "Ambient" }]);
    const m = await fetchSongMetadata("Untitled", null);
    expect(m?.genre).toBe("Ambient");
  });
});

describe("musical key (an estimate, so it is handled carefully)", () => {
  test("relativeKey returns the key sharing the same seven notes", () => {
    // These are exactly the pairs key detection confuses, which is why the
    // UI offers them as the alternative.
    expect(relativeKey("C major")).toBe("A minor");
    expect(relativeKey("F major")).toBe("D minor");
    expect(relativeKey("A minor")).toBe("C major");
    expect(relativeKey("F# minor")).toBe("A major");
  });

  test("relativeKey is round-trip stable", () => {
    for (const key of ["C major", "G major", "F# minor", "D# major"]) {
      expect(relativeKey(relativeKey(key))).toBe(key);
    }
  });

  test("relativeKey rejects junk instead of guessing", () => {
    expect(relativeKey(null)).toBeNull();
    expect(relativeKey("")).toBeNull();
    expect(relativeKey("H major")).toBeNull();
    expect(relativeKey("C")).toBeNull();
    expect(relativeKey("something else")).toBeNull();
  });

  test("key alone is enough reason to show the card", () => {
    expect(hasAnyMetadata(parseSongMetadata({ song_key: "F# minor" }))).toBe(true);
  });

  test("key and confidence are parsed off the row", () => {
    const m = parseSongMetadata({ song_key: "F# minor", key_confidence: "0.868" });
    expect(m.songKey).toBe("F# minor");
    expect(m.keyConfidence).toBeCloseTo(0.868);
  });

  test("a song with no key estimate simply has none", () => {
    const m = parseSongMetadata({ genre: "Pop" });
    expect(m.songKey).toBeNull();
    expect(m.keyConfidence).toBeNull();
  });
});
