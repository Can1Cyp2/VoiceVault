// Native ads shown between songs in song lists (Search, Artist Details).
//
// FlatList unmounts rows that scroll far off screen, so ads are cached per
// slot here rather than in component state: scrolling back to an ad shows
// the same one instead of firing a fresh ad request every time.
//
// Every failure path resolves to "no ad" so the row collapses - no-fill,
// offline, consent refused, SDK init failure, timeouts. Repeated failures
// back off so a dead network or empty inventory is not hammered by every
// ad row that scrolls into view.
import { Platform } from "react-native";
import Constants from "expo-constants";
import { adService } from "../SupportModal/AdService";

// Expo Go and web have no AdMob native module, so ad slots there show a
// built-in preview of the layout instead of a real ad.
export const isAdPreviewMode =
  Constants.appOwnership === "expo" || Platform.OS === "web";

export type AdSpacing = { first: number; interval: number };
// First ad after `first` songs, then one every `interval` songs.
export const SEARCH_AD_SPACING: AdSpacing = { first: 6, interval: 12 };
// Artist pages are short, so the first ad comes sooner.
export const ARTIST_AD_SPACING: AdSpacing = { first: 4, interval: 10 };

// AdMob asks that native ads loaded over an hour ago are not shown.
const AD_MAX_AGE_MS = 55 * 60 * 1000;
const LOAD_TIMEOUT_MS = 15000;
const MAX_CONCURRENT_LOADS = 2;
// Loaded ads hold native resources; unmounted ones beyond this are released.
const MAX_CACHED_ADS = 8;
// A slot that failed waits this long before it may try again.
const SLOT_RETRY_DELAY_MS = 2 * 60 * 1000;
// After this many failures in a row, all slots pause with growing backoff.
const GLOBAL_FAILURE_THRESHOLD = 3;
const GLOBAL_BACKOFF_BASE_MS = 30 * 1000;
const GLOBAL_BACKOFF_MAX_MS = 10 * 60 * 1000;

export type AdLoadResult = { ad: any; reason: null } | { ad: null; reason: string };

type CachedAd = { ad: any; loadedAt: number };

const cache = new Map<string, CachedAd>();
const inFlight = new Map<string, Promise<AdLoadResult>>();
const mounted = new Map<string, number>();
const slotRetryAt = new Map<string, number>();
let consecutiveFailures = 0;
let pausedUntil = 0;
let activeLoads = 0;
const loadQueue: (() => void)[] = [];

const keyFor = (placement: string, slot: number) => `${placement}:${slot}`;

export type SongListAdMarker = { __adSlot: number };

export const isAdMarker = (item: any): item is SongListAdMarker =>
  item != null && typeof item.__adSlot === "number";

// Interleaves ad markers into a song list. Slots are tied to position, so
// appending another page of songs keeps every existing ad where it was.
export function withAdSlots<T>(
  songs: T[],
  { first, interval }: AdSpacing
): (T | SongListAdMarker)[] {
  const out: (T | SongListAdMarker)[] = [];
  songs.forEach((song, i) => {
    out.push(song);
    const count = i + 1;
    if (count >= first && (count - first) % interval === 0) {
      out.push({ __adSlot: (count - first) / interval });
    }
  });
  return out;
}

const adUnitId = (TestIds: any) =>
  __DEV__
    ? TestIds.NATIVE
    : Platform.OS === "ios"
      ? "ca-app-pub-7846050438990670/8162699038"
      : "ca-app-pub-7846050438990670/5033972815";

export function getCachedSongListAd(placement: string, slot: number): any | null {
  const cached = cache.get(keyFor(placement, slot));
  if (!cached || Date.now() - cached.loadedAt > AD_MAX_AGE_MS) return null;
  return cached.ad;
}

// Rows report mount state so eviction never destroys an ad on screen.
export function setSongListAdMounted(placement: string, slot: number, isMounted: boolean) {
  const key = keyFor(placement, slot);
  const count = (mounted.get(key) ?? 0) + (isMounted ? 1 : -1);
  if (count > 0) mounted.set(key, count);
  else mounted.delete(key);
}

// Frees every ad a screen loaded, for screens that will not come back
// (each Artist Details visit uses its own placement).
export function releaseSongListAds(placement: string) {
  // Deferred so the rows' native views finish unmounting first.
  setTimeout(() => {
    for (const [key, entry] of cache) {
      if (key.startsWith(`${placement}:`) && !mounted.has(key)) {
        destroyQuietly(entry.ad);
        cache.delete(key);
      }
    }
  }, 0);
}

function destroyQuietly(ad: any) {
  try {
    ad?.destroy();
  } catch {
    // Already released natively; nothing left to clean up.
  }
}

