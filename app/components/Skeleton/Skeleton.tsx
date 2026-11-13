// File: app/components/Skeleton/Skeleton.tsx
//
// Shimmering placeholder blocks shown while a screen's data loads, laid out
// in the shape of the content that's coming so nothing jumps when it lands.
//
// Every skeleton on screen rides one shared animation, so the shimmer sweeps
// across a whole list in step instead of each row flickering on its own
// clock. The loop only runs while at least one skeleton is mounted. With
// "Reduce motion" on, the blocks hold still.

import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  DimensionValue,
  Easing,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";

const SHIMMER_DURATION_MS = 1400;

const shimmerProgress = new Animated.Value(0);
let shimmerUsers = 0;
let shimmerLoop: Animated.CompositeAnimation | null = null;

const acquireShimmer = () => {
  shimmerUsers += 1;
  if (shimmerUsers === 1) {
    shimmerProgress.setValue(0);
    shimmerLoop = Animated.loop(
      Animated.timing(shimmerProgress, {
        toValue: 1,
        duration: SHIMMER_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    shimmerLoop.start();
  }
};

const releaseShimmer = () => {
  shimmerUsers = Math.max(0, shimmerUsers - 1);
  if (shimmerUsers === 0) {
    shimmerLoop?.stop();
    shimmerLoop = null;
  }
};

const useReduceMotion = () => {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => mounted && setReduceMotion(enabled))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduceMotion;
};

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  /** Corner radius. Ignored when `circle` is set. */
  radius?: number;
  /** Draws a circle `height` wide - for avatars and icons. */
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = "100%", height = 14, radius = 6, circle, style }: SkeletonProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [blockWidth, setBlockWidth] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    acquireShimmer();
    return releaseShimmer;
  }, [reduceMotion]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== blockWidth) setBlockWidth(next);
  };

  // The highlight band is wider than short blocks so a small chip still
  // gets a soft sweep rather than a hard-edged stripe.
  const bandWidth = Math.max(60, blockWidth * 0.6);
  const translateX = shimmerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-bandWidth, blockWidth + bandWidth],
  });

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          width: circle ? height : width,
          height,
          borderRadius: circle ? height / 2 : radius,
          backgroundColor: colors.skeletonBase,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {!reduceMotion && blockWidth > 0 && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { width: bandWidth, transform: [{ translateX }] }]}
        >
          <Svg width={bandWidth} height={height}>
            <Defs>
              <LinearGradient id="skeletonShimmer" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.skeletonHighlight} stopOpacity={0} />
                <Stop offset="0.5" stopColor={colors.skeletonHighlight} stopOpacity={colors.skeletonHighlightOpacity} />
                <Stop offset="1" stopColor={colors.skeletonHighlight} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width={bandWidth} height={height} fill="url(#skeletonShimmer)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

type SkeletonGroupProps = {
  /** Read out by screen readers in place of the placeholder blocks. */
  label: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/** Wraps a skeleton layout so screen readers hear one "Loading..." instead of a pile of empty views. */
export function SkeletonGroup({ label, style, children }: SkeletonGroupProps) {
  return (
    <View
      style={style}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      pointerEvents="none"
    >
      {children}
    </View>
  );
}

export default Skeleton;
