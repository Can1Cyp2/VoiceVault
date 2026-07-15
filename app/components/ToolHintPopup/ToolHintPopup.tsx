import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { recordHintShown, ToolHint } from "../../util/toolHints";

const AUTO_DISMISS_MS = 8000;

interface ToolHintPopupProps {
  visible: boolean;
  onClose: () => void;
  /** Tapping the tooltip body (e.g. open the Tools menu). */
  onPress?: () => void;
  hint?: { tool: ToolHint; message: string };
}

// Small tooltip anchored under the Tools button (top-left of Home),
// with a caret pointing up at it. Fades in, auto-dismisses.
export function ToolHintPopup({ visible, onClose, onPress, hint }: ToolHintPopupProps) {
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

      const timer = setTimeout(onClose, AUTO_DISMISS_MS);
      return () => clearTimeout(timer);
    }

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim, onClose]);

  if (!hint || !visible) return null;

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-6, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.caret, { borderBottomColor: colors.backgroundCard }]} />
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[
          styles.tooltip,
          {
            backgroundColor: colors.backgroundCard,
            borderColor: colors.borderLight,
          },
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={hint.message}
        accessibilityHint="Opens the Tools menu"
      >
        <Text style={[styles.message, { color: colors.textPrimary }]} numberOfLines={3}>
          ✨ {hint.message}
        </Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityLabel="Dismiss hint"
        >
          <Text style={[styles.closeX, { color: colors.textTertiary }]}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Sits just below the Tools button (topButtonRow: top 60, paddingHorizontal 20)
  container: {
    position: "absolute",
    top: 98,
    left: 20,
    zIndex: 50,
  },
  caret: {
    width: 0,
    height: 0,
    marginLeft: 24,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  tooltip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: 250,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  // flexShrink (not flex: 1): the row is content-sized, so flex: 1 would
  // resolve to a zero-width basis and the text would vanish entirely
  message: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    flexShrink: 1,
  },
  closeButton: {
    paddingLeft: 2,
  },
  closeX: {
    fontSize: 20,
    fontWeight: "300",
    lineHeight: 20,
  },
});
