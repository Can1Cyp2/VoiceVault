import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { recordHintShown, shouldShowToolHint, getRandomToolHint, ToolHint } from "../../util/toolHints";

interface ToolHintPopupProps {
  visible: boolean;
  onClose: () => void;
  hint?: { tool: ToolHint; message: string };
}

export function ToolHintPopup({ visible, onClose, hint }: ToolHintPopupProps) {
  const { colors } = useTheme();
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      recordHintShown().catch(() => {});
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  if (!hint) return null;

  const getIconForTool = (tool: ToolHint) => {
    switch (tool) {
      case "metronome":
        return "timer";
      case "tuner":
        return "pulse";
      case "piano":
        return "musical-note";
      default:
        return "lightbulb";
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View
        style={[
          styles.overlay,
          {
            backgroundColor: colors.overlay,
            opacity: fadeAnim,
          },
        ]}
      >
        <View style={styles.container}>
          <Animated.View
            style={[
              styles.popup,
              {
                backgroundColor: colors.backgroundCard,
                borderColor: colors.primary,
                transform: [
                  {
                    scale: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Icon */}
            <View
              style={[styles.iconContainer, { backgroundColor: colors.highlight }]}
            >
              <Ionicons
                name={getIconForTool(hint.tool)}
                size={28}
                color={colors.primary}
              />
            </View>

            {/* Message */}
            <Text
              style={[styles.message, { color: colors.textPrimary }]}
              numberOfLines={3}
            >
              💡 {hint.message}
            </Text>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.inputBackground }]}
                onPress={onClose}
              >
                <Text style={[styles.buttonText, { color: colors.textSecondary }]}>
                  Dismiss
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={onClose}
              >
                <Text style={[styles.buttonText, { color: colors.buttonText }]}>
                  Got it
                </Text>
              </TouchableOpacity>
            </View>

            {/* Close Icon */}
            <TouchableOpacity
              style={styles.closeIcon}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  popup: {
    borderRadius: 16,
    padding: 20,
    width: "85%",
    maxWidth: 340,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButton: {
    // Colors applied inline
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  closeIcon: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
});
