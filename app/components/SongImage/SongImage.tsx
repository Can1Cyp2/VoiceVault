// File: app/components/SongImage/SongImage.tsx
//
// Shows artwork for a song. When images are enabled and one is found it
// renders the cached cover (via expo-image, which handles disk caching);
// otherwise it draws a deterministic gradient + music-note placeholder that
// needs no network and is always safe to show.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchSongImage,
  SongImage as SongImageData,
} from "../../util/songImages";
import {
  getSongImagesEnabled,
  getSongImageSource,
} from "../../util/preferences";

// Gradient pairs used for the placeholder, chosen deterministically per song.
const PLACEHOLDER_GRADIENTS: [string, string][] = [
  ["#ff5722", "#ff8a50"],
  ["#3f51b5", "#5c6bc0"],
  ["#009688", "#4db6ac"],
  ["#9c27b0", "#ba68c8"],
  ["#e91e63", "#f06292"],
  ["#2196f3", "#64b5f6"],
  ["#ff9800", "#ffb74d"],
  ["#607d8b", "#90a4ae"],
];

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

type SongImageProps = {
  name: string;
  artist: string;
  size?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  /** Fires once artwork resolves (or fails) so parents can show attribution. */
  onResolved?: (image: SongImageData | null) => void;
};

export default function SongImage({
  name,
  artist,
  size = 280,
  borderRadius = 20,
  style,
  onResolved,
}: SongImageProps) {
  const [image, setImage] = useState<SongImageData | null>(null);
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  const [gradientStart, gradientEnd] = useMemo(() => {
    const index = hashString(`${name}${artist}`) % PLACEHOLDER_GRADIENTS.length;
    return PLACEHOLDER_GRADIENTS[index];
  }, [name, artist]);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const enabled = await getSongImagesEnabled();
      if (!enabled) {
        if (!cancelled) {
          setImage(null);
          onResolvedRef.current?.(null);
        }
        return;
      }

      const source = await getSongImageSource();
      const result = await fetchSongImage(name, artist, source);
      if (!cancelled) {
        setImage(result);
        onResolvedRef.current?.(result);
      }
    };

    setImage(null);
    void resolve();

    return () => {
      cancelled = true;
    };
  }, [name, artist]);

  return (
    <View
      style={[{ width: size, height: size, borderRadius, overflow: "hidden" }, style]}
    >
      {/* Placeholder always renders underneath so there's no flash of empty space. */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="songImageGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradientStart} />
            <Stop offset="1" stopColor={gradientEnd} />
          </LinearGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#songImageGrad)" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.placeholderIcon]}>
        <Ionicons name="musical-notes" size={size * 0.32} color="rgba(255,255,255,0.85)" />
      </View>

      {image && (
        <Image
          source={{ uri: image.imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
          cachePolicy="disk"
          accessibilityLabel={`Artwork for ${name} by ${artist}`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholderIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
});
