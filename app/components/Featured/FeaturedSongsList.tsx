// app/components/Featured/FeaturedSongsList.tsx
//
// The "Featured" view on the search screen: songs picked for the signed-in
// user's voice by app/util/featuredSongs.ts, grouped by why they were picked,
// each with a one-line reason. Tapping a song hands the full reasoning to
// Song Details. Only rendered once the user has a vocal range - the search
// screen gates entry.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import {
  describeVoiceProfile,
  FeaturedCategory,
  FeaturedSong,
  VoiceProfile,
} from "../../util/featuredSongs";
import { fetchFeaturedSongs } from "../../util/featuredSongsApi";

type Props = {
  profile: VoiceProfile;
  verifiedOnly: boolean;
  onOpenSong: (item: FeaturedSong) => void;
};

type Row =
  | { type: "section"; category: FeaturedCategory }
  | { type: "song"; item: FeaturedSong };

const SECTIONS: Record<FeaturedCategory, { title: string; icon: keyof typeof Ionicons.glyphMap; blurb: string }> = {
  tessitura: {
    title: "In your sweet spot",
    icon: "sparkles",
    blurb: "Most of the melody sits where your voice is most comfortable (your tessitura).",
  },
  range: {
    title: "Fits your range",
    icon: "checkmark-circle-outline",
    blurb: "Every note is inside your vocal range.",
  },
  stretch: {
    title: "Stretch goals",
    icon: "trending-up",
    blurb:
      "Up to 2 semitones past your range. Peak notes are usually brief and range grows with practice - or transpose slightly to fit.",
  },
};

const showTessituraInfo = (range: string, tessitura: string, lowConfidence: boolean) =>
  Alert.alert(
    "Your comfortable zone",
    `Your range is ${range}. Your estimated tessitura - the part you can sing comfortably for a whole song - is ${tessitura}.\n\n` +
      "We estimate it by trimming the outer edges of your range (more off the top, since your highest notes are the hardest to sustain), the way voice teachers think about where a voice sits best.\n\n" +
      (lowConfidence
        ? "Your saved range is quite narrow, so we've used all of it. Re-testing your range will make this more accurate."
        : "It's an estimate from your lowest and highest notes, so treat it as a starting point.")
  );

const showCustomizeComingSoon = () =>
  Alert.alert(
    "Customization coming soon ✨",
    "Soon you'll be able to customize the algorithm behind your Featured songs - like favourite genres, how many stretch songs you see, and more. Stay tuned!"
  );

