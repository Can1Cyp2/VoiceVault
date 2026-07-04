/**
 * Tests for app/util/recentlyViewed.ts
 *
 * Covers the device-local "recently viewed songs" history: ordering,
 * deduplication, the 10-item cap, and AsyncStorage round-tripping.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addToRecentlyViewed,
  addToRecentHistory,
  getRecentHistoryItems,
  getSearchRecentsEnabled,
  getRecentlyViewedSongs,
  logRecentSearchQuery,
  logRecentlyViewedSong,
  clearRecentlyViewedSongs,
  removeRecentHistoryItem,
  setSearchRecentsEnabled,
  RECENTLY_VIEWED_LIMIT,
  RecentHistoryItem,
  RecentlyViewedSong,
} from "../../app/util/recentlyViewed";

const song = (
  name: string,
  artist = "Some Artist",
  viewedAt = Date.now()
): RecentlyViewedSong => ({
  name,
  artist,
  vocalRange: "C3 - G4",
  viewedAt,
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("addToRecentlyViewed (pure)", () => {
  it("puts the newest song first", () => {
    const list = addToRecentlyViewed([song("Older")], song("Newer"));
    expect(list.map((entry) => entry.name)).toEqual(["Newer", "Older"]);
  });

  it("moves a re-viewed song to the front instead of duplicating it", () => {
    const list = addToRecentlyViewed(
      [song("A"), song("B"), song("C")],
      song("B")
    );
    expect(list.map((entry) => entry.name)).toEqual(["B", "A", "C"]);
  });

  it("treats same title by different artists as different songs", () => {
    const list = addToRecentlyViewed(
      [song("Hello", "Adele")],
      song("Hello", "Lionel Richie")
    );
    expect(list).toHaveLength(2);
  });

  it("caps the list at the limit", () => {
    const full = Array.from({ length: RECENTLY_VIEWED_LIMIT }, (_, i) =>
      song(`Song ${i}`)
    );
    const list = addToRecentlyViewed(full, song("One More"));

    expect(list).toHaveLength(RECENTLY_VIEWED_LIMIT);
    expect(list[0].name).toBe("One More");
    expect(list.some((entry) => entry.name === `Song ${RECENTLY_VIEWED_LIMIT - 1}`)).toBe(
      false
    );
  });
});

describe("addToRecentHistory (pure)", () => {
  const query = (
    text: string,
    filter: "songs" | "artists" = "songs",
    searchedAt = Date.now()
  ): RecentHistoryItem => ({
    type: "query",
    query: text,
    filter,
    searchedAt,
  });

  it("keeps songs and search queries together, newest first", () => {
    const list = addToRecentHistory([song("Older")], query("Adele"));

    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ type: "query", query: "Adele" });
    expect(list[1]).toMatchObject({ name: "Older" });
  });

  it("deduplicates matching queries by query text and filter", () => {
    const list = addToRecentHistory(
      [query("Adele", "songs"), query("Adele", "artists")],
      query(" adele ", "songs")
    );

    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ query: " adele ", filter: "songs" });
    expect(list[1]).toMatchObject({ query: "Adele", filter: "artists" });
  });
});

describe("storage round-trip", () => {
  it("logs and reads back songs, newest first", async () => {
    await logRecentlyViewedSong({ name: "First", artist: "A", vocalRange: "C3 - C4" });
    await logRecentlyViewedSong({ name: "Second", artist: "B", vocalRange: "D3 - D4" });

    const songs = await getRecentlyViewedSongs();

    expect(songs.map((entry) => entry.name)).toEqual(["Second", "First"]);
    expect(songs[0].viewedAt).toBeGreaterThan(0);
  });

  it("logs and reads back mixed songs and searches", async () => {
    const nowSpy = jest.spyOn(Date, "now")
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2000);

    await logRecentlyViewedSong({ name: "First", artist: "A", vocalRange: "C3 - C4" });
    await logRecentSearchQuery("Adele", "artists");

    const history = await getRecentHistoryItems();

    nowSpy.mockRestore();

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ type: "query", query: "Adele", filter: "artists" });
    expect(history[1]).toMatchObject({ type: "song", name: "First" });
  });

  it("ignores songs without a name or artist", async () => {
    await logRecentlyViewedSong({ name: "", artist: "A", vocalRange: "C3 - C4" });
    await logRecentlyViewedSong({ name: "Valid", artist: "", vocalRange: "C3 - C4" });

    expect(await getRecentlyViewedSongs()).toEqual([]);
  });

  it("returns an empty list when storage holds corrupt data", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    await AsyncStorage.setItem("voicevault:recentlyViewedSongs", "not json {");

    expect(await getRecentlyViewedSongs()).toEqual([]);
  });

  it("clears the history", async () => {
    await logRecentlyViewedSong({ name: "Song", artist: "A", vocalRange: "C3 - C4" });
    await clearRecentlyViewedSongs();

    expect(await getRecentlyViewedSongs()).toEqual([]);
  });

  it("removes a single item, leaving the rest of the history intact", async () => {
    await logRecentlyViewedSong({ name: "Keep Me", artist: "A", vocalRange: "C3 - C4" });
    await logRecentSearchQuery("delete me", "songs");
    await logRecentSearchQuery("keep me too", "artists");

    const history = await getRecentHistoryItems();
    const target = history.find(
      (item) => item.type === "query" && item.query === "delete me"
    )!;
    await removeRecentHistoryItem(target);

    const remaining = await getRecentHistoryItems();
    expect(remaining).toHaveLength(2);
    expect(
      remaining.some((item) => item.type === "query" && item.query === "delete me")
    ).toBe(false);
    expect(remaining.some((item) => item.type === "song")).toBe(true);
  });

  it("defaults the search-recents setting to enabled and persists changes", async () => {
    expect(await getSearchRecentsEnabled()).toBe(true);

    await setSearchRecentsEnabled(false);
    expect(await getSearchRecentsEnabled()).toBe(false);

    await setSearchRecentsEnabled(true);
    expect(await getSearchRecentsEnabled()).toBe(true);
  });
});
