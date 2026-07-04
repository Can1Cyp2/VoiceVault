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

const VOICE_TYPES = [
  "Auto",
  "Bass",
  "Baritone",
  "Tenor",
  "Alto",
  "Mezzo-Soprano",
  "Soprano",
];

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
  const [voiceType, setVoiceType] = useState("Auto");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;

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
        setVoiceType(data.voice_type || "Auto");
      }
    };

    void loadCurrentRange();
  }, [visible]);

  const handleSave = async () => {
    if (NOTES.indexOf(lowNote) >= NOTES.indexOf(highNote)) {
      Alert.alert("Invalid Range", "The highest note must be above the lowest note.");
      return;
    }

    setIsSaving(true);
    try {
      // "Auto" leaves voice_type null so the app derives it from the range.
      await submitVocalRange(
        lowNote,
        highNote,
        voiceType === "Auto" ? null : voiceType,
        "manual"
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

          <View style={styles.pickerBlock}>
            <Text style={styles.pickerLabel}>Voice Type</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={voiceType}
                onValueChange={(v) => setVoiceType(String(v))}
                style={styles.picker}
                itemStyle={{ color: colors.textPrimary }}
                dropdownIconColor={colors.textPrimary}
              >
                {VOICE_TYPES.map((type) => (
                  <Picker.Item key={type} label={type} value={type} color={Platform.OS === "android" ? colors.textPrimary : undefined} />
                ))}
              </Picker>
            </View>
          </View>

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
