// File: app/components/Skeleton/LoadingBar.tsx
//
// Indeterminate progress bar: a short segment that keeps sliding across the
// track while something loads. Used under the search filters during a
// pull-to-refresh and beneath the "Loading songs..." label. Holds still as a
// partial fill when Reduce Motion is on.

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  DimensionValue,
  Easing,
  LayoutChangeEvent,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useReduceMotion } from "./Skeleton";

type LoadingBarProps = {
  width?: DimensionValue;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

const SWEEP_DURATION_MS = 1100;

export default function LoadingBar({ width = "100%", height = 4, style }: LoadingBarProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion || trackWidth === 0) return;
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SWEEP_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, trackWidth, progress]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== trackWidth) setTrackWidth(next);
  };

  const segmentWidth = Math.max(40, trackWidth * 0.4);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-segmentWidth, trackWidth],
  });

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: colors.lightGray,
          overflow: "hidden",
        },
        style,
      ]}
      importantForAccessibility="no-hide-descendants"
    >
      {trackWidth > 0 && (
        <Animated.View
          style={{
            width: reduceMotion ? "65%" : segmentWidth,
            height,
            borderRadius: height / 2,
            backgroundColor: colors.primary,
            transform: reduceMotion ? undefined : [{ translateX }],
          }}
        />
      )}
    </View>
  );
}
