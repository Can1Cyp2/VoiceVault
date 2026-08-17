// app/components/SongFilters/SongFilterModal.tsx
//
// Filter popup for search results, opened from the filter button on the
// Search screen (it replaces the old standalone "In Range" toggle, which
// now lives inside this popup as the hero button up top).
//
// Closing behaviour:
//   * Save or tapping outside the popup -> saves the draft filters
//   * Cancel -> discards the draft and keeps the previous filters
//   * Reset -> sets the draft back to defaults (the classic randomized
//     browse with nothing hidden); still saved on close like any edit

import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { NOTES } from "../../util/vocalRange";
import {
  countActiveSongInfoFilters,
  DEFAULT_SONG_FILTERS,
  SongFilters,
  SongInfoFilters,
} from "../../util/songFilters";
import { showVerifiedRangeInfo } from "../../util/verifiedInfo";
import SongInfoFilterPanel from "./SongInfoFilterPanel";

// Notes users can realistically pick; skip the extreme sub-bass octave 0.
const SELECTABLE_NOTES = NOTES.filter((note) => !note.endsWith("0"));

type SongFilterModalProps = {
  visible: boolean;
  filters: SongFilters;
  isLoggedIn: boolean;
  hasVocalRange: boolean;
  onSave: (filters: SongFilters) => void;
  onCancel: () => void;
  /** Called when a guest tries the "In Range" filter and agrees to log in. */
  onRequireLogin: () => void;
};

