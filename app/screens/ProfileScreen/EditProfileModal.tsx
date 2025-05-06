// File: app/screens/ProfileScreen/EditProfileModal.tsx
import React, { useEffect, useState } from "react";
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
import { supabase } from "../../util/supabase";
import { fetchUserVocalRange } from "../../util/api";
import { submitVocalRange } from "../UserVocalRange/UserVocalRangeLogic";
import { Picker } from "@react-native-picker/picker";

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

// Edit profile modal
export default function EditProfileModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave?: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [minRange, setMinRange] = useState("C0");
  const [maxRange, setMaxRange] = useState("C0");
  const [loading, setLoading] = useState(true);
  const [originalDisplayName, setOriginalDisplayName] = useState(""); // To track if user edits it

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
          setMinRange(vocalRangeData.min_range || "C0");
          setMaxRange(vocalRangeData.max_range || "C0");
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
      await submitVocalRange(minRange, maxRange);

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

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>Edit Profile</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter new display name"
          placeholderTextColor="#777"
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modal: {
    width: "80%",
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
    width: "100%",
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  closeButton: {
    color: "#007bff",
    marginTop: 10,
  },
  inputLabel: {
    alignSelf: "flex-start",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#444",
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
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
    borderColor: "#ccc",
    borderRadius: 5,
    backgroundColor: "#f9f9f9",
    marginVertical: 5,
  },
  pickerButtonText: {
    fontSize: 16,
    color: "#333",
  },
});
