// File location: app/components/RequestSong/RequestSongModal.tsx
// Simple "Request Song" form reached from the Search screen's add dropdown.
// Guests and logged-in users can both submit; only signed-in users can track
// their request later from the Profile screen.

import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../util/supabase";
import { submitSongRequest } from "../../util/api";

interface RequestSongModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function RequestSongModal({ visible, onClose }: RequestSongModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [songName, setSongName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const isLoggedIn = !!supabase.auth.user();

  const resetAndClose = () => {
    setSongName("");
    setArtistName("");
    setError("");
    setShowSuccess(false);
    onClose();
  };

  const handleSubmit = async () => {
    const trimmedSong = songName.trim();
    const trimmedArtist = artistName.trim();

    if (!trimmedSong || !trimmedArtist) {
      setError("Please enter both a song name and an artist name.");
      return;
    }

    try {
      setError("");
      setIsSubmitting(true);
      await submitSongRequest(trimmedSong, trimmedArtist);
      setShowSuccess(true);
    } catch (err) {
      console.error("Failed to submit song request:", err);
      setError("Failed to submit your request. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={resetAndClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={resetAndClose} />
        <View style={styles.container}>
          {showSuccess ? (
            <>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              <Text style={styles.title}>Request Submitted!</Text>
              <Text style={styles.subtitle}>
                "{songName.trim()}" by {artistName.trim()} has been sent to our team.
                We'll review it and try to add it to the database.
              </Text>
              {isLoggedIn ? (
                <Text style={styles.hint}>
                  You can track this request from your Profile.
                </Text>
              ) : (
                <Text style={styles.hint}>
                  Sign in before requesting to track the status of your requests.
                </Text>
              )}
              <TouchableOpacity style={styles.submitButton} onPress={resetAndClose}>
                <Text style={styles.submitButtonText}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Request a Song</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Close request song form"
                  onPress={resetAndClose}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.subtitle}>
                Can't find a song? Tell us what's missing and our team will find
                its vocal range and add it.
              </Text>

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <TextInput
                style={styles.input}
                placeholder="Song Name"
                placeholderTextColor={colors.textPlaceholder}
                value={songName}
                onChangeText={setSongName}
                editable={!isSubmitting}
                maxLength={200}
              />
              <TextInput
                style={styles.input}
                placeholder="Artist Name"
                placeholderTextColor={colors.textPlaceholder}
                value={artistName}
                onChangeText={setArtistName}
                editable={!isSubmitting}
                maxLength={200}
              />

              {!isLoggedIn && (
                <Text style={styles.hint}>
                  You're not signed in. Your request will still be reviewed, but
                  you won't be able to track its status.
                </Text>
              )}

              <TouchableOpacity
                style={[styles.submitButton, { opacity: isSubmitting ? 0.6 : 1 }]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
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
    container: {
      backgroundColor: colors.backgroundCard,
      borderRadius: 16,
      padding: 20,
      width: "88%",
      alignItems: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginTop: 4,
    },
    closeButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 8,
      marginBottom: 12,
      lineHeight: 20,
    },
    hint: {
      fontSize: 12.5,
      color: colors.textTertiary,
      textAlign: "center",
      marginTop: 6,
      lineHeight: 17,
    },
    errorText: {
      color: colors.danger,
      fontSize: 14,
      textAlign: "center",
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      width: "100%",
      fontSize: 15,
    },
    submitButton: {
      backgroundColor: colors.primary,
      paddingVertical: 13,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 16,
      width: "100%",
    },
    submitButtonText: {
      color: colors.buttonText,
      fontWeight: "bold",
      fontSize: 16,
    },
  });
