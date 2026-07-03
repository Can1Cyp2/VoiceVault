/**
 * Integration tests for app/util/api.ts (the search engine).
 *
 * Runs the real search code (candidate gathering, scoring, ranking,
 * deduplication, pagination) against a small in-memory song catalog served
 * by the Supabase mock, the same way the app queries the real backend.
 */

jest.mock("../../app/util/supabase", () =>
  require("../helpers/supabaseMock").createSupabaseModuleMock()
);

import {
  searchSongsByQuery,
  smartSearchSongs,
  smartSearchArtists,
  getSearchSuggestions,
} from "../../app/util/api";
import { seedTable, setTableError, resetDb } from "../helpers/supabaseMock";

const CATALOG = [
  { id: 1, name: "Bohemian Rhapsody", artist: "Queen", vocalRange: "F2 - A5" },
  { id: 2, name: "Somebody to Love", artist: "Queen", vocalRange: "A2 - A5" },
  { id: 3, name: "Love of My Life", artist: "Queen", vocalRange: "C3 - G5" },
  { id: 4, name: "Yellow", artist: "Coldplay", vocalRange: "F3 - F5" },
  { id: 5, name: "Fix You", artist: "Coldplay", vocalRange: "C3 - C6" },
  { id: 6, name: "Blue Monday", artist: "New Order", vocalRange: "C3 - C4" },
  { id: 7, name: "Yellow Submarine", artist: "The Beatles", vocalRange: "D3 - D4" },
  { id: 8, name: "Don't Stop Me Now", artist: "Queen", vocalRange: "F2 - A5" },
];

beforeEach(() => {
  resetDb();
  seedTable("songs", CATALOG);
});

describe("searchSongsByQuery", () => {
  it("ranks an exact title match above partial matches", async () => {
    const results = await searchSongsByQuery("Yellow");

    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].name).toBe("Yellow");
    expect(results.map((song) => song.name)).toContain("Yellow Submarine");
  });

  it("matches on artist as well as title", async () => {
    const results = await searchSongsByQuery("Queen");
    expect(results).toHaveLength(4);
  });

  it("matches queries containing apostrophes (regression: they used to be SQL-escaped)", async () => {
    const results = await searchSongsByQuery("don't stop");

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Don't Stop Me Now");
  });

  it("returns an empty array when the backend errors", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    setTableError("songs", { message: "backend down" });
    expect(await searchSongsByQuery("Yellow")).toEqual([]);
  });
});

describe("smartSearchSongs", () => {
  it("returns nothing for a blank query", async () => {
    expect(await smartSearchSongs("")).toEqual([]);
    expect(await smartSearchSongs("   ")).toEqual([]);
  });

  it("puts an exact title match first", async () => {
    const results = await smartSearchSongs("yellow");

    expect(results[0].name).toBe("Yellow");
    expect(results.map((song) => song.name)).toContain("Yellow Submarine");
  });

  it("finds all songs by an artist", async () => {
    const results = await smartSearchSongs("queen");

    expect(results).toHaveLength(4);
    expect(results.every((song) => song.artist === "Queen")).toBe(true);
  });

  it("finds songs with apostrophes in the title", async () => {
    const results = await smartSearchSongs("don't stop me now");

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toBe("Don't Stop Me Now");
  });

  it("understands combined 'title artist' queries via smart splitting", async () => {
    const results = await smartSearchSongs("fix you coldplay");

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toBe("Fix You");
  });

  it("still matches when the query has a trailing space (user mid-typing)", async () => {
    const results = await smartSearchSongs("yellow ");
    expect(results[0].name).toBe("Yellow");
  });

  it("never returns duplicate songs even when multiple strategies match", async () => {
    const results = await smartSearchSongs("yellow");
    const ids = results.map((song) => song.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("paginates with limit and offset without overlap", async () => {
    const firstPage = await smartSearchSongs("queen", 2, 0);
    const secondPage = await smartSearchSongs("queen", 2, 2);

    expect(firstPage).toHaveLength(2);
    expect(secondPage).toHaveLength(2);

    const allIds = [...firstPage, ...secondPage].map((song) => song.id);
    expect(new Set(allIds).size).toBe(4);
  });

  it("returns nothing for a query matching no songs", async () => {
    expect(await smartSearchSongs("zzzz qqqq")).toEqual([]);
  });
});

describe("smartSearchArtists", () => {
  it("aggregates songs into one entry per artist with a song count", async () => {
    const results = await smartSearchArtists("queen");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ name: "Queen", count: 4 });
  });

  it("matches artists by prefix", async () => {
    const results = await smartSearchArtists("cold");

    expect(results.map((artist) => artist.name)).toContain("Coldplay");
  });

  it("returns nothing for blank or unmatched queries", async () => {
    expect(await smartSearchArtists("")).toEqual([]);
    expect(await smartSearchArtists("zzzz")).toEqual([]);
  });

  it("returns an empty array when the backend errors", async () => {
    setTableError("songs", { message: "backend down" });
    expect(await smartSearchArtists("queen")).toEqual([]);
  });
});

describe("getSearchSuggestions", () => {
  it("suggests matching song and artist names", async () => {
    const suggestions = await getSearchSuggestions("ye");

    expect(suggestions).toContain("Yellow");
    expect(suggestions).toContain("Yellow Submarine");
  });

  it("excludes the query itself from suggestions (case-insensitive)", async () => {
    const suggestions = await getSearchSuggestions("yellow");

    expect(suggestions).not.toContain("Yellow");
    expect(suggestions).toContain("Yellow Submarine");
  });

  it("caps suggestions at five", async () => {
    seedTable(
      "songs",
      Array.from({ length: 20 }, (_, i) => ({
        id: 100 + i,
        name: `Song ${i}`,
        artist: `Artist ${i}`,
        vocalRange: "C3 - C4",
      }))
    );

    const suggestions = await getSearchSuggestions("Song");
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });

  it("returns an empty array when the backend errors", async () => {
    setTableError("songs", { message: "backend down" });
    expect(await getSearchSuggestions("ye")).toEqual([]);
  });
});
