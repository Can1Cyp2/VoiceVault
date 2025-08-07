import React from 'react';
import { View, Text, Button } from 'react-native';
import { useAds } from '../../components/SupportModal/AdService';

const DonateScreen = () => {
  const { showRewardedAd, isExpoGo } = useAds();

  const handleShowAd = async () => {
    await showRewardedAd();
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 20, marginBottom: 20 }}>
        Watch an Ad to Support the App!
      </Text>
      <Button 
        title={isExpoGo ? "Try Ad (Preview)" : "Watch Ad"} 
        onPress={handleShowAd} 
      />
    </View>
  );
};

export default DonateScreen;