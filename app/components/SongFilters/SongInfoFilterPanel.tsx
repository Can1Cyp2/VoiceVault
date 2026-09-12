// app/components/SongFilters/SongInfoFilterPanel.tsx
//
// "Song Info" side popup - narrows search/browse results by the extra
// metadata columns (bpm, genre, release_year, duration_sec, song_key,
// tessitura_*) added by supabase/migrations/20260721_add_song_metadata.sql.
//
// Opened from the Song Info row INSIDE SongFilterModal, and edits that
// modal's draft in place - so Save/Cancel on the parent popup governs these
// selections too, rather than this panel having its own competing save.
//
// Rendered as an absolute overlay inside the parent's Modal rather than as
// its own Modal (see the comment on the return statement), and the
// slide-in-from-the-right is animated by hand with Animated.timing on
// translateX - RN gives no directional slide for free.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { fetchDistinctGenres, fetchDistinctKeys } from "../../util/api";
import {
  DEFAULT_SONG_INFO_FILTERS,
  hasCustomBpmRange,
  LENGTH_BUCKETS,
  LengthBucket,
  SongInfoFilters,
  TEMPO_BANDS,
  TempoBand,
} from "../../util/songFilters";
import { formatTempoBandRange } from "../../util/songMetadata";

const ANIM_MS = 240;

type CategoryKey = "bpm" | "genre" | "year" | "length" | "key" | "tessitura";

// Plain-language explanation behind each category's "i". Kept here rather
// than inline in the render so the wording is easy to find and revise, and
// so every category is guaranteed to have one.
const CATEGORY_INFO: Record<CategoryKey, { title: string; body: string }> = {
  bpm: {
    title: "About BPM",
    body:
      "BPM (beats per minute) is how fast a song moves. Higher numbers mean a faster song, and it is the number you would set a metronome to.\n\n" +
      "For a rough sense of scale: a slow ballad often sits near 60 to 75, most pop and rock lands around 100 to 130, and dance or punk frequently runs 140 and above.\n\n" +
      "Pick a band for a quick filter, or type an exact minimum and maximum if you have a specific tempo in mind. A typed range replaces the bands rather than combining with them.",
  },
  genre: {
    title: "About Genre",
    body:
      "The broad style a song is categorised under. Genres come from the music data we import, so they are fairly coarse - a song may reasonably belong to more than one and only be listed under one of them.\n\n" +
      "The list here only shows genres that songs in VoiceVault actually use.",
  },
  year: {
    title: "About Year",
    body:
      "The year the song was originally released, not the year of a later remaster or re-recording.\n\n" +
      "Leave either box empty to search from or up to any year - for example, filling only the first box finds everything from that year onwards.",
  },
  length: {
    title: "About Length",
    body:
      "How long the recording runs, in minutes.\n\n" +
      "Handy for finding something short enough for a quick practice session, or filtering out extended versions and live recordings that run much longer than the original.",
  },
  key: {
    title: "About estimated keys",
    body:
      "A song's key is worked out automatically from its notes, not confirmed by a person - it is always an estimate. Some songs have it cross-checked by more than one method and some do not.\n\n" +
      "Filtering by key will occasionally exclude or include a song based on a guess that turns out to be wrong. A song's own page shows how confident the estimate is.",
  },
  // Condensed from the full explainer on the Song Details screen (see the
  // tessitura modal in SongMetadataCard.tsx). Keeps the two plain-English
  // sections, "what it means" and "why it matters", and drops the etymology
  // and percentile method, which are not what someone picking a filter needs.
  tessitura: {
    title: "What is tessitura?",
    body:
      "Tessitura is the part of a song's range where the melody spends most of its time. It's the notes you sing again and again, rather than the single highest or lowest notes that might only be hit once.\n\n" +
      "Two songs can share the exact same lowest and highest notes yet feel completely different to sing, so for judging whether a song suits your voice, tessitura is often more telling than the full range.\n\n" +
      "Not every song has it worked out yet.",
  },
};

type SongInfoFilterPanelProps = {
  visible: boolean;
  filters: SongInfoFilters;
  /** Hands the edited selections back to the parent popup's draft. */
  onApply: (filters: SongInfoFilters) => void;
  onCancel: () => void;
};