export default function FeaturedSongsList({ profile, verifiedOnly, onOpenSong }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<FeaturedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  // Drops results from an older request that finishes after a newer one.
  const requestIdRef = useRef(0);

  const described = describeVoiceProfile(profile);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      const requestId = ++requestIdRef.current;
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setFailed(false);
      try {
        const result = await fetchFeaturedSongs(profile, { verifiedOnly });
        if (requestId !== requestIdRef.current) return;
        setItems(result);
      } catch (err) {
        console.warn("Featured songs failed to load:", err);
        if (requestId !== requestIdRef.current) return;
        setFailed(true);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [profile, verifiedOnly]
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    let current: FeaturedCategory | null = null;
    for (const item of items) {
      if (item.info.category !== current) {
        current = item.info.category;
        out.push({ type: "section", category: current });
      }
      out.push({ type: "song", item });
    }
    return out;
  }, [items]);

  const header = (
    <View>
      <View style={[styles.introCard, { backgroundColor: colors.featuredBackground, borderColor: colors.featuredBorder }]}>
        <View style={styles.introTitleRow}>
          <Text style={[styles.introTitle, { color: colors.featured }]}>✨ Featured</Text>
          <View style={[styles.betaBadge, { borderColor: colors.featured }]}>
            <Text style={[styles.betaText, { color: colors.featured }]}>BETA</Text>
          </View>
        </View>
        <Text style={[styles.introText, { color: colors.textPrimary }]}>
          Featured shows you songs that fit your voice! Pull down or tap New list to get a fresh
          selection. This is currently a beta feature, and we'll be improving it over time.
        </Text>

        <Pressable
          onPress={() => showTessituraInfo(described.range, described.tessitura, profile.lowConfidence)}
          style={({ pressed }) => [styles.voiceRow, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={`Your range ${described.range}, comfortable zone ${described.tessitura}. Learn more`}
        >
          <Text style={[styles.voiceText, { color: colors.textSecondary }]}>
            Range <Text style={[styles.voiceValue, { color: colors.textPrimary }]}>{described.range}</Text>
            {"  ·  "}Comfort zone{" "}
            <Text style={[styles.voiceValue, { color: colors.featured }]}>{described.tessitura}</Text>
          </Text>
          <Ionicons name="information-circle-outline" size={16} color={colors.featured} />
        </Pressable>

        <View style={styles.introButtons}>
          <TouchableOpacity
            style={[styles.introButton, { borderColor: colors.featured }]}
            onPress={() => void load("refresh")}
            disabled={loading || refreshing}
            accessibilityRole="button"
            accessibilityLabel="Get a new list of featured songs"
          >
            <Ionicons name="shuffle" size={16} color={colors.featured} />
            <Text style={[styles.introButtonText, { color: colors.featured }]}>New list</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.introButton, { borderColor: colors.featured }]}
            onPress={showCustomizeComingSoon}
            accessibilityRole="button"
            accessibilityLabel="Customize featured songs, coming soon"
          >
            <Ionicons name="options-outline" size={16} color={colors.featured} />
            <Text style={[styles.introButtonText, { color: colors.featured }]}>Customize</Text>
            <Text style={[styles.soonText, { color: colors.textTertiary }]}>Soon</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.flex}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.featured} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Finding songs for your voice...</Text>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.listContent}
      data={rows}
      keyExtractor={(row) =>
        row.type === "section" ? `section-${row.category}` : `featured-${row.item.song.id ?? row.item.song.name}`
      }
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name={failed ? "cloud-offline-outline" : "musical-notes-outline"} size={40} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {failed
              ? "Couldn't load featured songs. Check your connection and pull down to try again."
              : "No matches this time - pull down or tap New list to try another batch."}
          </Text>
        </View>
      }
      renderItem={({ item: row }) => {
        if (row.type === "section") {
          const section = SECTIONS[row.category];
          return (
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name={section.icon} size={16} color={colors.featured} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{section.title}</Text>
              </View>
              <Text style={[styles.sectionBlurb, { color: colors.textTertiary }]}>{section.blurb}</Text>
            </View>
          );
        }
        const { song, info } = row.item;
        return (
          <TouchableOpacity onPress={() => onOpenSong(row.item)} activeOpacity={0.75}>
            <View style={[styles.resultItem, { backgroundColor: colors.backgroundCard, shadowColor: colors.shadow }]}>
              <View style={[styles.resultIcon, { backgroundColor: colors.featuredBackground }]}>
                <Ionicons name="musical-notes" size={24} color={colors.featured} />
              </View>
              <View style={styles.resultTextContainer}>
                <Text style={[styles.resultText, { color: colors.textPrimary }]} numberOfLines={2}>
                  {song.name}
                </Text>
                <Text style={[styles.resultSubText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {song.artist} • {song.vocalRange}
                </Text>
                <Text style={[styles.reasonText, { color: colors.featured }]}>✨ {info.summary}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
        );
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load("refresh")}
          colors={[colors.featured]}
          tintColor={colors.featured}
        />
      }
      overScrollMode="always"
      bounces
    />
  );
}

const createStyles = (colors: typeof import("../../styles/theme").LightColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    listContent: { paddingBottom: 90 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
    loadingText: { marginTop: 10, fontSize: 14 },
    introCard: {
      marginHorizontal: 16,
      marginBottom: 6,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
    },
    introTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    introTitle: { fontSize: 18, fontWeight: "700" },
    betaBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
    betaText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
    introText: { fontSize: 13.5, lineHeight: 19 },
    voiceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
    voiceText: { flexShrink: 1, fontSize: 12.5 },
    voiceValue: { fontWeight: "700" },
    introButtons: { flexDirection: "row", gap: 8, marginTop: 12 },
    introButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderWidth: 1,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    introButtonText: { fontSize: 13, fontWeight: "600" },
    soonText: { fontSize: 10.5, fontWeight: "600" },
    sectionHeader: { marginHorizontal: 18, marginTop: 14, marginBottom: 2 },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    sectionTitle: { fontSize: 15.5, fontWeight: "700" },
    sectionBlurb: { fontSize: 12, marginTop: 2, lineHeight: 16 },
    resultItem: {
      padding: 15,
      marginVertical: 6,
      marginHorizontal: 16,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    resultIcon: {
      width: 45,
      height: 45,
      borderRadius: 22.5,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    resultTextContainer: { flex: 1, marginRight: 6 },
    resultText: { fontSize: 17, fontWeight: "600" },
    resultSubText: { fontSize: 13.5, marginTop: 3 },
    reasonText: { fontSize: 12.5, fontWeight: "600", marginTop: 5, lineHeight: 17 },
    empty: { alignItems: "center", paddingHorizontal: 32, paddingTop: 40, gap: 10 },
    emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  });
