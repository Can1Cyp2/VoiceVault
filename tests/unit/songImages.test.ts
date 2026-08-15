/**
 * Tests for app/util/songImages.ts
 *
 * Covers provider selection, track matching, the iTunes hi-res URL upgrade,
 * the auto fallback chain, and caching. Network is fully mocked.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchSongImage,
  songImageCacheKey,
  clearSongImageCache,
  __resetSongImageMemoryCache,
} from "../../app/util/songImages";

const jsonResponse = (body: any) => ({ ok: true, json: async () => body });

const itunesBody = (overrides: any = {}) => ({
  results: [
    {
      trackName: "Yellow",
      artistName: "Coldplay",
      artworkUrl100: "https://example.com/a/100x100bb.jpg",
      trackViewUrl: "https://music.apple.com/track/1",
      ...overrides,
    },
  ],
});

const deezerBody = (overrides: any = {}) => ({
  data: [
    {
      title: "Yellow",
      artist: { name: "Coldplay" },
      album: {
        cover_xl: "https://deezer.com/xl.jpg",
        cover_big: "https://deezer.com/big.jpg",
        cover_medium: "https://deezer.com/med.jpg",
      },
      link: "https://deezer.com/track/1",
      ...overrides,
    },
  ],
});

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetSongImageMemoryCache();
  (global as any).fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("cache key", () => {
  it("is case- and whitespace-insensitive", () => {
    expect(songImageCacheKey("  Yellow ", "Coldplay")).toBe(
      songImageCacheKey("yellow", "COLDPLAY")
    );
  });
});

describe("fetchSongImage - iTunes", () => {
  it("upgrades the artwork to 600x600 and reports Apple Music attribution", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(itunesBody()));

    const image = await fetchSongImage("Yellow", "Coldplay", "itunes");

    expect(image).not.toBeNull();
    expect(image!.imageUrl).toBe("https://example.com/a/600x600bb.jpg");
    expect(image!.thumbUrl).toBe("https://example.com/a/100x100bb.jpg");
    expect(image!.source).toBe("itunes");
    expect(image!.attributionLabel).toBe("Apple Music");
    expect(image!.attributionUrl).toBe("https://music.apple.com/track/1");
  });

  it("prefers the result that matches both track and artist", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            trackName: "Yellow Submarine",
            artistName: "The Beatles",
            artworkUrl100: "https://example.com/wrong/100x100bb.jpg",
          },
          {
            trackName: "Yellow",
            artistName: "Coldplay",
            artworkUrl100: "https://example.com/right/100x100bb.jpg",
          },
        ],
      })
    );

    const image = await fetchSongImage("Yellow", "Coldplay", "itunes");
    expect(image!.imageUrl).toContain("/right/");
  });

  it("returns null when iTunes has no results", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ results: [] }));
    expect(await fetchSongImage("Nope", "Nobody", "itunes")).toBeNull();
  });
});

describe("fetchSongImage - Deezer", () => {
  it("returns the album cover with Deezer attribution", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(deezerBody()));

    const image = await fetchSongImage("Yellow", "Coldplay", "deezer");

    expect(image!.imageUrl).toBe("https://deezer.com/xl.jpg");
    expect(image!.source).toBe("deezer");
    expect(image!.attributionLabel).toBe("Deezer");
  });
});

describe("fetchSongImage - auto fallback", () => {
  it("falls back to Deezer when iTunes finds nothing", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({ results: [] })) // iTunes
      .mockResolvedValueOnce(jsonResponse({ data: [] })) // Deezer strict
      .mockResolvedValueOnce(jsonResponse(deezerBody())); // Deezer loose

    const image = await fetchSongImage("Yellow", "Coldplay", "auto");

    expect(image!.source).toBe("deezer");
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("returns null when every provider misses", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ results: [], data: [] }));
    expect(await fetchSongImage("Nope", "Nobody", "auto")).toBeNull();
  });
});

describe("caching", () => {
  it("does not hit the network twice for the same song (memory cache)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(itunesBody()));

    await fetchSongImage("Yellow", "Coldplay", "itunes");
    await fetchSongImage("Yellow", "Coldplay", "itunes");

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("reuses a persisted result after the session cache is cleared", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(itunesBody()));
    await fetchSongImage("Yellow", "Coldplay", "itunes");

    __resetSongImageMemoryCache(); // simulate a fresh app launch

    const image = await fetchSongImage("Yellow", "Coldplay", "itunes");
    expect(image!.imageUrl).toBe("https://example.com/a/600x600bb.jpg");
    expect(global.fetch).toHaveBeenCalledTimes(1); // served from disk cache
  });

  it("clearSongImageCache forces a refetch", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(itunesBody()))
      .mockResolvedValueOnce(jsonResponse(itunesBody()));

    await fetchSongImage("Yellow", "Coldplay", "itunes");
    await clearSongImageCache();
    await fetchSongImage("Yellow", "Coldplay", "itunes");

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("guards", () => {
  it("returns null for missing name or artist without hitting the network", async () => {
    expect(await fetchSongImage("", "Coldplay", "itunes")).toBeNull();
    expect(await fetchSongImage("Yellow", "", "itunes")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
