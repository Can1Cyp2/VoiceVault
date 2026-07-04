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
jest.mock("expo-image", () => ({
  Image: {
    clearDiskCache: (...args: any[]) => mockClearDiskCache(...args),
    clearMemoryCache: (...args: any[]) => mockClearMemoryCache(...args),
  },
}));

const mockClearSongImageCache = jest.fn().mockResolvedValue(undefined);
jest.mock("../../app/util/songImages", () => ({
  clearSongImageCache: (...args: any[]) => mockClearSongImageCache(...args),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getCacheAutoClearInterval,
  setCacheAutoClearInterval,
  getLastCacheClearAt,
  clearAppCache,
  maybeAutoClearCache,
  DEFAULT_CACHE_AUTO_CLEAR_INTERVAL,
} from "../../app/util/cacheManager";

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe("auto-clear interval preference", () => {
  it("defaults to monthly", async () => {
    expect(await getCacheAutoClearInterval()).toBe("monthly");
    expect(DEFAULT_CACHE_AUTO_CLEAR_INTERVAL).toBe("monthly");
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
