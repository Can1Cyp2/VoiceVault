// File: app/components/Settings/VocalRangeEditModal.tsx
//
// "Vocal Range" category popup: manually edit the lowest note, highest note
// and voice type. Saves through the existing submitVocalRange logic (which
// validates, upserts, and records range history).

import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { FONTS } from "../../styles/theme";
import { useTheme } from "../../contexts/ThemeContext";
import { NOTES } from "../../util/vocalRange";
import { supabase } from "../../util/supabase";
import { submitVocalRange } from "../../screens/UserVocalRange/UserVocalRangeLogic";

// Notes users can actually sing; skip the extreme sub-bass octave 0.
const SELECTABLE_NOTES = NOTES.filter((note) => !note.endsWith("0"));

// "" means Auto: leave voice_type null so the app derives it from the range.
const VOICE_TYPE_OPTIONS = [
  { label: "Auto (Based on Range)", value: "" },
  { label: "Bass", value: "Bass" },
  { label: "Baritone", value: "Baritone" },
  { label: "Tenor", value: "Tenor" },
  { label: "Alto", value: "Alto" },
  { label: "Mezzo-Soprano", value: "Mezzo-Soprano" },
  { label: "Soprano", value: "Soprano" },
  { label: "Countertenor / Alto", value: "Countertenor / Alto" },
  { label: "Baritone / Tenor", value: "Baritone / Tenor" },
  { label: "Soprano / High Voice", value: "Soprano / High Voice" },
  { label: "Bass / Low Voice", value: "Bass / Low Voice" },
  { label: "Unknown", value: "Unknown" },
];

const RANGE_CHANGE_REASONS = [
  { label: "Learning how to sing", value: "Learning how to sing" },
  { label: "Incorrect analysis", value: "Incorrect analysis" },
  { label: "Voice has improved", value: "Voice has improved" },
  { label: "Temporary vocal condition (e.g. cold/fatigue)", value: "Temporary vocal condition" },
  { label: "Testing different range", value: "Testing different range" },
  { label: "Other", value: "Other" },
];

const showVoiceTypeGuide = () => {
  Alert.alert(
    "Voice Type Guide",
    "Voice type is an estimate based on your detected range, but you can also set it manually if needed.\n\nCommon ranges:\nBass: E2 - E4\nBaritone: A2 - F4\nTenor: C3 - A4\nAlto: F3 - D5\nMezzo-Soprano: A3 - F5\nSoprano: C4 - A5",
    [{ text: "OK" }]
  );
};

type VocalRangeEditModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export default function VocalRangeEditModal({
  visible,
  onClose,
  onSaved,
}: VocalRangeEditModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [lowNote, setLowNote] = useState("C3");
  const [highNote, setHighNote] = useState("C5");
  const [voiceType, setVoiceType] = useState(""); // "" = Auto
  const [originalVoiceType, setOriginalVoiceType] = useState("");
  const [rangeChangeReason, setRangeChangeReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const hasVoiceTypeChanged = voiceType !== originalVoiceType;

  useEffect(() => {
    if (!visible) return;

    setRangeChangeReason("");

    const loadCurrentRange = async () => {
      const user = supabase.auth.user();
      if (!user) return;

      const { data } = await supabase
        .from("user_vocal_ranges")
        .select("min_range, max_range, voice_type")
        .eq("user_id", user.id)
        .single();

      if (data) {
        if (data.min_range && data.min_range !== "C0") setLowNote(data.min_range);
        if (data.max_range && data.max_range !== "C0") setHighNote(data.max_range);
        const loadedVoiceType = data.voice_type || "";
        setVoiceType(loadedVoiceType);
        setOriginalVoiceType(loadedVoiceType);
      }
    };

    void loadCurrentRange();
  }, [visible]);

  const handleSave = async () => {
    if (NOTES.indexOf(lowNote) >= NOTES.indexOf(highNote)) {
      Alert.alert("Invalid Range", "The highest note must be above the lowest note.");
      return;
    }

    if (hasVoiceTypeChanged && !rangeChangeReason) {
      Alert.alert("Reason Required", "Please select why you are switching your voice type.");
      return;
    }

    setIsSaving(true);
    try {
      await submitVocalRange(
        lowNote,
        highNote,
        voiceType || null,
        hasVoiceTypeChanged ? rangeChangeReason : "manual"
      );
      onSaved();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const renderNotePicker = (
    label: string,
    value: string,
    onChange: (note: string) => void
  ) => (
    <View style={styles.pickerBlock}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={value}
          onValueChange={(v) => onChange(String(v))}
          style={styles.picker}
          itemStyle={{ color: colors.textPrimary }}
          dropdownIconColor={colors.textPrimary}
        >
          {SELECTABLE_NOTES.map((note) => (
            <Picker.Item key={note} label={note} value={note} color={Platform.OS === "android" ? colors.textPrimary : undefined} />
          ))}
        </Picker>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Vocal Range</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close vocal range editor"
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            Set your comfortable lowest and highest notes. Leave voice type on
            Auto to calculate it from your range.
          </Text>

          <View style={styles.pickerRow}>
            {renderNotePicker("Lowest", lowNote, setLowNote)}
            {renderNotePicker("Highest", highNote, setHighNote)}
          </View>

          <View style={styles.voiceTypeLabelRow}>
            <Text style={styles.pickerLabel}>Voice Type</Text>
            <TouchableOpacity
              onPress={showVoiceTypeGuide}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="information-circle-outline" size={17} color={colors.link} />
            </TouchableOpacity>
          </View>
          <View style={[styles.pickerWrap, styles.pickerBlock]}>
            <Picker
              selectedValue={voiceType}
              onValueChange={(v) => setVoiceType(String(v))}
              style={styles.picker}
              itemStyle={{ color: colors.textPrimary }}
              dropdownIconColor={colors.textPrimary}
            >
              {VOICE_TYPE_OPTIONS.map((option) => (
                <Picker.Item
                  key={option.label}
                  label={option.label}
                  value={option.value}
                  color={Platform.OS === "android" ? colors.textPrimary : undefined}
                />
              ))}
            </Picker>
          </View>

          {hasVoiceTypeChanged && (
            <View style={styles.pickerBlock}>
              <Text style={styles.pickerLabel}>Reason for Changing Voice Type</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={rangeChangeReason}
                  onValueChange={(v) => setRangeChangeReason(String(v))}
                  style={styles.picker}
                  itemStyle={{ color: colors.textPrimary }}
                  dropdownIconColor={colors.textPrimary}
                >
                  <Picker.Item label="Select a reason" value="" color={Platform.OS === "android" ? colors.textPrimary : undefined} />
                  {RANGE_CHANGE_REASONS.map((option) => (
                    <Picker.Item
                      key={option.label}
                      label={option.label}
                      value={option.value}
                      color={Platform.OS === "android" ? colors.textPrimary : undefined}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Save Range"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: typeof import("../../styles/theme").LightColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
    },
    content: {
      backgroundColor: colors.backgroundCard,
      borderRadius: 20,
      width: "92%",
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 20,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      fontSize: 22,
      fontWeight: "bold",
      fontFamily: FONTS.primary,
      color: colors.textPrimary,
    },
    hint: {
      fontSize: 13,
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      lineHeight: 19,
      marginTop: 6,
      marginBottom: 12,
    },
    pickerRow: {
      flexDirection: "row",
      gap: 12,
    },
    pickerBlock: {
      flex: 1,
      marginBottom: 12,
    },
    pickerLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    voiceTypeLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 6,
    },
    pickerWrap: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: "hidden",
      justifyContent: "center",
    },
    picker: {
      color: colors.textPrimary,
      ...(Platform.OS === "android" ? {} : { height: 160 }),
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 6,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: "bold",
      fontFamily: FONTS.primary,
    },
  });
