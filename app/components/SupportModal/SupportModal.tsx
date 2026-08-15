import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Button,
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

// Info function for the info button
const showSupportInfo = () => {
  Alert.alert(
    "Support Information",
    "There are three ways to support the app:\n\n" +
      "☕ Donate Directly – via Ko-fi, starting at just $1.\n\n" +
      "🎥 Watch Ad – watch a rewarded ad for +10 coins.\n\n" +
      "⚡ Quick Ad – watch a shorter ad for +3 coins.\n\n" +
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

  const handleDonate = () => {
    Linking.openURL('https://ko-fi.com/can1cyp2apps');
    onClose();
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

          <Button title="☕ Donate Directly" onPress={handleDonate} />
          
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