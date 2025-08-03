import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Button,
  Linking,
  StyleSheet,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const SupportModal = ({ visible, onClose }: Props) => {
  const isExpoGo = Constants.appOwnership === 'expo';

  const handleWatchAd = async () => {
    if (isExpoGo) {
      Alert.alert(
        'Not Available in Preview',
        'Watching ads is only supported in the full app version.'
      );
      return;
    }

    try {
      const { AdMobRewarded } = await import('expo-ads-admob');
      await AdMobRewarded.setAdUnitID(
        'ca-app-pub-3940256099942544/5224354917'
      );
      await AdMobRewarded.requestAdAsync();
      await AdMobRewarded.showAdAsync();

      AdMobRewarded.addEventListener('rewardedVideoUserDidEarnReward', () => {
        Alert.alert('Thank You!', 'You supported the app by watching an ad!');
        onClose();
      });
    } catch (error) {
      Alert.alert('Ad Not Ready', 'Try again later.');
    }
  };

  const handleDonate = () => {
    Linking.openURL('https://www.Ko-fi.com/voicevault'); // Replace with your link
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent presentationStyle='overFullScreen'>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Support the Creator</Text>
          <Text style={styles.subheader}>
            Your support helps keep the app running and improving!
          </Text>
          <Button title="☕ Donate Directly" onPress={handleDonate} />
          <View style={{ marginVertical: 10 }} />
          <Button title="🎥 Watch an Ad" onPress={handleWatchAd} />
          {isExpoGo && (
            <Text style={styles.note}>
              Ads only work in the full app, not in preview.
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
});
