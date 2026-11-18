/**
 * Song list ad lifecycle: an ad must never be destroyed while a row still
 * draws it, since freeing a native ad under its view crashes iOS on touch.
 */

jest.mock("expo-constants", () => ({ __esModule: true, default: { appOwnership: null } }));

// Plain functions, not jest.fn(): the config's restoreMocks would wipe them.
jest.mock("../../app/components/SupportModal/AdService", () => ({
  adService: { getRequestOptionsIfAllowed: async () => ({}) },
}));

jest.mock("react-native-google-mobile-ads", () => ({
  TestIds: { NATIVE: "test-native" },
  NativeMediaAspectRatio: { SQUARE: 1 },
  NativeAdEventType: { IMPRESSION: "impression", CLICKED: "clicked" },
  NativeAd: {
    createForAdRequest: async () => ({
      destroy: jest.fn(),
      addAdEventListener: () => {},
    }),
  },
}));

type Ads = typeof import("../../app/components/SongRowAd/songListAds");

const loadAds = (): Ads => {
  let mod: Ads | undefined;
  jest.isolateModules(() => {
    mod = require("../../app/components/SongRowAd/songListAds");
  });
  return mod!;
};

const DESTROY_DELAY_MS = 5000;

describe("songListAds", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("waits for the row to let go before destroying a released placement's ad", async () => {
    const ads = loadAds();
    const result = await ads.loadSongListAd("artist-1", 0);
    expect(result.reason).toBeNull();
    const ad = result.ad;
    ads.retainSongListAd(ad);

    ads.releaseSongListAds("artist-1");
    jest.advanceTimersByTime(DESTROY_DELAY_MS * 3);
    expect(ad.destroy).not.toHaveBeenCalled();
    expect(ads.getCachedSongListAd("artist-1", 0)).toBeNull();

    ads.releaseSongListAd(ad);
    jest.advanceTimersByTime(DESTROY_DELAY_MS);
    expect(ad.destroy).toHaveBeenCalledTimes(1);
  });

  it("does not destroy immediately even when no row draws the ad", async () => {
    const ads = loadAds();
    const { ad } = await ads.loadSongListAd("artist-2", 0);

    ads.releaseSongListAds("artist-2");
    jest.advanceTimersByTime(DESTROY_DELAY_MS - 1);
    expect(ad.destroy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(ad.destroy).toHaveBeenCalledTimes(1);
  });

  it("evicts only ads no row is drawing once the cache is full", async () => {
    const ads = loadAds();
    const loaded = [];
    for (let slot = 0; slot < 9; slot++) {
      jest.setSystemTime(Date.now() + 1000);
      const { ad } = await ads.loadSongListAd("search-songs", slot);
      loaded.push(ad);
      // The oldest ad stays on screen the whole time.
      if (slot === 0) ads.retainSongListAd(ad);
    }

    jest.advanceTimersByTime(DESTROY_DELAY_MS);
    expect(loaded[0].destroy).not.toHaveBeenCalled();
    expect(ads.getCachedSongListAd("search-songs", 0)).toBe(loaded[0]);
    // The next oldest, which nothing drew, made room instead.
    expect(loaded[1].destroy).toHaveBeenCalledTimes(1);
    expect(ads.getCachedSongListAd("search-songs", 1)).toBeNull();
  });
});
