// File: app/screens/ProfileScreen/EditProfileModal.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ActionSheetIOS,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../util/supabase";
import { fetchUserVocalRange } from "../../util/api";
import { submitVocalRange } from "../UserVocalRange/UserVocalRangeLogic";
import { Picker } from "@react-native-picker/picker";
import { useTheme } from "../../contexts/ThemeContext";

// Define all notes from C1 to C7
export const NOTES = [
  "C0",
  "C1",
  "C#1",
  "D1",
  "D#1",
  "E1",
  "F1",
  "F#1",
  "G1",
  "G#1",
  "A1",
  "A#1",
  "B1",
  "C2",
  "C#2",
  "D2",
  "D#2",
  "E2",
  "F2",
  "F#2",
  "G2",
  "G#2",
  "A2",
  "A#2",
  "B2",
  "C3",
  "C#3",
  "D3",
  "D#3",
  "E3",
  "F3",
  "F#3",
  "G3",
  "G#3",
  "A3",
  "A#3",
  "B3",
  "C4",
  "C#4",
  "D4",
  "D#4",
  "E4",
  "F4",
  "F#4",
  "G4",
  "G#4",
  "A4",
  "A#4",
  "B4",
  "C5",
  "C#5",
  "D5",
  "D#5",
  "E5",
  "F5",
  "F#5",
  "G5",
  "G#5",
  "A5",
  "A#5",
  "B5",
  "C6",
  "C#6",
  "D6",
  "D#6",
  "E6",
  "F6",
  "F#6",
  "G6",
  "G#6",
  "A6",
  "A#6",
  "B6",
  "C7",
];

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

