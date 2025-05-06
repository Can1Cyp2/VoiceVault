// File: app/screens/ProfileScreen/ProfileMenu.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../../util/supabase";
import EditProfileModal from "./EditProfileModal";

// This component renders a menu for the user profile with options to edit profile, reset password, delete account, and logout.
export default function ProfileMenu({
  onClose,
  onLogout,
}: {
  onClose: () => void;
  onLogout: () => void;
}) {
  const [isEditProfileVisible, setEditProfileVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Function to reset the user's password
  const handleResetPassword = async () => {
    try {
      const user = supabase.auth.user();

      if (!user?.email) {
        Alert.alert("Error", "No email found for the user.");
        return;
      }

      const { error } = await supabase.auth.api.resetPasswordForEmail(user.email);

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

  // Function to delete user account and associated data
  const handleDeleteAccount = async () => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);

              // Get current user
              const user = supabase.auth.user();

              if (!user) {
                setIsDeleting(false);
                Alert.alert("Error", "Could not fetch user details.");
                return;
              }

              const userId = user.id;

              // Step 1: Update user metadata to mark as deleted
              const { error: updateError } = await supabase.auth.update({
                data: { deleted: true },
              });

              if (updateError) {
                Alert.alert("Error", "Failed to mark account as deleted. Please try again shortly or contact support if the issue persists voicevaultcontact@gmail.com");
                setIsDeleting(false);
                return;
              }

              // Step 2: Log out user
              await supabase.auth.signOut();
              setIsDeleting(false);
              Alert.alert("Success", "Your account has been deleted.");
              onLogout(); // Redirect to login screen
            } catch (error) {
              console.error("Unexpected error:", error);
              setIsDeleting(false);
              Alert.alert("Error", "An unexpected error occurred.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        {/* Edit Profile Button */}
        <TouchableOpacity
          style={styles.option}
          onPress={() => setEditProfileVisible(true)}
        >
          <Text style={styles.optionText}>Edit Profile</Text>
        </TouchableOpacity>

        {/* Reset Password Button */}
        <TouchableOpacity style={styles.option} onPress={handleResetPassword}>
          <Text style={styles.optionText}>Reset Password</Text>
        </TouchableOpacity>

        {/* Delete Account Button */}
        <TouchableOpacity
          style={styles.option}
          onPress={handleDeleteAccount}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="red" />
          ) : (
            <Text style={[styles.optionText, { color: "red" }]}>
              Delete Account
            </Text>
          )}
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
          <EditProfileModal onClose={() => setEditProfileVisible(false)} />
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
