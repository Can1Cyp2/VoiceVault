// app/util/shareRange.ts
//
// Helpers for the "share your vocal range" feature.

export type StoreLinkType = "android" | "apple";

export const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.can1cyp2.VoiceVault";
export const APP_STORE_URL =
  "https://apps.apple.com/ca/app/voicevault/id6741833897";
export const APP_DOWNLOAD_URL = GOOGLE_PLAY_URL;

export const getStoreDownloadUrl = (store: StoreLinkType): string =>
  store === "apple" ? APP_STORE_URL : GOOGLE_PLAY_URL;

/** True when the profile's range text is a real range like "F2 - A4". */
export const isShareableRange = (vocalRange: string | null): boolean => {
  if (!vocalRange) return false;
  return /^[A-G]#?\d\s*-\s*[A-G]#?\d$/.test(vocalRange.trim());
};

/** The text sent through the native share sheet (used alone or under the image). */
export const buildShareRangeMessage = (
  vocalRange: string,
  voiceType: string | null,
  store: StoreLinkType = "android"
): string => {
  const voiceLine = voiceType ? ` (${voiceType})` : "";
  const downloadUrl = getStoreDownloadUrl(store);
  return (
    `My vocal range is ${vocalRange}${voiceLine}!\n\n` +
    `Discover your own range with VoiceVault:\n${downloadUrl}`
  );
};
