import Constants from "expo-constants";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";

interface LoadingScreenProps {
  ready: boolean;
  onFinished: () => void;
}

interface MicrophonePathsProps {
  opacity?: number;
  stroke: string;
  strokeWidth: number;
}

const MINIMUM_VISIBLE_MS = 900;

const MicrophonePaths = ({
  opacity = 1,
  stroke,
  strokeWidth,
}: MicrophonePathsProps) => (
  <G
    fill="none"
    opacity={opacity}
    stroke={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={strokeWidth}
  >
    <Path d="M424 205 C424 141 461 108 512 108 C563 108 600 141 600 205 Z" />
    <Rect x={424} y={235} width={176} height={43} rx={21.5} />
    <Path d="M426 310 H598 V390 C598 452 562 484 512 484 C462 484 426 452 426 390 Z" />
    <Path d="M381 333 V397 C381 481 437 526 512 526 C587 526 643 481 643 397 V333" />
    <Path d="M512 527 V619 M397 619 H627" />
    <Path d="M337 247 C285 300 285 414 337 467" />
    <Path d="M277 192 C194 277 194 437 277 522" />
    <Path d="M687 247 C739 300 739 414 687 467" />
    <Path d="M747 192 C830 277 830 437 747 522" />
    <Path d="M155 278 V414" />
    <Path d="M869 278 V414" />
  </G>
);

const LoadingScreen = ({ ready, onFinished }: LoadingScreenProps) => {
  const glowOpacity = useRef(new Animated.Value(0.72)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const mountedAt = useRef(Date.now());
  const onFinishedRef = useRef(onFinished);
  const version = Constants.expoConfig?.version ?? "1.7.0";

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    const flicker = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          duration: 150,
          toValue: 0.48,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          duration: 85,
          toValue: 0.92,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          duration: 120,
          toValue: 0.64,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          duration: 430,
          easing: Easing.inOut(Easing.quad),
          toValue: 0.96,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          duration: 110,
          toValue: 0.58,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          duration: 190,
          toValue: 0.84,
          useNativeDriver: true,
        }),
      ])
    );

    flicker.start();

    if (!ready) {
      return () => flicker.stop();
    }

    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, MINIMUM_VISIBLE_MS - elapsed);
    const finishTimer = setTimeout(() => {
      flicker.stop();

      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowOpacity, {
            duration: 180,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(iconScale, {
            duration: 180,
            easing: Easing.out(Easing.cubic),
            toValue: 1.035,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(280),
        Animated.timing(screenOpacity, {
          duration: 300,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onFinishedRef.current();
        }
      });
    }, remaining);

    return () => {
      clearTimeout(finishTimer);
      flicker.stop();
    };
  }, [glowOpacity, iconScale, ready, screenOpacity]);

  return (
    <Animated.View
      accessibilityLabel={`VoiceVault is loading. Version ${version}`}
      accessibilityRole="progressbar"
      style={[styles.container, { opacity: screenOpacity }]}
    >
      <View pointerEvents="none" style={styles.ambientGlow} />

      <View style={styles.content}>
        <Animated.View
          style={[styles.logoFrame, { transform: [{ scale: iconScale }] }]}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.svgLayer, { opacity: glowOpacity }]}
          >
            <Svg width="100%" height="100%" viewBox="0 55 1024 600">
              <MicrophonePaths stroke="#FF4D00" strokeWidth={66} opacity={0.2} />
              <MicrophonePaths stroke="#FF6508" strokeWidth={42} opacity={0.38} />
            </Svg>
          </Animated.View>

          <View pointerEvents="none" style={styles.svgLayer}>
            <Svg width="100%" height="100%" viewBox="0 55 1024 600">
              <MicrophonePaths stroke="#FF6208" strokeWidth={25} />
              <MicrophonePaths stroke="#FFF2A3" strokeWidth={8} />
            </Svg>
          </View>
        </Animated.View>

        <Text style={styles.loadingText}>Loading...</Text>
        <Text style={styles.versionText}>Version {version}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    alignItems: "center",
    backgroundColor: "#090A10",
    elevation: 100,
    justifyContent: "center",
    zIndex: 10000,
  },
  ambientGlow: {
    backgroundColor: "rgba(255, 82, 0, 0.08)",
    borderRadius: 230,
    height: 460,
    position: "absolute",
    shadowColor: "#FF5200",
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 90,
    width: 460,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  loadingText: {
    color: "#FFF2D2",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginTop: 24,
  },
  logoFrame: {
    height: 260,
    position: "relative",
    width: 310,
  },
  svgLayer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  versionText: {
    color: "rgba(255, 242, 210, 0.34)",
    fontSize: 12,
    letterSpacing: 1.1,
    marginTop: 10,
  },
});

export default LoadingScreen;
