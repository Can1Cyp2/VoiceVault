import React, { useEffect } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { AdMobRewarded } from 'expo-ads-admob';

const DonateScreen = () => {
  useEffect(() => {
    // Set your AdMob Rewarded Ad unit ID (test ID used below)
    AdMobRewarded.setAdUnitID('ca-app-pub-3940256099942544/5224354917'); // Use real ID in production
  }, []);

  const showAd = async () => {
    try {
      await AdMobRewarded.requestAdAsync();
      await AdMobRewarded.showAdAsync();

      AdMobRewarded.addEventListener('rewardedVideoUserDidEarnReward', () => {
        Alert.alert("Thank you!", "You just supported the app by watching an ad 🙌");
      });
    } catch (error) {
      Alert.alert("Ad Not Available", "Please try again later.");
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 20, marginBottom: 20 }}>
        Watch an Ad to Support the App!
      </Text>
      <Button title="Watch Ad" onPress={showAd} />
    </View>
  );
};

export default DonateScreen;
