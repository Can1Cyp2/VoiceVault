// app/components/UpdateBanner/UpdateBanner.tsx
//
// "Update available" banner shown on the Home screen when a newer version is
// live on the device's app store. Tapping it opens the store; the X dismisses
// it. See app/util/appUpdate.ts for the version check that drives it.

import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

type UpdateBannerProps = {
  version: string;
  onPress: () => void;
  onDismiss: () => void;
  /** Admin test preview - adds a small label so it's clearly not a real update. */
  isPreview?: boolean;
};

export function UpdateBanner({ version, onPress, onDismiss, isPreview }: UpdateBannerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Update available, version ${version}. Tap to update.`}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="arrow-up-circle" size={26} color={colors.buttonText} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>
          Update Available{isPreview ? " (Preview)" : ""}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          Version {version} is out. Tap to update.
        </Text>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss update notice"
        style={styles.closeButton}
      >
        <Ionicons name="close" size={20} color={colors.buttonText} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const createStyles = (colors: typeof import("../../styles/theme").LightColors) =>
  StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 6,
    },
    iconWrap: {
      width: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    textWrap: {
      flex: 1,
    },
    title: {
      color: colors.buttonText,
      fontSize: 15,
      fontWeight: "bold",
    },
    subtitle: {
      color: colors.buttonText,
      fontSize: 12.5,
      opacity: 0.9,
      marginTop: 1,
    },
    closeButton: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
    },
  });
