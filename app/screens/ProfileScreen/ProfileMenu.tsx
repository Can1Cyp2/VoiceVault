// File: app\screens\ProfileScreen\ProfileMenu.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from "react-native";
import { supabase } from "../../util/supabase";
import EditProfileModal from "./EditProfileModal"; // Import the modal component

const handleResetPassword = async () => {
  try {
    const user = await supabase.auth.getUser();

    if (!user.data.user?.email) {
      Alert.alert("Error", "No email found for the user.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      user.data.user.email
    );

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert(
        "Success",
        "Password reset email sent. Please check your inbox."
      );
    }
  } catch (err) {
    Alert.alert("Error", "An unexpected error occurred.");
  }
};

export default function ProfileMenu({
  onClose,
  onLogout,
}: {
  onClose: () => void;
  onLogout: () => void;
}) {
  const [isEditProfileVisible, setEditProfileVisible] = useState(false); // State for showing the Edit Profile modal

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        {/* Edit Profile Button */}
        <TouchableOpacity
          style={styles.option}
          onPress={() => setEditProfileVisible(true)} // Open Edit Profile modal
        >
          <Text style={styles.optionText}>Edit Profile</Text>
        </TouchableOpacity>

        {/* Reset Password Button */}
        <TouchableOpacity style={styles.option} onPress={handleResetPassword}>
          <Text style={styles.optionText}>Reset Password</Text>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity style={styles.option} onPress={onLogout}>
          <Text style={[styles.optionText, { color: "red" }]}>Logout</Text>
        </TouchableOpacity>

        {/* Close Menu */}
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Profile Modal */}
      {isEditProfileVisible && (
        <Modal visible={isEditProfileVisible} transparent animationType="slide">
          <EditProfileModal
            onClose={() => setEditProfileVisible(false)} // Close the modal
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {},
  modal: {
    width: "80%",
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    alignItems: "center",
  },
  option: {
    paddingVertical: 10,
    width: "100%",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  optionText: {
    fontSize: 16,
    color: "#555",
  },
  closeText: {
    fontSize: 16,
    color: "#007bff",
    marginTop: 20,
    backgroundColor: "#d9d9d9",
    padding: 5,
    borderRadius: 5,
  },
});
