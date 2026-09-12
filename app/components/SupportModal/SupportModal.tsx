import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Button,
  Clipboard,
  Linking,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAds } from './AdService';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Used by both the donate button and the copy-link button beside it.
const KOFI_URL = 'https://ko-fi.com/can1cyp2apps';

// How long the copy button shows its "copied" tick before reverting.
const COPIED_FEEDBACK_MS = 1500;

// Info function for the info button
const showSupportInfo = () => {
  Alert.alert(
    "Support Information",
    "There are three ways to support the app:\n\n" +
      "☕ Donate Directly: via Ko-fi, starting at just $1.\n\n" +
      "🎥 Watch Ad: watch a rewarded ad for +10 coins.\n\n" +
      "⚡ Quick Ad: watch a shorter ad for +3 coins.\n\n" +
      "I wanted donating to be as accessible as possible for anyone who'd like to support me, so please feel no pressure to donate!\n\n" +
      "You can normally watch hundreds of ads a day before hitting a cap, but I put a 25 ad cap per session so it never feels like you have to watch endlessly just to support me. Watching ads isn't comparable to the amount of support a donation of any amount would be, but any support at all is much appreciated!\n\n" +
      "I truly am so thankful for all of the support shown!\nThank you.",
    [{ text: "OK", style: "default" }]
  );
};

export const SupportModal = ({ visible, onClose }: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { 
    adsWatched, 
    canWatchMore, 
    timeUntilNextAd, 
    remainingAds,
    showRewardedAd,
    showInterstitialAd,
    isExpoGo 
  } = useAds();

  const handleRewardedAd = async () => {
    const success = await showRewardedAd();
    // Don't close modal - let them watch more ads for more revenue!
  };

  const handleQuickAd = async () => {
    const success = await showInterstitialAd();
    // Don't close modal - let them watch more ads!
  };

  // Swaps the copy icon for a tick briefly; the timer is cleared on unmount so
  // a quick close can't set state on a gone component.
  const [linkCopied, setLinkCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const handleDonate = () => {
    Linking.openURL(KOFI_URL);
    onClose();
  };

  // Copy instead of opening - for anyone who'd rather donate from another
  // device or browser than leave the app.
  const handleCopyLink = () => {
    Clipboard.setString(KOFI_URL);
    setLinkCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setLinkCopied(false), COPIED_FEEDBACK_MS);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    return seconds > 0 ? `${seconds}s` : 'Ready!';
  };

  const adButtonDisabled = !canWatchMore || timeUntilNextAd > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent presentationStyle='overFullScreen'>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header with title and info button */}
          <View style={styles.header}>
            <Text style={styles.title}>Support the Creator</Text>
            <Pressable 
              onPress={showSupportInfo}
              style={styles.infoButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons 
                name="information-circle-outline" 
                size={24} 
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
          
          <Text style={styles.subheader}>
            Your support helps keep the app running and improving!
          </Text>

          {/* Show ad stats */}
          {adsWatched > 0 && (
            <View style={styles.statsContainer}>
              <Text style={styles.statsText}>
                🎬 Ads watched today: {adsWatched}
              </Text>
              {canWatchMore && (
                <Text style={styles.remainingText}>
                  {remainingAds} more available
                </Text>
              )}
            </View>
          )}

          <View style={styles.donateRow}>
            <TouchableOpacity
              style={styles.donateButton}
              onPress={handleDonate}
              accessibilityRole="button"
              accessibilityLabel="Donate directly via Ko-fi"
            >
              <Text style={styles.donateButtonText}>☕ Donate Directly</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.copyLinkButton}
              onPress={handleCopyLink}
              accessibilityRole="button"
              accessibilityLabel={
                linkCopied ? 'Donation link copied' : 'Copy donation link'
              }
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={linkCopied ? 'checkmark' : 'copy-outline'}
                size={20}
                color={linkCopied ? colors.success : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {linkCopied && <Text style={styles.copiedText}>Link copied</Text>}
          
          <View style={{ marginVertical: 10 }} />
          
          <TouchableOpacity 
            style={[styles.adButton, adButtonDisabled && styles.disabledButton]}
            onPress={handleRewardedAd}
            disabled={adButtonDisabled}
          >
            <Text style={styles.adButtonText}>
              {isExpoGo ? "🎬 Try Rewarded Ad (Preview)" : "🎥 Watch Ad (+10 coins)"}
            </Text>
            {timeUntilNextAd > 0 && (
              <Text style={styles.waitText}>
                Wait {formatTime(timeUntilNextAd)}
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ marginVertical: 5 }} />

          <TouchableOpacity 
            style={[styles.quickAdButton, adButtonDisabled && styles.disabledButton]}
            onPress={handleQuickAd}
            disabled={adButtonDisabled}
          >
            <Text style={styles.adButtonText}>
              ⚡ Quick Ad (+3 coins)
            </Text>
          </TouchableOpacity>

          {!canWatchMore && (
            <Text style={styles.limitText}>
              🙏 Daily ad limit reached! Thanks for your support!
            </Text>
          )}

          {isExpoGo && (
            <Text style={styles.note}>
              Preview mode - ads will work in the built app
            </Text>
          )}
          
          <View style={{ marginVertical: 10 }} />
          <Button title="Close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: colors.backgroundCard,
    padding: 20,
    borderRadius: 12,
    width: '80%',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  infoButton: {
    padding: 4,
  },
  note: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  donateRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    gap: 8,
  },
  donateButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donateButtonText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  copyLinkButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copiedText: {
    marginTop: 6,
    fontSize: 12,
    color: colors.success,
    textAlign: 'center',
  },
  subheader: {
    fontSize: 13,
    fontWeight: '300',
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  statsContainer: {
    backgroundColor: colors.backgroundTertiary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  statsText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  remainingText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  adButton: {
    backgroundColor: colors.secondary,
    padding: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  quickAdButton: {
    backgroundColor: colors.link,
    padding: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  adButtonText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  waitText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 4,
  },
  limitText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.warning,
    textAlign: 'center',
    backgroundColor: colors.backgroundTertiary,
    padding: 8,
    borderRadius: 6,
  },
});