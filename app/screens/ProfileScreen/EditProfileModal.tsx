// File: app/screens/ProfileScreen/EditProfileModal.tsx
//
// "Edit Name" popup, reached from Profile Settings > Edit Profile. Vocal
// range and voice type are edited separately in VocalRangeEditModal.

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../../util/supabase";
import { useTheme } from "../../contexts/ThemeContext";

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
  const [originalDisplayName, setOriginalDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const user = supabase.auth.user();
    if (user) {
      const username = user.user_metadata?.display_name || "";
      setDisplayName(username);
      setOriginalDisplayName(username);
    }
    setLoading(false);
  }, []);

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert("Error", "Display name cannot be empty.");
      return;
    }

    if (displayName === originalDisplayName) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.update({
        data: { display_name: displayName.trim() },
      });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      Alert.alert("Success", "Profile updated successfully!");
      if (onSave) onSave();
      onClose();
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>Edit Name</Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Enter new display name"
              placeholderTextColor={colors.textPlaceholder}
              value={displayName}
              onChangeText={setDisplayName}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Save"}</Text>
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
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.buttonText,
    fontWeight: "bold",
  },
  closeButton: {
    color: colors.link,
    marginTop: 10,
  },
});
