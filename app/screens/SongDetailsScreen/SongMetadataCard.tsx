// app/screens/SongDetailsScreen/SongMetadataCard.tsx
//
// Shows the extra facts about a song: where the voice sits (tessitura), tempo,
// genre, year, length and the explicit flag.
//
// This data is populated in bulk and is missing for plenty of songs, so the
// component renders NOTHING at all rather than a card full of dashes when
// there is nothing to say. Each row inside is likewise conditional.

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from "react-native";
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
  relativeKey,
  KEY_HEDGE_THRESHOLD,
} from "../../util/songMetadata";

type Props = {
  metadata: SongMetadata | null;
  /** Plays a reference note - reused from the parent screen. */
  onPlayNote?: (note: string) => void;
};

const SongMetadataCard: React.FC<Props> = ({ metadata, onPlayNote }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isTessituraInfoVisible, setTessituraInfoVisible] = useState(false);

  if (!hasAnyMetadata(metadata)) return null;

  const bpmText = formatBpm(metadata.bpm);
  const tempoWord = describeTempo(metadata.bpm);
  const durationText = formatDuration(metadata.durationSec);
  const showTessitura = hasTessitura(metadata);

  // Chips: only the facts we actually have.
  const chips: { icon: any; label: string }[] = [];
  if (bpmText) chips.push({ icon: "speedometer-outline", label: bpmText });
  if (metadata.genre) chips.push({ icon: "musical-notes-outline", label: metadata.genre });
  if (metadata.releaseYear) chips.push({ icon: "calendar-outline", label: String(metadata.releaseYear) });
  if (durationText) chips.push({ icon: "time-outline", label: durationText });

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
            <Text style={styles.tessituraTitle}>Where the voice sits</Text>
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

          <View style={styles.tessituraLearnMore}>
            <Text style={styles.tessituraLearnMoreText}>What is tessitura?</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
          </View>
        </TouchableOpacity>
      )}

      {/* Key is an ESTIMATE derived from tab data, so it is labelled as one
          and shows the relative key (same seven notes) as the alternative -
          that is the most likely way for the estimate to be wrong. */}
      {metadata.songKey && (
        <View style={styles.keyCard}>
          <View style={styles.keyRow}>
            <Ionicons name="key-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.keyLabel}>Estimated key</Text>
            <Text style={styles.keyValue}>{metadata.songKey}</Text>
          </View>
          <Text style={styles.keyHint}>
            {metadata.keyConfidence !== null &&
            metadata.keyConfidence < KEY_HEDGE_THRESHOLD
              ? `Worked out from the song's notes, but not certain — it may be ${
                  relativeKey(metadata.songKey) ?? "a related key"
                }.`
              : `Worked out from the song's notes. If it sounds off, try ${
                  relativeKey(metadata.songKey) ?? "the relative key"
                } — it uses the same notes.`}
          </Text>
        </View>
      )}

      {chips.length > 0 && (
        <View style={styles.chipRow}>
          {chips.map((chip) => (
            <View key={chip.label} style={styles.chip}>
              <Ionicons name={chip.icon} size={14} color={colors.textSecondary} />
              <Text style={styles.chipText}>{chip.label}</Text>
            </View>
          ))}
          {metadata.explicit === true && (
            <View style={[styles.chip, styles.explicitChip]}>
              <Text style={styles.explicitText}>EXPLICIT</Text>
            </View>
          )}
        </View>
      )}

      {tempoWord && bpmText && (
        <Text style={styles.tempoNote}>
          {tempoWord} tempo — useful for setting the metronome before you
          practise.
        </Text>
      )}

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
                most of its time — the notes you sing again and again, rather
                than the single highest or lowest notes that might only be hit
                once.
              </Text>

              <Text style={styles.modalLabel}>Where the word comes from</Text>
              <Text style={styles.modalBody}>
                It's the Italian word for “texture”, from the Latin texere, “to
                weave”. Musicians borrowed it to describe the overall weave or
                feel of a vocal line — where it naturally sits — instead of just
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
                where most of them fall (the 25th–75th percentile). The centre
                figure is the median — the single pitch the song revolves around
                most.
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
    tessituraLearnMore: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      marginTop: 12,
    },
    tessituraLearnMoreText: {
      fontSize: 12.5,
      fontWeight: "600",
      color: colors.primary,
      fontFamily: FONTS.primary,
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
