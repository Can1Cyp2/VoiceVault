// app/screens/SongDetailsScreen/SongMetadataCard.tsx
//
// Shows the extra facts about a song: where the voice sits (tessitura), tempo,
// genre, year, length and the explicit flag.
//
// This data is populated in bulk and is missing for plenty of songs, so the
// component renders NOTHING at all rather than a card full of dashes when
// there is nothing to say. Each row inside is likewise conditional.

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FONTS } from "../../styles/theme";
import { useTheme } from "../../contexts/ThemeContext";
import {
  SongMetadata,
  hasAnyMetadata,
  hasTessitura,
  formatBpm,
  formatDuration,
  describeTempo,
  tempoBlurb,
  keyConfidenceTier,
  keyConfidenceDetail,
  keyConfidencePercent,
  keyEmotionalCharacter,
  KeyConfidenceTier,
} from "../../util/songMetadata";

// Fallback wording for the marker when a key predates confidence scoring and
// has no percentage to show.
const TIER_LABEL: Record<KeyConfidenceTier, string> = {
  agreed: "Agreed",
  single: "Estimate",
  disputed: "Disputed",
};

type Props = {
  metadata: SongMetadata | null;
  /** Song title + artist, used for the tap-to-explain chip popups. */
  songName?: string;
  artistName?: string | null;
  /** Plays a reference note - reused from the parent screen. */
  onPlayNote?: (note: string) => void;
};