export default function SongFilterModal({
  visible,
  filters,
  isLoggedIn,
  hasVocalRange,
  onSave,
  onCancel,
  onRequireLogin,
}: SongFilterModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [draft, setDraft] = useState<SongFilters>(filters);
  // The Song Info options live in their own side panel opened from the row
  // below, but they edit the SAME draft - so they are saved or discarded
  // together with everything else here, rather than having their own
  // separate save that could disagree with Cancel.
  const [songInfoPanelVisible, setSongInfoPanelVisible] = useState(false);

  // Start each session from the saved filters.
  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  // Never leave the sub-panel open behind a closed parent popup.
  useEffect(() => {
    if (!visible) setSongInfoPanelVisible(false);
  }, [visible]);

  const update = (changes: Partial<SongFilters>) =>
    setDraft((prev) => ({ ...prev, ...changes }));

  const toggleInRange = () => {
    if (!isLoggedIn) {
      Alert.alert(
        "Login Required",
        "You need to log in to use the 'In Range' filter. Would you like to log in now?",
        [
          { text: "Yes", onPress: onRequireLogin },
          { text: "No", style: "cancel" },
        ],
        { cancelable: true }
      );
      return;
    }
    if (!draft.inRangeOnly && !hasVocalRange) {
      Alert.alert(
        "No Vocal Range Set",
        "You haven't set your vocal range yet. Please set it in your profile to use this filter."
      );
    }
    update({ inRangeOnly: !draft.inRangeOnly });
  };

  const songInfoCount = countActiveSongInfoFilters(draft.songInfo);

  const validateAndSave = () => {
    if (
      draft.customRangeEnabled &&
      NOTES.indexOf(draft.customRangeMin) >= NOTES.indexOf(draft.customRangeMax)
    ) {
      Alert.alert(
        "Invalid Range",
        "The highest note of the chosen range must be above the lowest note."
      );
      return;
    }
    onSave(draft);
  };

  // Pill-style option: selected = filled orange, unselected = outlined card
  const renderChip = (
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    selected: boolean,
    onPress: () => void
  ) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Ionicons
        name={icon}
        size={16}
        color={selected ? colors.buttonText : colors.textSecondary}
      />
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );

  const renderNotePicker = (
    label: string,
    value: string,
    onChange: (note: string) => void
  ) => (
    <View style={styles.rangePickerBlock}>
      <Text style={styles.rangePickerLabel}>{label}</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={value}
          onValueChange={(v) => onChange(String(v))}
          style={styles.picker}
          itemStyle={{ color: colors.textPrimary }}
          dropdownIconColor={colors.textPrimary}
        >
          {SELECTABLE_NOTES.map((note) => (
            <Picker.Item
              key={note}
              label={note}
              value={note}
              color={Platform.OS === "android" ? colors.textPrimary : undefined}
            />
          ))}
        </Picker>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Android back: dismiss the Song Info sub-panel first if it is open,
      // rather than closing the whole popup out from under it.
      onRequestClose={() => {
        if (songInfoPanelVisible) setSongInfoPanelVisible(false);
        else validateAndSave();
      }}
    >
      {/* Tapping outside the popup saves and closes, like Save */}
      <Pressable style={styles.overlay} onPress={validateAndSave}>
        <Pressable style={styles.panel} onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="options" size={20} color={colors.primary} />
              <Text style={styles.title}>Filter Songs</Text>
            </View>
            <Pressable
              onPress={() => setDraft({ ...DEFAULT_SONG_FILTERS })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => pressed && styles.pressed}
              accessibilityRole="button"
              accessibilityLabel="Reset filters to default"
            >
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Hero: the old In Range toggle, now a big color-state button */}
            <Pressable
              onPress={toggleInRange}
              style={({ pressed }) => [
                styles.inRangeButton,
                draft.inRangeOnly && styles.inRangeButtonActive,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Only songs in your vocal range"
              accessibilityState={{ selected: draft.inRangeOnly }}
            >
              <Ionicons
                name="checkmark-circle"
                size={28}
                color={draft.inRangeOnly ? colors.buttonText : colors.primary}
              />
              <View style={styles.inRangeText}>
                <Text
                  style={[styles.inRangeTitle, draft.inRangeOnly && styles.inRangeTitleActive]}
                >
                  In Range
                </Text>
                <Text
                  style={[styles.inRangeSub, draft.inRangeOnly && styles.inRangeSubActive]}
                >
                  {isLoggedIn
                    ? "Only songs that fit your vocal range"
                    : "Sign in to filter by your vocal range"}
                </Text>
              </View>
              {draft.inRangeOnly && (
                <Ionicons name="checkmark" size={20} color={colors.buttonText} />
              )}
            </Pressable>

            <Text style={styles.sectionLabel}>Sort By</Text>
            <View style={styles.chipRow}>
              {renderChip("Shuffle", "shuffle", !draft.trendingFirst, () =>
                update({ trendingFirst: false })
              )}
              {renderChip("Trending", "trending-up", draft.trendingFirst, () =>
                update({ trendingFirst: true })
              )}
            </View>

            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabelInline}>Song Type</Text>
              <Pressable
                onPress={showVerifiedRangeInfo}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="What does Verified mean?"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons name="information-circle-outline" size={16} color={colors.link} />
              </Pressable>
            </View>
            <View style={styles.chipRow}>
              {renderChip("All Songs", "musical-notes", !draft.verifiedOnly && !draft.userAddedOnly, () =>
                update({ verifiedOnly: false, userAddedOnly: false })
              )}
              {renderChip("Verified", "shield-checkmark", draft.verifiedOnly, () =>
                update({ verifiedOnly: true, userAddedOnly: false })
              )}
              {/* User-added-only filter: hidden for now, there aren't enough
                  community-added songs yet for this to be useful. Re-enable
                  by uncommenting once community uploads pick up.
              {renderChip("User Added", "people", draft.userAddedOnly, () =>
                update({ userAddedOnly: true, verifiedOnly: false })
              )}
              */}
            </View>

            <Text style={styles.sectionLabel}>Note Range</Text>
            <View style={styles.chipRow}>
              {renderChip("Any Range", "infinite", !draft.customRangeEnabled, () =>
                update({ customRangeEnabled: false })
              )}
              {renderChip("Chosen Range", "options", draft.customRangeEnabled, () =>
                update({ customRangeEnabled: true })
              )}
            </View>

            {draft.customRangeEnabled && (
              <View style={styles.rangePickerRow}>
                {renderNotePicker("Lowest", draft.customRangeMin, (note) =>
                  update({ customRangeMin: note })
                )}
                {renderNotePicker("Highest", draft.customRangeMax, (note) =>
                  update({ customRangeMax: note })
                )}
              </View>
            )}

            <Text style={styles.sectionLabel}>Song Info</Text>
            <Pressable
              onPress={() => setSongInfoPanelVisible(true)}
              style={({ pressed }) => [styles.songInfoRow, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Filter by BPM, genre, year, length, key or tessitura"
            >
              <Ionicons name="albums-outline" size={18} color={colors.primary} />
              <View style={styles.songInfoTextBlock}>
                <Text style={styles.songInfoTitle}>BPM, genre, year, length, key</Text>
                <Text style={styles.songInfoSub} numberOfLines={1}>
                  {songInfoCount > 0
                    ? `${songInfoCount} selected`
                    : "Narrow by a song's extra details"}
                </Text>
              </View>
              {songInfoCount > 0 && (
                <View style={styles.songInfoBadge}>
                  <Text style={styles.songInfoBadgeText}>{songInfoCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>
          </ScrollView>

          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel filter changes"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.button, styles.saveButton, pressed && styles.pressed]}
              onPress={validateAndSave}
              accessibilityRole="button"
              accessibilityLabel="Save filters"
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>

      {/* Side panel opened from the Song Info row. Edits draft.songInfo in
          place, so Cancel/Save on THIS popup governs it too. */}
      <SongInfoFilterPanel
        visible={songInfoPanelVisible}
        filters={draft.songInfo}
        onApply={(songInfo: SongInfoFilters) => {
          update({ songInfo });
          setSongInfoPanelVisible(false);
        }}
        onCancel={() => setSongInfoPanelVisible(false)}
      />
    </Modal>
  );
}

const createStyles = (colors: typeof import("../../styles/theme").LightColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: "flex-end",
    },
    // Anchored under the filter button area (top-right of the screen)
    panel: {
      backgroundColor: colors.backgroundCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      width: "88%",
      maxWidth: 400,
      maxHeight: "78%",
      marginTop: 150,
      marginRight: 12,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 8,
    },
    pressed: {
      opacity: 0.7,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    headerTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    resetText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.link,
    },
    inRangeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.backgroundTertiary,
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 6,
    },
    inRangeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    inRangeText: {
      flex: 1,
    },
    inRangeTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    inRangeTitleActive: {
      color: colors.buttonText,
    },
    inRangeSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    inRangeSubActive: {
      color: colors.buttonText,
      opacity: 0.9,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginTop: 14,
      marginBottom: 8,
    },
    sectionLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 14,
      marginBottom: 8,
    },
    sectionLabelInline: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundTertiary,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    chipTextSelected: {
      color: colors.buttonText,
    },
    songInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundTertiary,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    songInfoTextBlock: { flex: 1 },
    songInfoTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    songInfoSub: {
      fontSize: 11.5,
      color: colors.textSecondary,
      marginTop: 2,
    },
    songInfoBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    songInfoBadgeText: {
      color: colors.buttonText,
      fontSize: 11,
      fontWeight: "700",
    },
    rangePickerRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 10,
    },
    rangePickerBlock: {
      flex: 1,
    },
    rangePickerLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    pickerWrap: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: "hidden",
      justifyContent: "center",
    },
    // Matches the picker setup in VocalRangeEditModal, which is known to
    // work on both platforms (iOS UIPickerView misbehaves with non-standard
    // heights or sized itemStyles).
    picker: {
      color: colors.textPrimary,
      ...(Platform.OS === "android" ? {} : { height: 160 }),
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    button: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
    cancelButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: "600",
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    saveButtonText: {
      color: colors.buttonText,
      fontSize: 15,
      fontWeight: "bold",
    },
  });
