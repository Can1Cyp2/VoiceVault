import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { recordHintShown, ToolHint } from "../../util/toolHints";

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
        duration: 400,
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

  if (!hint || !visible) return null;

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <View
        style={[
          styles.tooltip,
          {
            backgroundColor: colors.backgroundCard,
            borderColor: colors.borderLight,
          },
        ]}
      >
        <Text
          style={[styles.message, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          ✨ {hint.message}
        </Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.closeX, { color: colors.textTertiary }]}>×</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    right: 16,
    zIndex: 50,
  },
  tooltip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: 200,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  message: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    flex: 1,
  },
  closeButton: {
    paddingLeft: 4,
  },
  closeX: {
    fontSize: 20,
    fontWeight: "300",
    lineHeight: 20,
  },
});
