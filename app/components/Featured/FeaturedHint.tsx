// app/components/Featured/FeaturedHint.tsx
//
// Pins a "why it's featured" note beside the part of Song Details it is
// about (vocal range, best fit, tessitura). A purple sparkle (a circle, or a
// pill with a label) toggles a purple callout with the reason. The parent
// owns the open state, because the callout usually sits below the row the
// sparkle is in rather than next to it.

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import type { FeaturedHighlight } from "../../util/featuredSongs";

type BadgeProps = {
  highlight: FeaturedHighlight;
  expanded: boolean;
  onPress: () => void;
  /** Shown beside the sparkle; omit for the plain circle. */
  label?: string;
};

export function FeaturedHintBadge({ highlight, expanded, onPress, label }: BadgeProps) {
  const { colors } = useTheme();
  const tint = expanded ? colors.textInverse : colors.featured;

  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={8}
      style={[
        label ? styles.pill : styles.circle,
        {
          backgroundColor: expanded ? colors.featured : colors.featuredBackground,
          borderColor: expanded ? colors.featured : colors.featuredBorder,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Featured: ${highlight.title}`}
      accessibilityHint={expanded ? "Hides why this was featured" : "Shows why this was featured"}
      accessibilityState={{ expanded }}
    >
      <Ionicons name="sparkles" size={label ? 12 : 14} color={tint} />
      {label && (
        <Text maxFontSizeMultiplier={1.3} style={[styles.pillText, { color: tint }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function FeaturedHintCallout({ highlight }: { highlight: FeaturedHighlight }) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.callout, { backgroundColor: colors.featuredBackground, borderColor: colors.featuredBorder }]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.calloutHeader}>
        <Ionicons name="sparkles" size={14} color={colors.featured} />
        <Text style={[styles.calloutTitle, { color: colors.featured }]}>{highlight.title}</Text>
      </View>
      <Text style={[styles.calloutDetail, { color: colors.textPrimary }]}>{highlight.detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  pillText: { fontSize: 12.5, fontWeight: "700" },
  callout: {
    alignSelf: "stretch",
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  calloutHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  calloutTitle: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  calloutDetail: { fontSize: 13.5, lineHeight: 19 },
});
