// File: app/components/ShareRange/ShareRangeModal.tsx
//
// Modal that shows a branded, shareable card with the user's vocal range.
// "Share Image" snapshots the card (react-native-view-shot) and hands the
// PNG to the native share sheet (expo-sharing), so users can text it,
// post it, or send it anywhere their phone supports. "Share as Text"
// falls back to a plain message with the download link.

import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { FONTS } from "../../styles/theme";
import { useTheme } from "../../contexts/ThemeContext";
import {
  APP_DOWNLOAD_URL,
  buildShareRangeMessage,
} from "../../util/shareRange";

// The card uses fixed brand colors (dark + orange) so shared images look
// identical no matter which theme the sender uses.
const CARD_COLORS = {
  background: "#1a1a1a",
  accent: "#ff5722",
  text: "#ffffff",
  textMuted: "#b0b0b0",
  border: "#333333",
};

type ShareRangeModalProps = {
  visible: boolean;
  onClose: () => void;
  vocalRange: string;
  voiceType: string | null;
  username?: string | null;
};

export default function ShareRangeModal({
  visible,
  onClose,
  vocalRange,
  voiceType,
  username,
}: ShareRangeModalProps) {
  const { colors } = useTheme();
  const viewShotRef = useRef<ViewShot>(null);
  const [isSharing, setIsSharing] = useState(false);

  const shareAsText = useCallback(async () => {
    try {
      await Share.share({
        message: buildShareRangeMessage(vocalRange, voiceType),
      });
    } catch (error) {
      console.error("Error sharing range as text:", error);
    }
  }, [vocalRange, voiceType]);

  const shareAsImage = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      const canShareFiles = await Sharing.isAvailableAsync();
      const capture = viewShotRef.current?.capture;
      if (!canShareFiles || !capture) {
        // No file sharing on this device - fall back to text.
        await shareAsText();
        return;
      }

      const uri = await capture();
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share your vocal range",
      });
    } catch (error) {
      console.error("Error sharing range image:", error);
      Alert.alert(
        "Sharing failed",
        "Could not create the image. Sharing as text instead."
      );
      await shareAsText();
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, shareAsText]);

  const displayName = username && !username.startsWith("Edit") ? username : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.content, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Share Your Range
          </Text>

          {/* The card below is what gets captured as the shared image. */}
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 1 }}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <Image
                source={require("../../../assets/transparent-icon-dark.png")}
                style={styles.cardLogo}
                resizeMode="contain"
              />
              <Text style={styles.cardAppName}>VoiceVault</Text>
            </View>

            <Text style={styles.cardLabel}>
              {displayName ? `${displayName}'s vocal range` : "My vocal range"}
            </Text>
            <Text style={styles.cardRange}>{vocalRange}</Text>
            {voiceType && <Text style={styles.cardVoiceType}>{voiceType}</Text>}

            <View style={styles.cardDivider} />
            <Text style={styles.cardFooter}>
              What's your range? Find out free with VoiceVault 🎤
            </Text>
            <Text style={styles.cardLink}>{APP_DOWNLOAD_URL}</Text>
          </ViewShot>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={shareAsImage}
            disabled={isSharing}
          >
            <Ionicons name="image-outline" size={18} color={colors.buttonText} />
            <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
              {isSharing ? "Preparing..." : "Share Image"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.backgroundTertiary }]}
            onPress={shareAsText}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.textPrimary} />
            <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
              Share as Text
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    borderRadius: 20,
    padding: 20,
    width: "92%",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    fontFamily: FONTS.primary,
    textAlign: "center",
    marginBottom: 16,
  },
  card: {
    backgroundColor: CARD_COLORS.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_COLORS.border,
    padding: 24,
    alignItems: "center",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  cardLogo: {
    width: 36,
    height: 36,
    marginRight: 8,
  },
  cardAppName: {
    color: CARD_COLORS.accent,
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: FONTS.primary,
    letterSpacing: 1,
  },
  cardLabel: {
    color: CARD_COLORS.textMuted,
    fontSize: 13,
    fontFamily: FONTS.primary,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 6,
  },
  cardRange: {
    color: CARD_COLORS.text,
    fontSize: 42,
    fontWeight: "bold",
    fontFamily: FONTS.primary,
  },
  cardVoiceType: {
    color: CARD_COLORS.accent,
    fontSize: 18,
    fontWeight: "600",
    fontFamily: FONTS.primary,
    marginTop: 4,
  },
  cardDivider: {
    height: 1,
    alignSelf: "stretch",
    backgroundColor: CARD_COLORS.border,
    marginVertical: 16,
  },
  cardFooter: {
    color: CARD_COLORS.text,
    fontSize: 13,
    fontFamily: FONTS.primary,
    textAlign: "center",
    marginBottom: 6,
  },
  cardLink: {
    color: CARD_COLORS.textMuted,
    fontSize: 10.5,
    fontFamily: FONTS.primary,
    textAlign: "center",
  },
  primaryButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    paddingVertical: 13,
    marginTop: 16,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "bold",
    fontFamily: FONTS.primary,
  },
  secondaryButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
    marginTop: 10,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: FONTS.primary,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 6,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: FONTS.primary,
  },
});
