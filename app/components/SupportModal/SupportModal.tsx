import React from 'react';
import {
  Modal,
  View,
  Text,
  Button,
  Linking,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useAds } from './AdService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const SupportModal = ({ visible, onClose }: Props) => {
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
    if (success) {
      onClose();
    }
  };

  const handleDonate = () => {
    Linking.openURL('https://www.Ko-fi.com/voicevault');
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
          <Text style={styles.title}>Support the Creator</Text>
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
              ⚡ Quick Ad (+5 coins)
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '80%',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    marginBottom: 14,
    fontWeight: 'bold',
  },
  note: {
    marginTop: 10,
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  subheader: {
    fontSize: 13,
    fontWeight: '300',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  statsText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  remainingText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  adButton: {
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  quickAdButton: {
    backgroundColor: '#17a2b8',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  adButtonText: {
    color: 'white',
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
    color: '#856404',
    textAlign: 'center',
    backgroundColor: '#fff3cd',
    padding: 8,
    borderRadius: 6,
  },
});