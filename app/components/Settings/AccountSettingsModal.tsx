// File: app/components/Settings/AccountSettingsModal.tsx
//
// "Edit Profile" category popup: edit display name, reset password, and
// delete account. The actual actions live in ProfileScreen and are passed
// in as callbacks so this stays a thin presentational modal.

import React from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FONTS } from "../../styles/theme";
import { useTheme } from "../../contexts/ThemeContext";

type AccountSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  onEditName: () => void;
  onResetPassword: () => void;
  onDeleteAccount: () => void;
  isDeleting?: boolean;
};

export default function AccountSettingsModal({
  visible,
  onClose,
  onEditName,
  onResetPassword,
  onDeleteAccount,
  isDeleting = false,
}: AccountSettingsModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Profile</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close edit profile"
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.row} onPress={onEditName} activeOpacity={0.7}>
            <Ionicons name="person-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.rowText}>Edit Name</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={onResetPassword} activeOpacity={0.7}>
            <Ionicons name="key-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.rowText}>Reset Password</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, styles.rowLast]}
            onPress={onDeleteAccount}
            disabled={isDeleting}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.danger} style={{ marginLeft: 4 }} />
            ) : (
              <Text style={[styles.rowText, { color: colors.danger }]}>Delete Account</Text>
            )}
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
      paddingBottom: 10,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    title: {
      fontSize: 22,
      fontWeight: "bold",
      fontFamily: FONTS.primary,
      color: colors.textPrimary,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowText: {
      flex: 1,
      fontSize: 16,
      fontWeight: "500",
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
    },
  });
