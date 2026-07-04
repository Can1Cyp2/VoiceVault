// File: app/components/ShareRange/ShareRangeModal.tsx
//
// Modal that shows a branded, shareable card with the user's vocal range.
// "Share Image" snapshots the card (react-native-view-shot) and hands the
// PNG to the native share sheet, so users can text it, post it, or send it
// anywhere their phone supports. The primary action attempts to pass both
// the PNG URI and the message through React Native's built-in share sheet,
// then falls back to the Expo image share path if the platform rejects it.

import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Share as NativeShare,
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
  buildShareRangeMessage,
  getStoreDownloadUrl,
  StoreLinkType,
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
  const [storeLinkType, setStoreLinkType] = useState<StoreLinkType>(
    Platform.OS === "ios" ? "apple" : "android"
  );
  const selectedStoreUrl = getStoreDownloadUrl(storeLinkType);

  const shareAsText = useCallback(async () => {
    try {
      await NativeShare.share({
        message: buildShareRangeMessage(vocalRange, voiceType, storeLinkType),
      });
    } catch (error) {
      console.error("Error sharing range as text:", error);
    }
  }, [storeLinkType, vocalRange, voiceType]);

  const captureCard = useCallback(async () => {
    const capture = viewShotRef.current?.capture;
    if (!capture) return null;
    return capture();
  }, []);

  const shareAsImage = useCallback(async () => {
    try {
      const canShareFiles = await Sharing.isAvailableAsync();
      const uri = await captureCard();
      if (!canShareFiles || !uri) {
        // No file sharing on this device - fall back to text.
        await shareAsText();
        return;
      }

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
    }
  }, [captureCard, shareAsText]);

  const handleShareImage = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      await shareAsImage();
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, shareAsImage]);

  const shareImageWithText = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      const uri = await captureCard();
      const message = buildShareRangeMessage(vocalRange, voiceType, storeLinkType);

      if (!uri) {
        await shareAsText();
        return;
      }

      await NativeShare.share({
        title: "Share your vocal range",
        message,
        url: uri,
      });
    } catch (error) {
      console.error("Error sharing range image with text:", error);
      Alert.alert(
        "Sharing failed",
        "Could not send both the image and text together. Sharing the image instead."
      );
      await shareAsImage();
    } finally {
      setIsSharing(false);
    }
  }, [captureCard, isSharing, shareAsImage, shareAsText, storeLinkType, vocalRange, voiceType]);

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
            <Text style={styles.cardLink}>{selectedStoreUrl}</Text>
          </ViewShot>

          <View style={styles.storeSelectorRow}>
            <Text style={[styles.storeSelectorLabel, { color: colors.textSecondary }]}>
              Link:
            </Text>
            <TouchableOpacity
              style={[
                styles.storeSelectorButton,
                { borderColor: colors.border, backgroundColor: colors.backgroundTertiary },
                storeLinkType === "android" && { borderColor: colors.primary, backgroundColor: colors.highlightAlt },
              ]}
              onPress={() => setStoreLinkType("android")}
              activeOpacity={0.75}
            >
              <Ionicons
                name="logo-google-playstore"
                size={14}
                color={storeLinkType === "android" ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.storeSelectorText,
                  { color: storeLinkType === "android" ? colors.primary : colors.textSecondary },
                ]}
              >
                Android
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.storeSelectorButton,
                { borderColor: colors.border, backgroundColor: colors.backgroundTertiary },
                storeLinkType === "apple" && { borderColor: colors.primary, backgroundColor: colors.highlightAlt },
              ]}
              onPress={() => setStoreLinkType("apple")}
              activeOpacity={0.75}
            >
              <Ionicons
                name="logo-apple"
                size={14}
                color={storeLinkType === "apple" ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.storeSelectorText,
                  { color: storeLinkType === "apple" ? colors.primary : colors.textSecondary },
                ]}
              >
                Apple
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={shareImageWithText}
            disabled={isSharing}
          >
            <Ionicons name="share-social-outline" size={18} color={colors.buttonText} />
            <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
              {isSharing ? "Preparing..." : "Share Image + Text"}
            </Text>
          </TouchableOpacity>

          <View style={styles.secondaryButtonRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.backgroundTertiary }]}
              onPress={shareAsText}
            >
              <Ionicons name="chatbubble-outline" size={16} color={colors.textPrimary} />
              <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                Text
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.backgroundTertiary }]}
              onPress={handleShareImage}
              disabled={isSharing}
            >
              <Ionicons name="image-outline" size={16} color={colors.textPrimary} />
              <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                Image
              </Text>
            </TouchableOpacity>
          </View>

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
  storeSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  storeSelectorLabel: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: FONTS.primary,
  },
  storeSelectorButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  storeSelectorText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: FONTS.primary,
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
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
  },
  secondaryButtonRow: {
    flexDirection: "row",
    gap: 10,
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
