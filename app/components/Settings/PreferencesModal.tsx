// File: app/components/Settings/PreferencesModal.tsx
//
// Self-contained Preferences popup. Loads preferences when it opens and
// saves each change immediately. Reused for both signed-in users (from
// Profile Settings) and guests (with a sign-in call to action).

import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FONTS } from "../../styles/theme";
import { useTheme } from "../../contexts/ThemeContext";
import { showVerifiedRangeInfo } from "../../util/verifiedInfo";
import {
  getSearchRecentsEnabled,
  setSearchRecentsEnabled,
  getSongImagesEnabled,
  setSongImagesEnabled,
  getSongImageSource,
  setSongImageSource,
  getVerifiedSongsOnly,
  setVerifiedSongsOnly,
  resetPreferencesToDefault,
  SongImageSource,
  SONG_IMAGE_SOURCES,
  SONG_IMAGE_SOURCE_LABELS,
} from "../../util/preferences";

type PreferencesModalProps = {
  visible: boolean;
  onClose: () => void;
  /** When provided, shows a "Sign in for more" call to action (guest mode). */
  onSignIn?: () => void;
};

export default function PreferencesModal({
  visible,
  onClose,
  onSignIn,
}: PreferencesModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [searchRecents, setSearchRecents] = useState(true);
  const [songImages, setSongImages] = useState(true);
  const [imageSource, setImageSource] = useState<SongImageSource>("auto");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const loadPreferences = async () => {
    const [recents, images, source, verified] = await Promise.all([
      getSearchRecentsEnabled(),
      getSongImagesEnabled(),
      getSongImageSource(),
      getVerifiedSongsOnly(),
    ]);
    setSearchRecents(recents);
    setSongImages(images);
    setImageSource(source);
    setVerifiedOnly(verified);
  };

  useEffect(() => {
    if (visible) {
      void loadPreferences();
    }
  }, [visible]);

  const toggleRecents = async (value: boolean) => {
    setSearchRecents(value);
    await setSearchRecentsEnabled(value);
  };

  const toggleImages = async (value: boolean) => {
    setSongImages(value);
    await setSongImagesEnabled(value);
  };

  const cycleImageSource = async () => {
    const nextIndex =
      (SONG_IMAGE_SOURCES.indexOf(imageSource) + 1) % SONG_IMAGE_SOURCES.length;
    const next = SONG_IMAGE_SOURCES[nextIndex];
    setImageSource(next);
    await setSongImageSource(next);
  };

  const toggleVerified = async (value: boolean) => {
    setVerifiedOnly(value);
    await setVerifiedSongsOnly(value);
  };

  const handleReset = () => {
    Alert.alert(
      "Reset Preferences",
      "Restore all preferences to their default values?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetPreferencesToDefault();
            await loadPreferences();
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Preferences</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close preferences"
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Show Recents on Search */}
            <View style={styles.row}>
              <Ionicons name="time-outline" size={20} color={colors.textPrimary} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Show Recents on Search</Text>
                <Text style={styles.rowSub}>Songs and search queries</Text>
              </View>
              <Switch
                value={searchRecents}
                onValueChange={(v) => void toggleRecents(v)}
                trackColor={{ false: colors.backgroundTertiary, true: colors.highlightAlt }}
                thumbColor={searchRecents ? colors.primary : colors.textTertiary}
              />
            </View>

            {/* Song Images */}
            <View style={styles.row}>
              <Ionicons name="image-outline" size={20} color={colors.textPrimary} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Show Song Images</Text>
                <Text style={styles.rowSub}>Album & single artwork</Text>
              </View>
              <Switch
                value={songImages}
                onValueChange={(v) => void toggleImages(v)}
                trackColor={{ false: colors.backgroundTertiary, true: colors.highlightAlt }}
                thumbColor={songImages ? colors.primary : colors.textTertiary}
              />
            </View>

            {/* Image source picker */}
            {songImages && (
              <TouchableOpacity style={styles.row} onPress={cycleImageSource} activeOpacity={0.7}>
                <Ionicons name="server-outline" size={20} color={colors.textPrimary} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Image Source</Text>
                  <Text style={styles.rowSub}>Tap to change where artwork comes from</Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{SONG_IMAGE_SOURCE_LABELS[imageSource]}</Text>
                  <Ionicons name="swap-horizontal" size={15} color={colors.link} />
                </View>
              </TouchableOpacity>
            )}

            {/* Verified songs only */}
            <View style={[styles.row, styles.rowLast]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.textPrimary} />
              <View style={styles.rowText}>
                <View style={styles.labelRow}>
                  <Text style={styles.rowTitle}>Verified Songs Only</Text>
                  <TouchableOpacity
                    onPress={showVerifiedRangeInfo}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="information-circle-outline" size={17} color={colors.link} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.rowSub}>Hide community uploads in search</Text>
              </View>
              <Switch
                value={verifiedOnly}
                onValueChange={(v) => void toggleVerified(v)}
                trackColor={{ false: colors.backgroundTertiary, true: colors.highlightAlt }}
                thumbColor={verifiedOnly ? colors.primary : colors.textTertiary}
              />
            </View>

            <TouchableOpacity style={styles.resetButton} onPress={handleReset} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.resetText}>Reset Preferences to Default</Text>
            </TouchableOpacity>

            {onSignIn && (
              <View style={styles.signInBlock}>
                <Text style={styles.signInHint}>
                  Sign in to set your vocal range, save song lists, and unlock more
                  personalization.
                </Text>
                <TouchableOpacity style={styles.signInButton} onPress={onSignIn} activeOpacity={0.8}>
                  <Text style={styles.signInButtonText}>Sign In for More</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
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
      maxHeight: "82%",
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 20,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
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
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowText: {
      flex: 1,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
    },
    rowSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      fontFamily: FONTS.primary,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    pillText: {
      color: colors.link,
      fontSize: 12.5,
      fontWeight: "700",
      fontFamily: FONTS.primary,
    },
    resetButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 12,
      marginTop: 18,
    },
    resetText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: FONTS.primary,
    },
    signInBlock: {
      marginTop: 18,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    signInHint: {
      fontSize: 13,
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      textAlign: "center",
      lineHeight: 19,
      marginBottom: 12,
    },
    signInButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
    },
    signInButtonText: {
      color: colors.buttonText,
      fontSize: 15,
      fontWeight: "bold",
      fontFamily: FONTS.primary,
    },
  });