const SongMetadataCard: React.FC<Props> = ({ metadata, songName, artistName, onPlayNote }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isTessituraInfoVisible, setTessituraInfoVisible] = useState(false);

  if (!hasAnyMetadata(metadata)) return null;

  const bpmText = formatBpm(metadata.bpm);
  const tempoText = tempoBlurb(metadata.bpm);
  const durationText = formatDuration(metadata.durationSec);
  const showTessitura = hasTessitura(metadata);
  const keyTier = keyConfidenceTier(metadata.keySourcesChecked, metadata.keySourcesAgree);
  const tierColor = colors[keyTier === "agreed" ? "success" : keyTier === "disputed" ? "danger" : "warning"];
  const keyPercent = keyConfidencePercent(metadata.keyConfidence);

  // "for {song} by {artist}" clause, gracefully dropping the artist if unknown.
  const songClause = songName
    ? artistName
      ? `"${songName}" by ${artistName}`
      : `"${songName}"`
    : "this song";

  // Chips: only the facts we actually have. Genre/year/length are tappable and
  // explain themselves in a popup using data we've already fetched.
  const chips: { icon: any; label: string; onPress?: () => void }[] = [];
  if (bpmText)
    chips.push({
      icon: "speedometer-outline",
      label: bpmText,
      // BPM is detected automatically from the recording, not confirmed by
      // anyone - and the detector can lock onto a doubled or halved pulse
      // (a slow ballad's flowing arpeggios read as a much faster tempo than
      // it actually feels). Worth saying explicitly rather than presenting
      // the number as settled fact.
      onPress: () =>
        Alert.alert(
          "BPM",
          `The BPM for ${songClause} is estimated automatically, and can be wrong. ` +
            "It may also be displayed at double or half time than the real tempo of the song."
        ),
    });
  if (metadata.genre)
    chips.push({
      icon: "musical-notes-outline",
      label: metadata.genre,
      onPress: () =>
        Alert.alert("Genre", `The genre for ${songClause} is ${metadata.genre}.`),
    });
  if (metadata.releaseYear)
    chips.push({
      icon: "calendar-outline",
      label: String(metadata.releaseYear),
      onPress: () =>
        Alert.alert(
          "Release Year",
          `${songClause} was released in ${metadata.releaseYear}.`
        ),
    });
  if (durationText)
    chips.push({
      icon: "time-outline",
      label: durationText,
      onPress: () =>
        Alert.alert("Song Length", `${songClause} is ${durationText} long.`),
    });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Song Info</Text>

      {/* Tessitura - the most useful part for a singer, so it leads.
          The whole card is tappable to open the explainer; the note buttons
          inside capture their own taps and play instead. */}
      {showTessitura && (
        <TouchableOpacity
          style={styles.tessituraCard}
          onPress={() => setTessituraInfoVisible(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Learn more about tessitura"
        >
          <View style={styles.tessituraHeader}>
            <Ionicons name="pulse-outline" size={18} color={colors.primary} />
            <Text style={styles.tessituraTitle}>Where the voice sits - Tessitura</Text>
            <Ionicons
              name="information-circle-outline"
              size={19}
              color={colors.primary}
              style={styles.tessituraInfoIcon}
            />
          </View>

          <View style={styles.tessituraRow}>
            <TessituraNote
              note={metadata.tessituraLow!}
              onPlay={onPlayNote}
              styles={styles}
              colors={colors}
            />
            <Text style={styles.tessituraDash}>–</Text>
            <TessituraNote
              note={metadata.tessituraHigh!}
              onPlay={onPlayNote}
              styles={styles}
              colors={colors}
            />
          </View>

          {/* Centred (median) note - tappable to hear it too */}
          {onPlayNote ? (
            <TouchableOpacity
              style={styles.tessituraCentreRow}
              onPress={() => onPlayNote(metadata.tessituraMedian!)}
              accessibilityRole="button"
              accessibilityLabel={`Play ${metadata.tessituraMedian}`}
            >
              <Text style={styles.tessituraCentre}>
                Centred on {metadata.tessituraMedian}
              </Text>
              <Ionicons name="volume-high-outline" size={15} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.tessituraCentre}>
              Centred on {metadata.tessituraMedian}
            </Text>
          )}

          <Text style={styles.tessituraHint}>
            Most of this song lives in this range. The full vocal range above
            includes notes that are only touched briefly.
          </Text>
        </TouchableOpacity>
      )}

      {/* Key is an ESTIMATE, so it's labelled as one and colour-graded by
          whether independent sources actually agreed on it - a single
          source's own confidence number isn't trustworthy on its own (see
          util/songMetadata.ts), so the badge reflects agreement, not that. */}
      {metadata.songKey && (
        <View style={styles.keyCard}>
          <View style={styles.keyRow}>
            <Ionicons name="key-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.keyLabel}>Estimated key</Text>
            <Text style={styles.keyValue}>{metadata.songKey}</Text>
            <TouchableOpacity
              style={[styles.keyTierBadge, { backgroundColor: `${tierColor}22` }]}
              onPress={() =>
                Alert.alert(
                  "Key confidence",
                  keyConfidenceDetail(
                    metadata.songKey,
                    metadata.keyConfidence,
                    metadata.keySourcesChecked,
                    metadata.keySourcesAgree
                  ) ?? ""
                )
              }
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={
                keyPercent !== null
                  ? `Key confidence ${keyPercent} percent. Tap for details.`
                  : "Key confidence details"
              }
            >
              <Text style={[styles.keyTierText, { color: tierColor }]}>
                {keyPercent !== null ? `${keyPercent}%` : TIER_LABEL[keyTier]}
              </Text>
              <Ionicons name="information-circle-outline" size={12} color={tierColor} />
            </TouchableOpacity>
          </View>
          <Text style={styles.keyHint}>
            {keyEmotionalCharacter(metadata.songKey, metadata.bpm)}
          </Text>
        </View>
      )}

      {chips.length > 0 && (
        <View style={styles.chipRow}>
          {chips.map((chip) =>
            chip.onPress ? (
              <TouchableOpacity
                key={chip.label}
                style={styles.chip}
                onPress={chip.onPress}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Ionicons name={chip.icon} size={14} color={colors.textSecondary} />
                <Text style={styles.chipText}>{chip.label}</Text>
                <Ionicons
                  name="information-circle-outline"
                  size={13}
                  color={colors.textTertiary}
                  style={styles.chipInfoIcon}
                />
              </TouchableOpacity>
            ) : (
              <View key={chip.label} style={styles.chip}>
                <Ionicons name={chip.icon} size={14} color={colors.textSecondary} />
                <Text style={styles.chipText}>{chip.label}</Text>
              </View>
            )
          )}
          {metadata.explicit === true && (
            <View style={[styles.chip, styles.explicitChip]}>
              <Text style={styles.explicitText}>EXPLICIT</Text>
            </View>
          )}
        </View>
      )}

      {tempoText && bpmText && <Text style={styles.tempoNote}>{tempoText}</Text>}

      {/* Tessitura explainer */}
      <Modal
        visible={isTessituraInfoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTessituraInfoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Tessitura</Text>
                <Text style={styles.modalPron}>
                  tess-ih-TOOR-ah · from Italian
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setTessituraInfoVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalLabel}>What it means</Text>
              <Text style={styles.modalBody}>
                Tessitura is the part of a song's range where the melody spends
                most of its time. It's the notes you sing again and again,
                rather than the single highest or lowest notes that might only
                be hit once.
              </Text>

              <Text style={styles.modalLabel}>Where the word comes from</Text>
              <Text style={styles.modalBody}>
                It's the Italian word for “texture”, from the Latin texere, “to
                weave”. Musicians borrowed it to describe the overall weave or
                feel of a vocal line, where it naturally sits, instead of just
                its outer limits.
              </Text>

              <Text style={styles.modalLabel}>Why it matters</Text>
              <Text style={styles.modalBody}>
                Two songs can share the exact same lowest and highest notes yet
                feel completely different to sing. A song whose tessitura sits
                high will feel tiring even if you can technically reach every
                note, while a comfortable tessitura makes even a wide-ranging
                song feel easy. For judging whether a song suits your voice,
                tessitura is often more telling than the full range.
              </Text>

              <Text style={styles.modalLabel}>How we work it out</Text>
              <Text style={styles.modalBody}>
                We look at every note in the melody and take the middle band
                where most of them fall (the 25th to 75th percentile). The
                centre figure is the median, the single pitch the song revolves
                around most.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setTessituraInfoVisible(false)}
            >
              <Text style={styles.modalCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

/** A tessitura note, tappable to hear it when playback is available. */
const TessituraNote = ({
  note,
  onPlay,
  styles,
  colors,
}: {
  note: string;
  onPlay?: (note: string) => void;
  styles: any;
  colors: any;
}) => {
  if (!onPlay) return <Text style={styles.tessituraNote}>{note}</Text>;
  return (
    <TouchableOpacity
      style={styles.tessituraNoteButton}
      onPress={() => onPlay(note)}
      accessibilityRole="button"
      accessibilityLabel={`Play ${note}`}
    >
      <Text style={styles.tessituraNote}>{note}</Text>
      <Ionicons name="volume-high-outline" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    section: {
      paddingHorizontal: 20,
      marginBottom: 30,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: "bold",
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      marginBottom: 15,
    },
    tessituraCard: {
      backgroundColor: colors.backgroundCard,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: 14,
    },
    tessituraHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    tessituraTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      marginLeft: 6,
    },
    tessituraInfoIcon: {
      marginLeft: "auto",
    },
    tessituraRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    tessituraCentreRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      marginTop: 4,
      paddingVertical: 2,
    },
    tessituraNoteButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
    tessituraNote: {
      fontSize: 26,
      fontWeight: "bold",
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      marginRight: 4,
    },
    tessituraDash: {
      fontSize: 24,
      color: colors.textTertiary,
      marginHorizontal: 10,
    },
    tessituraCentre: {
      fontSize: 15,
      color: colors.primary,
      fontFamily: FONTS.primary,
      textAlign: "center",
      fontWeight: "600",
      marginTop: 4,
    },
    tessituraHint: {
      fontSize: 12,
      color: colors.textTertiary,
      fontFamily: FONTS.primary,
      textAlign: "center",
      marginTop: 10,
      lineHeight: 17,
    },
    keyCard: {
      backgroundColor: colors.backgroundCard,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: 14,
    },
    keyRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    keyLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      marginLeft: 6,
      flex: 1,
    },
    keyValue: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
    },
    keyTierBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginLeft: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 10,
    },
    keyTierText: {
      fontSize: 12,
      fontWeight: "700",
      fontFamily: FONTS.primary,
    },
    keyHint: {
      fontSize: 12,
      color: colors.textTertiary,
      fontFamily: FONTS.primary,
      marginTop: 8,
      lineHeight: 17,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 12,
      marginRight: 8,
      marginBottom: 8,
    },
    chipText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      marginLeft: 5,
      fontWeight: "500",
    },
    chipInfoIcon: {
      marginLeft: 6,
    },
    explicitChip: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.textTertiary,
    },
    explicitText: {
      fontSize: 11,
      color: colors.textTertiary,
      fontFamily: FONTS.primary,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    tempoNote: {
      fontSize: 12,
      color: colors.textTertiary,
      fontFamily: FONTS.primary,
      marginTop: 2,
      lineHeight: 17,
    },

    // Tessitura explainer modal
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    modalCard: {
      backgroundColor: colors.backgroundCard,
      borderRadius: 18,
      padding: 22,
      width: "100%",
      maxHeight: "78%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
    },
    modalPron: {
      fontSize: 13,
      color: colors.textTertiary,
      fontFamily: FONTS.primary,
      fontStyle: "italic",
      marginTop: 2,
    },
    modalScroll: {
      marginBottom: 4,
    },
    modalLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
      fontFamily: FONTS.primary,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 16,
      marginBottom: 6,
    },
    modalBody: {
      fontSize: 14.5,
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      lineHeight: 21,
    },
    modalCloseButton: {
      backgroundColor: colors.primary,
      paddingVertical: 13,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 18,
    },
    modalCloseText: {
      color: colors.buttonText,
      fontSize: 15,
      fontWeight: "bold",
      fontFamily: FONTS.primary,
    },
  });

export default SongMetadataCard;