export default function SongInfoFilterPanel({
  visible,
  filters,
  onApply,
  onCancel,
}: SongInfoFilterPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [draft, setDraft] = useState<SongInfoFilters>(filters);
  const [expanded, setExpanded] = useState<Set<CategoryKey>>(new Set());
  const [genreOptions, setGenreOptions] = useState<string[]>([]);
  const [keyOptions, setKeyOptions] = useState<string[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  // Which category's "i" explainer is open, if any.
  const [infoFor, setInfoFor] = useState<CategoryKey | null>(null);

  // Mount immediately, unmount only after the slide-out animation finishes,
  // so the panel is visually gone before React actually removes it.
  const [mounted, setMounted] = useState(visible);
  const translateX = useRef(new Animated.Value(1)).current; // 1 = offscreen right, 0 = open

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setMounted(true);
      translateX.setValue(1);
      Animated.timing(translateX, {
        toValue: 0,
        duration: ANIM_MS,
        useNativeDriver: true,
      }).start();

      if (genreOptions.length === 0 && keyOptions.length === 0) {
        setOptionsLoading(true);
        Promise.all([fetchDistinctGenres(), fetchDistinctKeys()])
          .then(([genres, keys]) => {
            setGenreOptions(genres);
            setKeyOptions(keys);
          })
          .finally(() => setOptionsLoading(false));
      }
    } else if (mounted) {
      Animated.timing(translateX, {
        toValue: 1,
        duration: ANIM_MS,
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const update = (changes: Partial<SongInfoFilters>) =>
    setDraft((prev) => ({ ...prev, ...changes }));

  const toggleExpanded = (key: CategoryKey) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleInArray = <T,>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const animatedClose = (after: () => void) => {
    Animated.timing(translateX, {
      toValue: 1,
      duration: ANIM_MS,
      useNativeDriver: true,
    }).start(() => after());
  };

  const validateAndSave = () => {
    const yearMinNum = draft.yearMin.trim() ? parseInt(draft.yearMin, 10) : null;
    const yearMaxNum = draft.yearMax.trim() ? parseInt(draft.yearMax, 10) : null;
    if (draft.yearMin.trim() && Number.isNaN(yearMinNum)) {
      Alert.alert("Invalid year", "Enter a whole number, e.g. 1999.");
      return;
    }
    if (draft.yearMax.trim() && Number.isNaN(yearMaxNum)) {
      Alert.alert("Invalid year", "Enter a whole number, e.g. 2024.");
      return;
    }
    if (yearMinNum !== null && yearMaxNum !== null && yearMinNum > yearMaxNum) {
      Alert.alert("Invalid year range", "The starting year must be before the ending year.");
      return;
    }

    const bpmMinNum = draft.bpmMin.trim() ? parseInt(draft.bpmMin, 10) : null;
    const bpmMaxNum = draft.bpmMax.trim() ? parseInt(draft.bpmMax, 10) : null;
    if (bpmMinNum !== null && bpmMaxNum !== null && bpmMinNum > bpmMaxNum) {
      Alert.alert("Invalid BPM range", "The minimum BPM must be lower than the maximum.");
      return;
    }

    animatedClose(() => onApply(draft));
  };

  const handleCancel = () => animatedClose(onCancel);

  if (!mounted) return null;

  const translateXInterpolated = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 400],
  });

  const renderValueChip = (label: string, selected: boolean, onPress: () => void, key: string) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ pressed }) => [
        styles.valueChip,
        { borderColor: colors.border, backgroundColor: colors.backgroundTertiary },
        selected && { backgroundColor: colors.primary, borderColor: colors.primary },
        pressed && styles.pressed,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <Text
        style={[
          styles.valueChipText,
          { color: selected ? colors.buttonText : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  const renderCategoryRow = (opts: {
    key: CategoryKey;
    emoji: string;
    label: string;
    hasValue: boolean;
    onToggleHas: () => void;
    countBadge?: number;
    expandable?: boolean;
  }) => {
    const isExpanded = expanded.has(opts.key);
    return (
      <View style={[styles.categoryBlock, { borderColor: colors.borderLight }]}>
        <View style={styles.categoryRow}>
          <Pressable
            style={styles.categoryMain}
            onPress={opts.onToggleHas}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: opts.hasValue }}
            accessibilityLabel={`Only songs with ${opts.label.toLowerCase()} info`}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: opts.hasValue ? colors.primary : colors.border },
                opts.hasValue && { backgroundColor: colors.primary },
              ]}
            >
              {opts.hasValue && <Ionicons name="checkmark" size={14} color={colors.buttonText} />}
            </View>
            <Text style={styles.categoryEmoji}>{opts.emoji}</Text>
            <Text style={[styles.categoryLabel, { color: colors.textPrimary }]}>{opts.label}</Text>
            {!!opts.countBadge && (
              <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.countBadgeText}>{opts.countBadge}</Text>
              </View>
            )}
          </Pressable>

          {/* Every category gets an explainer - see CATEGORY_INFO */}
          <Pressable
            onPress={() => setInfoFor(opts.key)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`What does ${opts.label} mean?`}
          >
            <Ionicons name="information-circle-outline" size={19} color={colors.link} />
          </Pressable>

          {opts.expandable !== false && (
            <Pressable
              onPress={() => toggleExpanded(opts.key)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Narrow ${opts.label} to specific values`}
              style={styles.gearButton}
            >
              <Ionicons
                name="settings-outline"
                size={18}
                color={isExpanded ? colors.primary : colors.textTertiary}
              />
            </Pressable>
          )}
        </View>

        {isExpanded && opts.expandable !== false && (
          <View style={styles.expandedSection}>{renderExpandedContent(opts.key)}</View>
        )}
      </View>
    );
  };

  const renderExpandedContent = (key: CategoryKey) => {
    switch (key) {
      case "genre":
        return (
          <View style={styles.valueChipRow}>
            {optionsLoading ? (
              <Text style={[styles.loadingHint, { color: colors.textTertiary }]}>
                Loading genres...
              </Text>
            ) : genreOptions.length === 0 ? (
              <Text style={[styles.loadingHint, { color: colors.textTertiary }]}>
                No genres found yet.
              </Text>
            ) : (
              genreOptions.map((g) =>
                renderValueChip(g, draft.genres.includes(g), () =>
                  update({ genres: toggleInArray(draft.genres, g) }), g)
              )
            )}
          </View>
        );

      case "key":
        return (
          <View style={styles.valueChipRow}>
            {optionsLoading ? (
              <Text style={[styles.loadingHint, { color: colors.textTertiary }]}>
                Loading keys...
              </Text>
            ) : keyOptions.length === 0 ? (
              <Text style={[styles.loadingHint, { color: colors.textTertiary }]}>
                No estimated keys found yet.
              </Text>
            ) : (
              keyOptions.map((k) =>
                renderValueChip(k, draft.keys.includes(k), () =>
                  update({ keys: toggleInArray(draft.keys, k) }), k)
              )
            )}
          </View>
        );

      case "bpm": {
        const customActive = hasCustomBpmRange(draft);
        return (
          <View>
            {/* Preset bands, labelled with the actual numbers they cover so
                "Upbeat" is never a vague word on its own. */}
            <View style={[styles.valueChipRow, customActive && styles.dimmed]}>
              {TEMPO_BANDS.map((band: TempoBand) =>
                renderValueChip(
                  `${band} (${formatTempoBandRange(band)})`,
                  draft.tempoBands.includes(band),
                  () => update({ tempoBands: toggleInArray(draft.tempoBands, band) }),
                  band
                )
              )}
            </View>

            <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
              Or type an exact range
            </Text>
            <View style={styles.yearRow}>
              <TextInput
                style={[
                  styles.yearInput,
                  { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBackground },
                ]}
                value={draft.bpmMin}
                onChangeText={(v) => update({ bpmMin: v.replace(/[^0-9]/g, "") })}
                placeholder="Min, e.g. 90"
                placeholderTextColor={colors.textPlaceholder}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={{ color: colors.textTertiary }}>to</Text>
              <TextInput
                style={[
                  styles.yearInput,
                  { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBackground },
                ]}
                value={draft.bpmMax}
                onChangeText={(v) => update({ bpmMax: v.replace(/[^0-9]/g, "") })}
                placeholder="Max, e.g. 140"
                placeholderTextColor={colors.textPlaceholder}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
            <Text style={[styles.hintText, { color: colors.textTertiary }]}>
              {customActive
                ? "Using your exact range. The bands above are ignored while this is filled in."
                : "Leave one side empty for an open end, for example 140 with no maximum finds everything 140 and faster."}
            </Text>
          </View>
        );
      }

      case "length":
        return (
          <View style={styles.valueChipRow}>
            {LENGTH_BUCKETS.map((b) =>
              renderValueChip(
                b.label,
                draft.lengthBuckets.includes(b.key),
                () => update({ lengthBuckets: toggleInArray(draft.lengthBuckets, b.key) }),
                b.key
              )
            )}
          </View>
        );

      case "year":
        return (
          <View style={styles.yearRow}>
            <TextInput
              style={[
                styles.yearInput,
                { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBackground },
              ]}
              value={draft.yearMin}
              onChangeText={(v) => update({ yearMin: v.replace(/[^0-9]/g, "") })}
              placeholder="From, e.g. 1999"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="number-pad"
              maxLength={4}
            />
            <Text style={{ color: colors.textTertiary }}>to</Text>
            <TextInput
              style={[
                styles.yearInput,
                { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBackground },
              ]}
              value={draft.yearMax}
              onChangeText={(v) => update({ yearMax: v.replace(/[^0-9]/g, "") })}
              placeholder="To, e.g. 2024"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        );

      default:
        return null;
    }
  };

  // Deliberately NOT a <Modal>: this renders inside SongFilterModal's own
  // Modal, and nesting Modals is a known source of presentation bugs on iOS
  // (the inner one can fail to appear, or appear then immediately dismiss).
  // An absolutely-positioned overlay behaves identically here and avoids
  // that class of bug entirely. Rendered last by the parent, so it stacks
  // above the filter popup.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.overlayRow}>
        <Pressable style={styles.overlaySpacer} onPress={validateAndSave} />
        <Animated.View
          style={[
            styles.panel,
            { backgroundColor: colors.backgroundCard, transform: [{ translateX: translateXInterpolated }] },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="albums-outline" size={20} color={colors.primary} />
              <Text style={[styles.title, { color: colors.textPrimary }]}>Song Info</Text>
            </View>
            <Pressable
              onPress={() => setDraft({ ...DEFAULT_SONG_INFO_FILTERS })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Reset song info filters"
            >
              <Text style={[styles.resetText, { color: colors.link }]}>Reset</Text>
            </Pressable>
          </View>

          <View style={[styles.disclaimer, { backgroundColor: `${colors.primary}14` }]}>
            <Ionicons name="information-circle" size={16} color={colors.primary} />
            <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
              Not all songs have this extra info yet, so these filters will show fewer
              results. A song missing here does not mean it is missing from VoiceVault.
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ flex: 1 }}>
            {renderCategoryRow({
              key: "bpm",
              emoji: "🥁",
              label: "BPM",
              hasValue: draft.hasBpm,
              onToggleHas: () => update({ hasBpm: !draft.hasBpm }),
              countBadge: draft.tempoBands.length,
            })}
            {renderCategoryRow({
              key: "genre",
              emoji: "🎭",
              label: "Genre",
              hasValue: draft.hasGenre,
              onToggleHas: () => update({ hasGenre: !draft.hasGenre }),
              countBadge: draft.genres.length,
            })}
            {renderCategoryRow({
              key: "year",
              emoji: "📅",
              label: "Year",
              hasValue: draft.hasYear,
              onToggleHas: () => update({ hasYear: !draft.hasYear }),
              countBadge: draft.yearMin || draft.yearMax ? 1 : 0,
            })}
            {renderCategoryRow({
              key: "length",
              emoji: "⏱️",
              label: "Length",
              hasValue: draft.hasLength,
              onToggleHas: () => update({ hasLength: !draft.hasLength }),
              countBadge: draft.lengthBuckets.length,
            })}
            {renderCategoryRow({
              key: "key",
              emoji: "🎹",
              label: "Key",
              hasValue: draft.hasKey,
              onToggleHas: () => update({ hasKey: !draft.hasKey }),
              countBadge: draft.keys.length,
            })}
            {renderCategoryRow({
              key: "tessitura",
              emoji: "🎯",
              label: "Tessitura",
              hasValue: draft.hasTessitura,
              onToggleHas: () => update({ hasTessitura: !draft.hasTessitura }),
              expandable: false,
            })}
            <View style={{ height: 12 }} />
          </ScrollView>

          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                { borderColor: colors.border, backgroundColor: colors.inputBackground },
                pressed && styles.pressed,
              ]}
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel song info filter changes"
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.saveButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
              ]}
              onPress={validateAndSave}
              accessibilityRole="button"
              accessibilityLabel="Confirm song info selections"
            >
              <Text style={[styles.saveButtonText, { color: colors.buttonText }]}>Done</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>

      {/* Shared explainer for whichever category's "i" was tapped. Also an
          absolute overlay rather than a Modal, for the same reason as above -
          it would otherwise be a Modal nested two levels deep. */}
      {infoFor !== null && (
        <Pressable style={styles.infoOverlay} onPress={() => setInfoFor(null)}>
          <Pressable style={[styles.infoCard, { backgroundColor: colors.backgroundCard }]} onPress={() => {}}>
            <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>
              {CATEGORY_INFO[infoFor].title}
            </Text>
            <Text style={[styles.infoBody, { color: colors.textSecondary }]}>
              {CATEGORY_INFO[infoFor].body}
            </Text>
            <Pressable
              style={[styles.infoCloseButton, { backgroundColor: colors.primary }]}
              onPress={() => setInfoFor(null)}
            >
              <Text style={[styles.infoCloseText, { color: colors.buttonText }]}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (colors: typeof import("../../styles/theme").LightColors) =>
  StyleSheet.create({
    overlayRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.overlay,
    },
    overlaySpacer: {
      flex: 1,
    },
    // A compact card sliding in from the right, not a full-height drawer -
    // it is a sub-popup of the filter modal, so it should read as smaller
    // than its parent rather than swallowing the screen.
    panel: {
      width: "90%",
      maxWidth: 400,
      maxHeight: "82%",
      marginRight: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: -2, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 10,
    },
    pressed: { opacity: 0.7 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: { fontSize: 18, fontWeight: "bold" },
    resetText: { fontSize: 14, fontWeight: "600" },
    disclaimer: {
      flexDirection: "row",
      gap: 8,
      borderRadius: 10,
      padding: 10,
      marginBottom: 12,
      alignItems: "flex-start",
    },
    disclaimerText: { flex: 1, fontSize: 12, lineHeight: 17 },
    categoryBlock: {
      borderBottomWidth: 1,
      paddingVertical: 10,
    },
    categoryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    categoryMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryEmoji: { fontSize: 17 },
    categoryLabel: { fontSize: 15, fontWeight: "600", flex: 1 },
    countBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      alignItems: "center",
      justifyContent: "center",
    },
    countBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    gearButton: { padding: 4 },
    expandedSection: {
      marginTop: 10,
      marginLeft: 28,
    },
    valueChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
    },
    valueChip: {
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    valueChipText: { fontSize: 12.5, fontWeight: "600" },
    loadingHint: { fontSize: 12.5, fontStyle: "italic" },
    // Bands are visibly de-emphasised while an exact range overrides them.
    dimmed: { opacity: 0.4 },
    subLabel: {
      fontSize: 12,
      fontWeight: "600",
      marginTop: 12,
      marginBottom: 6,
    },
    hintText: { fontSize: 11.5, lineHeight: 16, marginTop: 6 },
    yearRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    yearInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
    },
    buttonRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    button: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
    cancelButton: { borderWidth: 1 },
    cancelButtonText: { fontSize: 15, fontWeight: "600" },
    saveButton: {},
    saveButtonText: { fontSize: 15, fontWeight: "bold" },
    // Absolutely positioned rather than flex:1, since this is no longer
    // inside its own Modal (see the comment on the explainer's render).
    infoOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    infoCard: { borderRadius: 14, padding: 18, width: "100%", maxWidth: 380 },
    infoTitle: { fontSize: 17, fontWeight: "700", marginBottom: 10 },
    infoBody: { fontSize: 13.5, lineHeight: 20 },
    infoCloseButton: { marginTop: 16, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
    infoCloseText: { fontSize: 14, fontWeight: "700" },
  });
