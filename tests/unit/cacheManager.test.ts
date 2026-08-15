/**
 * Tests for app/util/cacheManager.ts
 *
 * Covers the auto-clear schedule preference, the manual clear action, and
 * the once-per-launch auto-clear check. expo-image and the song image
 * cache are mocked so no real caches are touched.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockClearDiskCache = jest.fn().mockResolvedValue(true);
const mockClearMemoryCache = jest.fn().mockResolvedValue(true);
const mockGetCachePathAsync = jest.fn().mockResolvedValue(null);
jest.mock("expo-image", () => ({
  Image: {
    clearDiskCache: (...args: any[]) => mockClearDiskCache(...args),
    clearMemoryCache: (...args: any[]) => mockClearMemoryCache(...args),
    getCachePathAsync: (...args: any[]) => mockGetCachePathAsync(...args),
  },
}));

// Maps a fake file path to its { exists, size }, set per-test via mockFiles.
const mockFiles: Record<string, { exists: boolean; size: number }> = {};
jest.mock("expo-file-system", () => ({
  File: class {
    exists: boolean;
    size: number;
    constructor(path: string) {
      const info = mockFiles[path] ?? { exists: false, size: 0 };
      this.exists = info.exists;
      this.size = info.size;
    }
  },
}));

const mockClearSongImageCache = jest.fn().mockResolvedValue(undefined);
const mockGetSongImageCacheSnapshot = jest
  .fn()
  .mockResolvedValue({ entries: [], rawCacheBytes: 0 });
jest.mock("../../app/util/songImages", () => ({
  clearSongImageCache: (...args: any[]) => mockClearSongImageCache(...args),
  getSongImageCacheSnapshot: (...args: any[]) => mockGetSongImageCacheSnapshot(...args),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getCacheAutoClearInterval,
  setCacheAutoClearInterval,
  getLastCacheClearAt,
  clearAppCache,
  getCacheSizeBytes,
  formatCacheSize,
  maybeAutoClearCache,
  DEFAULT_CACHE_AUTO_CLEAR_INTERVAL,
} from "../../app/util/cacheManager";

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockGetCachePathAsync.mockResolvedValue(null);
  mockGetSongImageCacheSnapshot.mockResolvedValue({ entries: [], rawCacheBytes: 0 });
  for (const key of Object.keys(mockFiles)) delete mockFiles[key];
});

describe("auto-clear interval preference", () => {
  it("defaults to weekly", async () => {
    expect(await getCacheAutoClearInterval()).toBe("weekly");
    expect(DEFAULT_CACHE_AUTO_CLEAR_INTERVAL).toBe("weekly");
  });

  it("persists changes", async () => {
    await setCacheAutoClearInterval("weekly");
    expect(await getCacheAutoClearInterval()).toBe("weekly");

    await setCacheAutoClearInterval("never");
    expect(await getCacheAutoClearInterval()).toBe("never");
  });
});

describe("clearAppCache", () => {
  it("clears the song image cache and the expo-image cache, then stamps the time", async () => {
    const before = Date.now();
    await clearAppCache();

    expect(mockClearSongImageCache).toHaveBeenCalledTimes(1);
    expect(mockClearDiskCache).toHaveBeenCalledTimes(1);
    expect(mockClearMemoryCache).toHaveBeenCalledTimes(1);
    expect(await getLastCacheClearAt()).toBeGreaterThanOrEqual(before);
  });

  it("still stamps the time even if expo-image's cache clear fails", async () => {
    mockClearDiskCache.mockRejectedValueOnce(new Error("boom"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(clearAppCache()).resolves.toBeUndefined();
    expect(await getLastCacheClearAt()).toBeGreaterThan(0);
  });
});

describe("formatCacheSize", () => {
  it("formats zero and sub-KB sizes in bytes", () => {
    expect(formatCacheSize(0)).toBe("0 B");
    expect(formatCacheSize(512)).toBe("512 B");
  });

  it("formats KB and MB with one decimal under 10 units", () => {
    expect(formatCacheSize(1536)).toBe("1.5 KB"); // 1.5 KB
    expect(formatCacheSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("rounds to a whole number at 10 units and above", () => {
    expect(formatCacheSize(12 * 1024)).toBe("12 KB");
  });
});

describe("getCacheSizeBytes", () => {
  it("returns the raw URL cache size when no images have cached files", async () => {
    mockGetSongImageCacheSnapshot.mockResolvedValue({
      entries: [{ imageUrl: "https://example.com/a.jpg" } as any],
      rawCacheBytes: 200,
    });
    mockGetCachePathAsync.mockResolvedValue(null); // not cached on disk

    expect(await getCacheSizeBytes()).toBe(200);
  });

  it("sums the raw cache size with every cached image file's size", async () => {
    mockGetSongImageCacheSnapshot.mockResolvedValue({
      entries: [
        { imageUrl: "https://example.com/a.jpg" } as any,
        { imageUrl: "https://example.com/b.jpg" } as any,
      ],
      rawCacheBytes: 100,
    });
    mockGetCachePathAsync.mockImplementation(async (url: string) =>
      url.endsWith("a.jpg") ? "/cache/a.jpg" : "/cache/b.jpg"
    );
    mockFiles["/cache/a.jpg"] = { exists: true, size: 1000 };
    mockFiles["/cache/b.jpg"] = { exists: true, size: 2500 };

    expect(await getCacheSizeBytes()).toBe(100 + 1000 + 2500);
  });

  it("skips files that no longer exist on disk", async () => {
    mockGetSongImageCacheSnapshot.mockResolvedValue({
      entries: [{ imageUrl: "https://example.com/a.jpg" } as any],
      rawCacheBytes: 50,
    });
    mockGetCachePathAsync.mockResolvedValue("/cache/a.jpg");
    mockFiles["/cache/a.jpg"] = { exists: false, size: 999 };

    expect(await getCacheSizeBytes()).toBe(50);
  });

  it("does not blow up when a lookup throws", async () => {
    mockGetSongImageCacheSnapshot.mockResolvedValue({
      entries: [{ imageUrl: "https://example.com/a.jpg" } as any],
      rawCacheBytes: 30,
    });
    mockGetCachePathAsync.mockRejectedValue(new Error("boom"));

    expect(await getCacheSizeBytes()).toBe(30);
  });
});

describe("maybeAutoClearCache", () => {
  it("does nothing when the interval is 'never'", async () => {
    await setCacheAutoClearInterval("never");
    const cleared = await maybeAutoClearCache();

    expect(cleared).toBe(false);
    expect(mockClearSongImageCache).not.toHaveBeenCalled();
  });

  it("seeds the timestamp on first launch without clearing", async () => {
    await setCacheAutoClearInterval("monthly");
    const cleared = await maybeAutoClearCache();

    expect(cleared).toBe(false);
    expect(mockClearSongImageCache).not.toHaveBeenCalled();
    expect(await getLastCacheClearAt()).toBeGreaterThan(0);
  });

  it("does not clear before the interval has elapsed", async () => {
    await setCacheAutoClearInterval("weekly");
    await maybeAutoClearCache(); // seeds timestamp to "now"

    const cleared = await maybeAutoClearCache();
    expect(cleared).toBe(false);
    expect(mockClearSongImageCache).not.toHaveBeenCalled();
  });

  it("clears once the interval has elapsed", async () => {
    await setCacheAutoClearInterval("weekly");
    await AsyncStorage.setItem(
      "voicevault:cacheLastClearedAt",
      String(Date.now() - 8 * DAY_MS)
    );

    const cleared = await maybeAutoClearCache();

    expect(cleared).toBe(true);
    expect(mockClearSongImageCache).toHaveBeenCalledTimes(1);
  });

  it("resets the countdown after clearing", async () => {
    await setCacheAutoClearInterval("weekly");
    await AsyncStorage.setItem(
      "voicevault:cacheLastClearedAt",
      String(Date.now() - 8 * DAY_MS)
    );

    await maybeAutoClearCache();
    const secondCall = await maybeAutoClearCache();

    expect(secondCall).toBe(false);
    expect(mockClearSongImageCache).toHaveBeenCalledTimes(1);
  });
});
