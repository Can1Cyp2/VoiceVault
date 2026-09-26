// A native ad sitting in a song or artist list, sized like the rows around
// it but marked as separate (see createStyles).
//
// - Real builds: a Google native ad; the row collapses if none loads.
// - Dev builds: Google's test ad; if that fails, the preview template is
//   shown with the failure reason so problems are visible while developing.
// - Expo Go / web: the preview template, since there is no ad SDK there.
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import {
  getCachedSongListAd,
  isAdPreviewMode,
  loadSongListAd,
  setSongListAdMounted,
} from "./songListAds";

type Variant = "search" | "artist";

type Props = {
  // Which list the ad belongs to; one ad is never shown in two lists.
  placement: string;
  slot: number;
  variant?: Variant;
};

export default function SongRowAd(props: Props) {
  return (
    <SongRowAdBoundary>
      {isAdPreviewMode ? <PreviewAdRow variant={props.variant} /> : <LiveAdRow {...props} />}
    </SongRowAdBoundary>
  );
}

function LiveAdRow({ placement, slot, variant = "search" }: Props) {
  const [ad, setAd] = useState<any | null>(() => getCachedSongListAd(placement, slot));
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    setSongListAdMounted(placement, slot, true);
    return () => setSongListAdMounted(placement, slot, false);
  }, [placement, slot]);

  useEffect(() => {
    if (ad) return;
    let active = true;
    loadSongListAd(placement, slot).then((result) => {
      if (!active) return;
      setAd(result.ad);
      setFailure(result.reason);
    });
    return () => {
      active = false;
    };
  }, [placement, slot, ad]);

  if (ad) return <NativeAdRow ad={ad} variant={variant} />;
  if (__DEV__ && failure) return <PreviewAdRow variant={variant} note={`Dev only · ${failure}`} />;
  // Nothing is reserved while loading or after a failure, so a missing ad
  // never leaves an empty card in the list.
  return null;
}

function NativeAdRow({ ad, variant }: { ad: any; variant: Variant }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Required lazily: the native module does not exist in Expo Go, and
  // importing it at the top of the file would crash there.
  const {
    NativeAdView,
    NativeAsset,
    NativeAssetType,
    NativeMediaView,
  } = require("react-native-google-mobile-ads");

  const subtitle = ad.advertiser || ad.body;

  // NativeAdView gets no padding or border: on iOS it lays its children out
  // inside its own padded content box while their positions already include
  // that padding, so both end up applied twice. The card styling lives on a
  // plain View outside it and the padding on a plain View inside it.
  return (
    <View style={[styles.card, variantMargins[variant]]}>
      <NativeAdView nativeAd={ad}>
        <View style={[styles.content, variantPadding[variant]]}>
          {ad.icon?.url ? (
            // App icon, not the main media: app-install media is often a
            // video, which cannot play in a slot this small.
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: ad.icon.url }} style={styles.media} />
            </NativeAsset>
          ) : (
            <View style={styles.media}>
              <NativeMediaView style={styles.mediaView} resizeMode="cover" />
            </View>
          )}
          <View style={styles.textContainer}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.headline} numberOfLines={1}>
                {ad.headline}
              </Text>
            </NativeAsset>
            <View style={styles.subtitleRow}>
              <AdBadge styles={styles} />
              {!!subtitle && (
                <NativeAsset
                  assetType={ad.advertiser ? NativeAssetType.ADVERTISER : NativeAssetType.BODY}
                >
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {subtitle}
                  </Text>
                </NativeAsset>
              )}
            </View>
          </View>
          {!!ad.callToAction && (
            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <Text style={styles.cta} numberOfLines={1}>
                {ad.callToAction}
              </Text>
            </NativeAsset>
          )}
        </View>
      </NativeAdView>
    </View>
  );
}

// Same layout as a real ad, filled with placeholder content.
function PreviewAdRow({ variant = "search", note }: { variant?: Variant; note?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const explain = () =>
    Alert.alert(
      "Ad preview",
      "In installed builds, a Google native ad appears in this slot, styled like this. " +
        "If no ad can be loaded, the slot is hidden."
    );

  return (
    <Pressable onPress={explain} style={[styles.card, variantMargins[variant]]}>
      <View style={[styles.content, variantPadding[variant]]}>
        <View style={[styles.media, styles.previewMedia]}>
          <Ionicons name="megaphone" size={22} color={colors.secondary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.headline} numberOfLines={1}>
            Sponsored app or product
          </Text>
          <View style={styles.subtitleRow}>
            <AdBadge styles={styles} />
            <Text style={styles.subtitle} numberOfLines={1}>
              {note ?? "Advertiser name · Preview"}
            </Text>
          </View>
        </View>
        <Text style={styles.cta} numberOfLines={1}>
          Install
        </Text>
      </View>
    </Pressable>
  );
}

function AdBadge({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.adBadge}>
      <Text style={styles.adBadgeText}>Ad</Text>
    </View>
  );
}

// An ad must never take the song list down with it.
class SongRowAdBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.log("Song list ad failed to render:", error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

// Geometry copied from each screen's song card so the ad lines up.
const variantMargins = StyleSheet.create({
  search: { marginVertical: 6, marginHorizontal: 16 },
  artist: { marginHorizontal: 20, marginBottom: 15 },
});

const variantPadding = StyleSheet.create({
  search: { padding: 17 },
  artist: { padding: 20 },
});

// Same card shape and shadow as a song row so the list stays even. What
// marks it as an ad: a faint blue outline, a square app icon where songs
// have a round orange note, the gold "Ad" badge, and a solid blue button
// (song rows use orange and never have buttons).
const createStyles = (colors: typeof import("../../styles/theme").LightColors) =>
  StyleSheet.create({
    card: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: `${colors.secondary}59`,
      backgroundColor: colors.backgroundCard,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    content: {
      flexDirection: "row",
      alignItems: "center",
    },
    media: {
      width: 45,
      height: 45,
      borderRadius: 10,
      overflow: "hidden",
      marginRight: 12,
      backgroundColor: colors.lightGray,
    },
    mediaView: {
      width: 45,
      height: 45,
    },
    previewMedia: {
      justifyContent: "center",
      alignItems: "center",
    },
    textContainer: {
      flex: 1,
    },
    headline: {
      fontSize: 16.5,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    subtitleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },
    adBadge: {
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      marginRight: 6,
      backgroundColor: colors.gold,
    },
    adBadgeText: {
      color: "#1a1a1a",
      fontSize: 11,
      fontWeight: "700",
    },
    subtitle: {
      flexShrink: 1,
      fontSize: 13,
      color: colors.textSecondary,
    },
    cta: {
      marginLeft: 10,
      maxWidth: 100,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: colors.secondary,
      color: colors.buttonText,
      fontSize: 13,
      fontWeight: "700",
      overflow: "hidden",
    },
  });
