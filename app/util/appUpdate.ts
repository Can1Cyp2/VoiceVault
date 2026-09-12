// app/util/appUpdate.ts
//
// Checks whether a newer version of the app is live on the store the device
// installed it from (App Store on iOS, Play Store on Android) and powers the
// "update available" banner on the Home screen.
//
// iOS uses Apple's public iTunes lookup API (free, no key). Android scrapes
// the public Play Store listing, which has no official version API, so the
// parse is best-effort and simply reports "no update" if the page shape
// changes. Either way a failure is silent: worst case the banner just doesn't
// appear.

import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ANDROID_PACKAGE =
  (Constants.expoConfig as any)?.android?.package ?? "com.can1cyp2.VoiceVault";
const IOS_BUNDLE_ID =
  (Constants.expoConfig as any)?.ios?.bundleIdentifier ?? "com.can1cyp2.VoiceVault";

const DISMISSED_KEY = "voicevault:dismissedUpdateVersion";

// ---------------------------------------------------------------------------
// Admin test flag: force the banner to preview even without a real update.
// In-memory only (session-scoped), mirroring the tool-hint test toggle.
// ---------------------------------------------------------------------------
let forceUpdatePreview = false;
export const getForceUpdateBannerPreview = (): boolean => forceUpdatePreview;
export const setForceUpdateBannerPreview = (value: boolean): void => {
  forceUpdatePreview = value;
};

export const getCurrentAppVersion = (): string =>
  (Constants.expoConfig as any)?.version ?? "0.0.0";

// "1.6.1" -> "1.6.2", used for the admin preview banner's fake "next" version as example:
export const bumpPatchVersion = (version: string): string => {
  const parts = version.split(".").map((p) => parseInt(p, 10));
  if (parts.length < 3 || parts.some((n) => isNaN(n))) return `${version}.1`;
  parts[2] += 1;
  return parts.join(".");
};

// True when `latest` is a newer semver-ish version than `current`
export const isNewerVersion = (latest: string, current: string): boolean => {
  const toParts = (v: string) =>
    v.split(".").map((p) => parseInt(p, 10) || 0);
  const a = toParts(latest);
  const b = toParts(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
};

export interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion: string | null;
  storeUrl: string;
}

const androidStoreUrl = (): string =>
  `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

const iosFallbackStoreUrl = (): string =>
  `https://apps.apple.com/app/${IOS_BUNDLE_ID}`;

// Fetch that gives up after `ms` so a slow store never hangs the check.
const fetchWithTimeout = async (url: string, ms = 6000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const checkIos = async (): Promise<UpdateCheckResult> => {
  const fallback: UpdateCheckResult = {
    updateAvailable: false,
    latestVersion: null,
    storeUrl: iosFallbackStoreUrl(),
  };
  try {
    const res = await fetchWithTimeout(
      `https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}`
    );
    const json = await res.json();
    const app = json?.results?.[0];
    if (!app?.version) return fallback;
    return {
      updateAvailable: isNewerVersion(app.version, getCurrentAppVersion()),
      latestVersion: app.version,
      storeUrl: app.trackViewUrl ?? fallback.storeUrl,
    };
  } catch {
    return fallback;
  }
};

// Best-effort parse of the version out of the public Play Store listing.
const parsePlayStoreVersion = (html: string): string | null => {
  // Legacy "Current Version" block (older layouts).
  const legacy = html.match(/Current Version.*?>\s*([\d.]+)\s*</s);
  if (legacy?.[1]) return legacy[1];
  // Newer layouts embed it in an inline JSON blob, e.g. [[["1.6.1"]]].
  const blob = html.match(/\[\[\["(\d+\.\d+(?:\.\d+)?)"\]\]/);
  if (blob?.[1]) return blob[1];
  return null;
};

const checkAndroid = async (): Promise<UpdateCheckResult> => {
  const storeUrl = androidStoreUrl();
  const fallback: UpdateCheckResult = {
    updateAvailable: false,
    latestVersion: null,
    storeUrl,
  };
  try {
    const res = await fetchWithTimeout(`${storeUrl}&hl=en`);
    const html = await res.text();
    const version = parsePlayStoreVersion(html);
    if (!version) return fallback;
    return {
      updateAvailable: isNewerVersion(version, getCurrentAppVersion()),
      latestVersion: version,
      storeUrl,
    };
  } catch {
    return fallback;
  }
};

export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
  if (Platform.OS === "ios") return checkIos();
  if (Platform.OS === "android") return checkAndroid();
  return { updateAvailable: false, latestVersion: null, storeUrl: androidStoreUrl() };
};

// Store URL for the preview banner (no version comparison, just a link).
export const getStoreUrlForPreview = async (): Promise<string> => {
  if (Platform.OS === "ios") {
    const result = await checkIos();
    return result.storeUrl;
  }
  return androidStoreUrl();
};

// A dismissed version stays dismissed until an even newer one ships.
export const isUpdateDismissed = async (version: string): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(DISMISSED_KEY)) === version;
  } catch {
    return false;
  }
};

export const dismissUpdateVersion = async (version: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, version);
  } catch {
    // ignore - a failed write just means the banner may reappear next launch
  }
};
