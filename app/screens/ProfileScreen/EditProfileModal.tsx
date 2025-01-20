// File: app/screens/ProfileScreen/EditProfileModal.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { supabase } from "../../util/supabase";

export default function EditProfileModal({ onClose }: { onClose: () => void }) {
  const [displayName, setDisplayName] = useState("");

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert("Error", "Display name cannot be empty.");
      return;
    }

    try {
      const user = await supabase.auth.getUser();

      if (!user.data.user) {
        Alert.alert("Error", "You must be logged in to update your profile.");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim() },
      });

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        Alert.alert("Success", "Display name updated successfully!");
        onClose(); // Close modal after saving.
      }
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred.");
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>Edit Profile</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter new display name"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
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
});
