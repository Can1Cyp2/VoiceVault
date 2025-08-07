// components/AdService.ts
import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import { useState, useEffect } from "react";
import { getSession, supabase } from "../../util/supabase";
import Toast from "react-native-toast-message";

const isExpoGo = Constants.appOwnership === "expo";
const isDev = __DEV__;

class AdService {
  private rewardedAd: any = null;
  private interstitialAd: any = null;
  private isInitialized = false;
  private adCount = 0;
  private lastAdTime = 0;
  private lastAdType: "rewarded" | "interstitial" | null = null; // Track last ad type
  private readonly MIN_LONG_AD_INTERVAL = 30000; // 30 seconds between long ads
  private readonly MIN_AD_INTERVAL = 5000; // 5 seconds between short ads
  private readonly MAX_ADS_PER_SESSION = 25;

  async initialize() {
    if (this.isInitialized || isExpoGo) return;

    try {
      const {
        RewardedAd,
        InterstitialAd,
        RewardedAdEventType,
        AdEventType,
        TestIds,
        MobileAds,
      } = await import("react-native-google-mobile-ads");

      await MobileAds().initialize();

      // Real ad unit IDs from AdMob console
      const rewardedAdUnit = isDev
        ? TestIds.REWARDED
        : Platform.OS === "ios"
        ? "ca-app-pub-7846050438990670/9825538992" // iOS Rewarded
        : "ca-app-pub-7846050438990670/8635778070"; // Android Rewarded

      const interstitialAdUnit = isDev
        ? TestIds.INTERSTITIAL
        : Platform.OS === "ios"
        ? "ca-app-pub-7846050438990670/3136039388" // iOS Interstitial
        : "ca-app-pub-7846050438990670/9677397007"; // Android Interstitial

      // Setup Rewarded Ad
      this.rewardedAd = RewardedAd.createForAdRequest(rewardedAdUnit);
      this.rewardedAd.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          this.onAdReward("rewarded");
        }
      );
      this.rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
        setTimeout(() => this.rewardedAd?.load(), 1000);
      });

      // Setup Interstitial Ad
      this.interstitialAd =
        InterstitialAd.createForAdRequest(interstitialAdUnit);
      this.interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
        this.onAdReward("interstitial");
        setTimeout(() => this.interstitialAd?.load(), 1000);
      });

      // Preload ads
      this.rewardedAd.load();
      this.interstitialAd.load();

      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize ads:", error);
      this.isInitialized = true;
    }
  }

  async showRewardedAd(): Promise<boolean> {
    if (isExpoGo) {
      return this.simulateAdInExpo("rewarded");
    }

    if (!this.canShowAd("rewarded")) return false; // Pass "rewarded"

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.rewardedAd.show();
      this.recordAdShow("rewarded"); // Pass "rewarded"
      return true;
    } catch (error) {
      Alert.alert("Ad Not Ready", "Please wait a moment and try again.");
      this.rewardedAd?.load();
      return false;
    }
  }

  async showInterstitialAd(): Promise<boolean> {
    if (isExpoGo) {
      return this.simulateAdInExpo("interstitial");
    }

    if (!this.canShowAd("interstitial")) return false; // Pass "interstitial"

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.interstitialAd.show();
      this.recordAdShow("interstitial"); // Pass "interstitial"
      return true;
    } catch (error) {
      this.interstitialAd?.load();
      return false;
    }
  }

  private canShowAd(adType?: "rewarded" | "interstitial"): boolean { // Add optional parameter
    const now = Date.now();
    const timeSinceLastAd = now - this.lastAdTime;

    // Use different intervals based on ad type
    const requiredInterval = adType === "rewarded" ? this.MIN_LONG_AD_INTERVAL : this.MIN_AD_INTERVAL;

    if (timeSinceLastAd < requiredInterval) {
      const waitTime = Math.ceil(
        (requiredInterval - timeSinceLastAd) / 1000
      );
      Alert.alert(
        "Please Wait",
        `You can watch another ad in ${waitTime} seconds.`
      );
      return false;
    }

    if (this.adCount >= this.MAX_ADS_PER_SESSION) {
      Alert.alert(
        "Daily Limit",
        "You've reached the daily ad limit. Thanks for your support!"
      );
      return false;
    }

    return true;
  }

  private recordAdShow(adType?: "rewarded" | "interstitial") { // Add optional parameter
    this.adCount++;
    this.lastAdTime = Date.now();
    if (adType) this.lastAdType = adType; // Track ad type
  }

  private simulateAdInExpo(
    type: "rewarded" | "interstitial"
  ): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        "Preview Mode",
        `In the full app, users would watch a ${type} ad here.`,
        [
          {
            text: "Simulate Success",
            onPress: () => {
              this.onAdReward(type);
              this.recordAdShow(type); // Pass type
              resolve(true);
            },
          },
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
        ]
      );
    });
  }

  private async onAdReward(type: "rewarded" | "interstitial") {
    const rewardAmount = type === "rewarded" ? 10 : 3;

    const session = await getSession();
    if (!session) {
      Alert.alert("Not Logged In", "You need to log in to earn rewards.");
      return;
    }
    if (!session?.session?.user) {
      Toast.show({
        type: 'info',
        text1: 'Ad Watched',
        text2: `Coins Earned: ${rewardAmount} (Not saved)`,
        visibilityTime: 3000,
      });
      return;
    }

    const userId = session.session.user.id;

    // Upsert user's coin count
    const { data, error } = await supabase.rpc("increment_user_coins", {
      reward: rewardAmount,
    });

    if (error) {
      console.error("Error updating coins:", error.message);
      Alert.alert("Error", "Failed to update your coin balance.");
    } else {
      Toast.show({
        type: 'success',
        text1: 'Ad Watched',
        text2: `Coins Earned: ${rewardAmount}`,
        visibilityTime: 3000,
      });
    }
  }

  getAdStats() {
    const now = Date.now();
    const timeSinceLastAd = now - this.lastAdTime;
    
    // Use the correct interval based on the last ad type shown
    const lastAdInterval = this.lastAdType === "rewarded" 
      ? this.MIN_LONG_AD_INTERVAL 
      : this.MIN_AD_INTERVAL;

    return {
      adsWatched: this.adCount,
      canWatchMore: this.adCount < this.MAX_ADS_PER_SESSION,
      timeUntilNextAd: Math.max(0, lastAdInterval - timeSinceLastAd),
      remainingAds: this.MAX_ADS_PER_SESSION - this.adCount,
    };
  }
}

export const adService = new AdService();

// React Hook
export const useAds = () => {
  const [stats, setStats] = useState(adService.getAdStats());

  useEffect(() => {
    adService.initialize();

    const updateStats = () => setStats(adService.getAdStats());
    const interval = setInterval(updateStats, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    ...stats,
    showRewardedAd: () => adService.showRewardedAd(),
    showInterstitialAd: () => adService.showInterstitialAd(),
    isExpoGo,
  };
};