import React, { useMemo } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useAds } from '../../components/SupportModal/AdService';
import { useTheme } from '../../contexts/ThemeContext';

const DonateScreen = () => {
  const { showRewardedAd, isExpoGo } = useAds();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleShowAd = async () => {
    await showRewardedAd();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Watch an Ad to Support the App!
      </Text>
      <Button 
        title={isExpoGo ? "Try Ad (Preview)" : "Watch Ad"} 
        onPress={handleShowAd} 
      />
    </View>
  );
};

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});

export default DonateScreen;