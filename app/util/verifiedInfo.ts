// app/util/verifiedInfo.ts
//
// Shared copy + helper for the "what does verified mean?" explanation,
// used on the song details verified badge and beside the verified-only
// search preference.

import { Alert } from "react-native";

export const VERIFIED_RANGE_INFO_TITLE = "Verified Vocal Ranges";

export const VERIFIED_RANGE_INFO_MESSAGE =
  "Verified vocal ranges are ranges added by the admin and do not always " +
  "reflect a completely accurate range of a song. Ranges can also differ " +
  "between songs depending on whether the range maxes out using full " +
  "(chest) voice only or includes falsetto notes, so two verified ranges " +
  "may not be directly comparable.";

export const showVerifiedRangeInfo = (): void => {
  Alert.alert(VERIFIED_RANGE_INFO_TITLE, VERIFIED_RANGE_INFO_MESSAGE, [
    { text: "Got it", style: "default" },
  ]);
};
