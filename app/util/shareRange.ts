// app/util/shareRange.ts
//
// Helpers for the "share your vocal range" feature.

export const APP_DOWNLOAD_URL =
  "https://play.google.com/store/apps/details?id=com.can1cyp2.VoiceVault";

/** True when the profile's range text is a real range like "F2 - A4". */
export const isShareableRange = (vocalRange: string | null): boolean => {
  if (!vocalRange) return false;
  return /^[A-G]#?\d\s*-\s*[A-G]#?\d$/.test(vocalRange.trim());
};

/** The text sent through the native share sheet (used alone or under the image). */
export const buildShareRangeMessage = (
  vocalRange: string,
  voiceType: string | null
): string => {
  const voiceLine = voiceType ? ` (${voiceType})` : "";
  return (
    `My vocal range is ${vocalRange}${voiceLine}! 🎤\n\n` +
    `Discover your own range with VoiceVault:\n${APP_DOWNLOAD_URL}`
  );
};
