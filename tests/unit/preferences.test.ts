/**
 * Tests for app/util/preferences.ts
 *
 * Covers the device-local preference toggles (song images, verified-only)
 * and the isVerifiedSong helper used by the search filter.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getSongImagesEnabled,
  setSongImagesEnabled,
  getVerifiedSongsOnly,
  setVerifiedSongsOnly,
  isVerifiedSong,
} from "../../app/util/preferences";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("song images preference", () => {
  it("defaults to enabled", async () => {
    expect(await getSongImagesEnabled()).toBe(true);
  });

  it("persists changes", async () => {
    await setSongImagesEnabled(false);
    expect(await getSongImagesEnabled()).toBe(false);

    await setSongImagesEnabled(true);
    expect(await getSongImagesEnabled()).toBe(true);
  });
});

describe("verified songs only preference", () => {
  it("defaults to disabled (show everyone's songs)", async () => {
    expect(await getVerifiedSongsOnly()).toBe(false);
  });

  it("persists changes", async () => {
    await setVerifiedSongsOnly(true);
    expect(await getVerifiedSongsOnly()).toBe(true);

    await setVerifiedSongsOnly(false);
    expect(await getVerifiedSongsOnly()).toBe(false);
  });
});

describe("isVerifiedSong", () => {
  it("treats songs without an uploader username as verified", () => {
    expect(isVerifiedSong({ username: null })).toBe(true);
    expect(isVerifiedSong({ username: undefined })).toBe(true);
    expect(isVerifiedSong({})).toBe(true);
    expect(isVerifiedSong({ username: "" })).toBe(true);
  });

  it("treats community uploads (with a username) as unverified", () => {
    expect(isVerifiedSong({ username: "singer42" })).toBe(false);
  });
});