// Edit profile modal
export default function EditProfileModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [displayName, setDisplayName] = useState("");
  const [minRange, setMinRange] = useState("C0");
  const [maxRange, setMaxRange] = useState("C0");
  const [voiceType, setVoiceType] = useState("");
  const [rangeChangeReason, setRangeChangeReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [originalDisplayName, setOriginalDisplayName] = useState(""); // To track if user edits it
  const [originalMinRange, setOriginalMinRange] = useState("C0");
  const [originalMaxRange, setOriginalMaxRange] = useState("C0");
  const [originalVoiceType, setOriginalVoiceType] = useState("");

  // Fetch user data and vocal range on component mount
  useEffect(() => {
    const loadUserData = async () => {
      setLoading(true);

      try {
        // Fetch user data
        const user = supabase.auth.user();
        if (user) {
          const username = user.user_metadata?.display_name || "";
          setDisplayName(username); // Autofill input
          setOriginalDisplayName(username); // Store for comparison
        }

        // Fetch vocal range
        const vocalRangeData = await fetchUserVocalRange();
        if (vocalRangeData) {
          const loadedMin = vocalRangeData.min_range || "C0";
          const loadedMax = vocalRangeData.max_range || "C0";
          setMinRange(loadedMin);
          setMaxRange(loadedMax);
          setOriginalMinRange(loadedMin);
          setOriginalMaxRange(loadedMax);
          const loadedVoiceType = vocalRangeData.voice_type || "";
          setVoiceType(loadedVoiceType);
          setOriginalVoiceType(loadedVoiceType);
          setRangeChangeReason(vocalRangeData.range_update_reason || "");
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }

      setLoading(false);
    };

    loadUserData();
  }, []);

  // Function to handle vocal range submission
  const handleSave = async () => {
    const hasRangeChanged = minRange !== originalMinRange || maxRange !== originalMaxRange;
    const hasVoiceTypeChanged = voiceType !== originalVoiceType;

    if (!displayName.trim()) {
      Alert.alert("Error", "Display name cannot be empty.");
      return;
    }

    if (minRange === "C0" || maxRange === "C0") {
      Alert.alert(
        "Warning",
        "Your vocal range is set to default (C0). You will not receive personalized song recommendations."
      );
    }

    if (
      NOTES.indexOf(minRange) >= NOTES.indexOf(maxRange) &&
      maxRange !== "C0"
    ) {
      Alert.alert("Error", "Min range must be lower than max range.");
      return;
    }

    if (hasVoiceTypeChanged && !rangeChangeReason) {
      Alert.alert(
        "Reason Required",
        "Please select why you are switching your voice type."
      );
      return;
    }

    try {
      const user = supabase.auth.user();
      if (!user) {
        Alert.alert("Error", "You must be logged in to update your profile.");
        return;
      }

      // Only update username if it was changed
      if (displayName !== originalDisplayName) {
        const { error } = await supabase.auth.update({
          data: { display_name: displayName.trim() },
        });

        if (error) {
          Alert.alert("Error", error.message);
          return;
        } else {
          Alert.alert("Success", "Profile updated successfully!");
          setOriginalDisplayName(displayName); // Update stored name
        }
      }

      // Save Vocal Range
      await submitVocalRange(
        minRange,
        maxRange,
        voiceType || null,
        hasVoiceTypeChanged ? rangeChangeReason : null
      );

      if (hasRangeChanged) {
        setOriginalMinRange(minRange);
        setOriginalMaxRange(maxRange);
      }

      if (hasVoiceTypeChanged) {
        setOriginalVoiceType(voiceType);
      }

      // Trigger ProfileScreen to refresh
      if (onSave) onSave();

      onClose();
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred.");
    }
  };

  // Handle presses for ios devices for choosing user vocal range
  const handleMinRangePress = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", ...NOTES],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setMinRange(NOTES[buttonIndex - 1]);
          }
        }
      );
    }
  };

  const handleMaxRangePress = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", ...NOTES],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setMaxRange(NOTES[buttonIndex - 1]);
          }
        }
      );
    }
  };

  const handleVoiceTypePress = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", ...VOICE_TYPE_OPTIONS.map((option) => option.label)],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setVoiceType(VOICE_TYPE_OPTIONS[buttonIndex - 1].value);
          }
        }
      );
    }
  };

  const handleRangeChangeReasonPress = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", ...RANGE_CHANGE_REASONS.map((option) => option.label)],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setRangeChangeReason(RANGE_CHANGE_REASONS[buttonIndex - 1].value);
          }
        }
      );
    }
  };

  const handleVoiceTypeInfoPress = () => {
    Alert.alert(
      "Voice Type Guide",
      "Voice type is an estimate based on your detected range, but you can also set it manually if needed.\n\nCommon ranges:\nBass: E2 - E4\nBaritone: A2 - F4\nTenor: C3 - A4\nAlto: F3 - D5\nMezzo-Soprano: A3 - F5\nSoprano: C4 - A5",
      [{ text: "OK" }]
    );
  };

  const hasVoiceTypeChanged = voiceType !== originalVoiceType;

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>Edit Profile</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter new display name"
          placeholderTextColor={colors.textPlaceholder}
          value={displayName}
          onChangeText={setDisplayName}
        />

        {loading ? (
          <ActivityIndicator size="large" color="#007bff" />
        ) : (
          <>
            <Text style={styles.label}>Lowest Note:</Text>
            {Platform.OS === "ios" ? (
              <TouchableOpacity style={styles.pickerButton} onPress={handleMinRangePress}>
                <Text style={styles.pickerButtonText}>{minRange}</Text>
              </TouchableOpacity>
            ) : (
              <Picker
                selectedValue={minRange}
                style={styles.picker}
                onValueChange={(value) => setMinRange(value)}
              >
                {NOTES.map((note) => (
                  <Picker.Item key={note} label={note} value={note} />
                ))}
              </Picker>
            )}

            <Text style={styles.label}>Highest Note:</Text>
            {Platform.OS === "ios" ? (
              <TouchableOpacity style={styles.pickerButton} onPress={handleMaxRangePress}>
                <Text style={styles.pickerButtonText}>{maxRange}</Text>
              </TouchableOpacity>
            ) : (
              <Picker
                selectedValue={maxRange}
                style={styles.picker}
                onValueChange={(value) => setMaxRange(value)}
              >
                {NOTES.map((note) => (
                  <Picker.Item key={note} label={note} value={note} />
                ))}
              </Picker>
            )}

            <View style={styles.labelRow}>
              <Text style={styles.label}>Voice Type:</Text>
              <TouchableOpacity onPress={handleVoiceTypeInfoPress} style={styles.infoIconButton}>
                <Ionicons name="information-circle-outline" size={20} color={colors.link} />
              </TouchableOpacity>
            </View>
            {Platform.OS === "ios" ? (
              <TouchableOpacity style={styles.pickerButton} onPress={handleVoiceTypePress}>
                <Text style={styles.pickerButtonText}>
                  {VOICE_TYPE_OPTIONS.find((option) => option.value === voiceType)?.label || "Auto (Based on Range)"}
                </Text>
              </TouchableOpacity>
            ) : (
              <Picker
                selectedValue={voiceType}
                style={styles.picker}
                onValueChange={(value) => setVoiceType(value)}
              >
                {VOICE_TYPE_OPTIONS.map((option) => (
                  <Picker.Item key={option.label} label={option.label} value={option.value} />
                ))}
              </Picker>
            )}

            {hasVoiceTypeChanged && (
              <>
                <Text style={styles.label}>Reason for changing your voice type:</Text>
                {Platform.OS === "ios" ? (
                  <TouchableOpacity style={styles.pickerButton} onPress={handleRangeChangeReasonPress}>
                    <Text style={styles.pickerButtonText}>
                      {RANGE_CHANGE_REASONS.find((option) => option.value === rangeChangeReason)?.label || "Select a reason"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Picker
                    selectedValue={rangeChangeReason}
                    style={styles.picker}
                    onValueChange={(value) => setRangeChangeReason(value)}
                  >
                    <Picker.Item label="Select a reason" value="" />
                    {RANGE_CHANGE_REASONS.map((option) => (
                      <Picker.Item key={option.label} label={option.label} value={option.value} />
                    ))}
                  </Picker>
                )}
              </>
            )}

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.overlay,
  },
  modal: {
    width: "80%",
    padding: 20,
    backgroundColor: colors.backgroundCard,
    borderRadius: 10,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 20,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.secondary,
    padding: 10,
    borderRadius: 5,
    width: "100%",
    alignItems: "center",
  },
  saveButtonText: {
    color: colors.buttonText,
    fontWeight: "bold",
  },
  closeButton: {
    color: colors.link,
    marginTop: 10,
  },
  inputLabel: {
    alignSelf: "flex-start",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
    color: colors.textSecondary,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginTop: 10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  infoIconButton: {
    marginTop: 10,
    padding: 2,
  },
  picker: {
    width: "100%",
    height: 50,
  },
  pickerButton: {
    width: "100%",
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 5,
    backgroundColor: colors.inputBackground,
    marginVertical: 5,
  },
  pickerButtonText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
});