function evictUnmounted() {
  if (cache.size <= MAX_CACHED_ADS) return;
  const oldestFirst = [...cache.entries()].sort((a, b) => a[1].loadedAt - b[1].loadedAt);
  for (const [key, entry] of oldestFirst) {
    if (cache.size <= MAX_CACHED_ADS) break;
    if (mounted.has(key)) continue;
    destroyQuietly(entry.ad);
    cache.delete(key);
  }
}

function recordFailure(key: string) {
  consecutiveFailures++;
  slotRetryAt.set(key, Date.now() + SLOT_RETRY_DELAY_MS);
  if (consecutiveFailures >= GLOBAL_FAILURE_THRESHOLD) {
    const steps = consecutiveFailures - GLOBAL_FAILURE_THRESHOLD;
    const backoff = Math.min(GLOBAL_BACKOFF_BASE_MS * 2 ** steps, GLOBAL_BACKOFF_MAX_MS);
    pausedUntil = Date.now() + backoff;
  }
}

function recordSuccess(key: string) {
  consecutiveFailures = 0;
  pausedUntil = 0;
  slotRetryAt.delete(key);
}

// Caps simultaneous requests: FlatList renders well past the visible area,
// which would otherwise fire a burst of ad requests at once.
async function withLoadSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeLoads >= MAX_CONCURRENT_LOADS) {
    await new Promise<void>((resolve) => loadQueue.push(resolve));
  }
  activeLoads++;
  try {
    return await task();
  } finally {
    activeLoads--;
    loadQueue.shift()?.();
  }
}

function withTimeout(adPromise: Promise<any>): Promise<any> {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error("timed out"));
    }, LOAD_TIMEOUT_MS);
    adPromise.then(
      (ad) => {
        clearTimeout(timer);
        // An ad that arrives after we gave up is never shown, so free it.
        if (timedOut) destroyQuietly(ad);
        else resolve(ad);
      },
      (error) => {
        clearTimeout(timer);
        if (!timedOut) reject(error);
      }
    );
  });
}

function describeError(error: any): string {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? error ?? "");
  if (code.includes("no-fill") || message.includes("no-fill") || message.includes("No fill")) {
    return "No ad available right now (no fill)";
  }
  if (code.includes("network") || message.includes("network")) {
    return "Couldn't reach the ad server";
  }
  if (message.includes("timed out")) return "Ad request timed out";
  return message || "Ad failed to load";
}

// Never rejects. Resolves with the ad, or with a reason when there is none.
export function loadSongListAd(placement: string, slot: number): Promise<AdLoadResult> {
  const key = keyFor(placement, slot);

  const fresh = getCachedSongListAd(placement, slot);
  if (fresh) return Promise.resolve({ ad: fresh, reason: null });

  const pending = inFlight.get(key);
  if (pending) return pending;

  const now = Date.now();
  if (now < pausedUntil) {
    return Promise.resolve({ ad: null, reason: "Ad requests paused after repeated failures" });
  }
  if (now < (slotRetryAt.get(key) ?? 0)) {
    return Promise.resolve({ ad: null, reason: "Waiting before retrying this ad" });
  }

  const request = (async (): Promise<AdLoadResult> => {
    try {
      const requestOptions = await adService.getRequestOptionsIfAllowed();
      // Consent refused or SDK unavailable: not a failure worth backing off
      // for, and nothing will change until the app restarts.
      if (!requestOptions) return { ad: null, reason: "Ads unavailable (SDK or consent)" };

      const { NativeAd, TestIds, NativeMediaAspectRatio, NativeAdEventType } = await import(
        "react-native-google-mobile-ads"
      );
      const ad = await withLoadSlot(() =>
        withTimeout(
          NativeAd.createForAdRequest(adUnitId(TestIds), {
            ...requestOptions,
            // The media sits in the small square where a song row has its icon.
            aspectRatio: NativeMediaAspectRatio.SQUARE,
          })
        )
      );

      // Both events only fire when the row's assets registered with the SDK,
      // so a missing "impression" in dev means clicks will not work either.
      if (__DEV__) {
        ad.addAdEventListener(NativeAdEventType.IMPRESSION, () =>
          console.log(`Song list ad ${key}: impression recorded`)
        );
        ad.addAdEventListener(NativeAdEventType.CLICKED, () =>
          console.log(`Song list ad ${key}: click recorded`)
        );
      }

      // Only the row for this slot shows this ad, and it is the one asking
      // for a replacement, so the stale ad is no longer on screen.
      const stale = cache.get(key);
      if (stale) destroyQuietly(stale.ad);
      cache.set(key, { ad, loadedAt: Date.now() });
      recordSuccess(key);
      evictUnmounted();
      return { ad, reason: null };
    } catch (error) {
      recordFailure(key);
      const reason = describeError(error);
      console.log(`Song list ad ${key} not loaded: ${reason}`);
      return { ad: null, reason };
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request);
  return request;
}
