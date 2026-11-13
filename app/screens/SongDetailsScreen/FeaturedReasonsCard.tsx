// app/screens/SongDetailsScreen/FeaturedReasonsCard.tsx
//
// "Why it's featured" - shown on Song Details only when the song was opened
// from the Featured list. Spells out every reason the engine
// (app/util/featuredSongs.ts) picked it, against the user's range and
// estimated comfort zone, so the one-line summary in the list is backed up.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { FeaturedInfo, FeaturedReasonKind } from "../../util/featuredSongs";

const REASON_ICONS: Record<FeaturedReasonKind, keyof typeof Ionicons.glyphMap> = {
  "sweet-spot": "sparkles",
  "mostly-comfortable": "sparkles-outline",
  centered: "locate-outline",
  "leans-low": "arrow-down-circle-outline",
  "leans-high": "arrow-up-circle-outline",
  "fits-range": "checkmark-circle-outline",
  headroom: "resize-outline",
  "uses-top": "flame-outline",
  showcase: "star-outline",
  stretch: "trending-up",
  "stretch-fix": "swap-vertical",
  "brief-peak": "pulse-outline",
};

const CATEGORY_LABEL: Record<FeaturedInfo["category"], string> = {
  tessitura: "In your sweet spot",
  range: "Fits your range",
  stretch: "Stretch goal",
};

type Props = { info: FeaturedInfo };

export default function FeaturedReasonsCard({ info }: Props) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.card, { backgroundColor: colors.featuredBackground, borderColor: colors.featuredBorder }]}
      accessibilityLabel={`Why it's featured: ${info.summary}`}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.featured }]}>✨ Why it's featured</Text>
        <View style={[styles.chip, { borderColor: colors.featured }]}>
          <Text style={[styles.chipText, { color: colors.featured }]}>{CATEGORY_LABEL[info.category]}</Text>
        </View>
      </View>
      <Text style={[styles.summary, { color: colors.textPrimary }]}>{info.summary}</Text>

      {info.reasons.map((reason) => (
        <View key={reason.kind} style={styles.reasonRow}>
          <Ionicons name={REASON_ICONS[reason.kind]} size={18} color={colors.featured} style={styles.reasonIcon} />
          <View style={styles.reasonText}>
            <Text style={[styles.reasonTitle, { color: colors.textPrimary }]}>{reason.title}</Text>
            <Text style={[styles.reasonDetail, { color: colors.textSecondary }]}>{reason.detail}</Text>
          </View>
        </View>
      ))}

      <Text style={[styles.footer, { color: colors.textTertiary }]}>
        Your range: {info.userRange} · Estimated comfort zone: {info.userTessitura}. Featured is in
        beta, and your comfort zone is estimated from your saved range.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: "700" },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontSize: 11.5, fontWeight: "700" },
  summary: { fontSize: 14.5, fontWeight: "600", marginTop: 8, marginBottom: 4, lineHeight: 20 },
  reasonRow: { flexDirection: "row", marginTop: 10 },
  reasonIcon: { marginTop: 1, marginRight: 10 },
  reasonText: { flex: 1 },
  reasonTitle: { fontSize: 14, fontWeight: "700" },
  reasonDetail: { fontSize: 13, lineHeight: 18.5, marginTop: 2 },
  footer: { fontSize: 11.5, lineHeight: 16, marginTop: 14 },
});
