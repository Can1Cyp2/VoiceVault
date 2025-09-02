// components/AdService.ts
import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import { useState, useEffect } from "react";
import { getSession, supabase } from "../../util/supabase";
import Toast from "react-native-toast-message";

const isExpoGo = Constants.appOwnership === "expo";
const isDev = __DEV__;

// Consistent test device ID across the app
const ADMIN_TEST_DEVICE_ID = "3BCF74E4-2002-4788-B97C-84D1F37DEBC7";

class AdService {
  private rewardedAd: any = null;
  private interstitialAd: any = null;
  private isInitialized = false;
  private adCount = 0;
  private lastAdTime = 0;
  private lastAdType: "rewarded" | "interstitial" | null = null;
  private readonly MIN_LONG_AD_INTERVAL = 30000;
  private readonly MIN_AD_INTERVAL = 5000;
  private readonly MAX_ADS_PER_SESSION = 25;
  private RewardedAd: any = null;
  private InterstitialAd: any = null;
  private AdEventType: any = null;
  private RewardedAdEventType: any = null;

  async initialize() {
    if (this.isInitialized || isExpoGo) return;

    try {
      const {
        RewardedAd,
        InterstitialAd,
        TestIds,
        MobileAds,
        AdEventType,
        RewardedAdEventType,
      } = await import("react-native-google-mobile-ads");

      // Store references for later use
      this.RewardedAd = RewardedAd;
      this.InterstitialAd = InterstitialAd;
      this.AdEventType = AdEventType;
      this.RewardedAdEventType = RewardedAdEventType;

      // Configure test device FIRST - before any SDK operations
      if (isDev) {
        console.log(`Configuring test device: ${ADMIN_TEST_DEVICE_ID}`);
        await MobileAds().setRequestConfiguration({
          testDeviceIdentifiers: [ADMIN_TEST_DEVICE_ID],
        });
        console.log("Test device configured");
      }

      // Initialize SDK
      console.log("Initializing AdMob SDK...");
      await MobileAds().initialize();
      console.log("AdMob SDK initialized successfully");

      // Handle consent
      await this.initConsent();

      // Choose ad unit IDs
      const rewardedAdUnit = isDev
        ? TestIds.REWARDED
        : Platform.OS === "ios"
        ? "ca-app-pub-7846050438990670/9825538992"
        : "ca-app-pub-7846050438990670/8635778070";

      const interstitialAdUnit = isDev
        ? TestIds.INTERSTITIAL
        : Platform.OS === "ios"
        ? "ca-app-pub-7846050438990670/3136039388"
        : "ca-app-pub-7846050438990670/9677397007";

      console.log("Creating ad instances...", {
        rewardedAdUnit,
        interstitialAdUnit,
        platform: Platform.OS,
        isDev,
      });

      // Create ads with proper request options
      const requestOptions = await this.currentRequestOptions();

      // Create rewarded ad instance
      this.rewardedAd = RewardedAd.createForAdRequest(
        rewardedAdUnit,
        requestOptions
      );

      // ✅ FIXED: Use AdEventType consistently for all events
      this.rewardedAd.addAdEventListener(AdEventType.LOADED, () => {
        console.log("Rewarded ad loaded successfully");
      });

      this.rewardedAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.error("Rewarded ad error:", error);
      });

      // ✅ FIXED: This is the only RewardedAdEventType we need
      this.rewardedAd.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward: any) => {
          console.log("User earned reward:", reward);
          this.onAdReward("rewarded");
        }
      );

      this.rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
        console.log("Rewarded ad closed, preloading next ad...");
        // Add delay to prevent immediate reload issues
        setTimeout(() => this.preloadRewardedAd(), 2000);
      });

      // Create interstitial ad instance
      this.interstitialAd = InterstitialAd.createForAdRequest(
        interstitialAdUnit,
        requestOptions
      );

      this.interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
        console.log("Interstitial ad loaded successfully");
      });

      this.interstitialAd.addAdEventListener(
        AdEventType.ERROR,
        (error: any) => {
          console.error("Interstitial ad error:", error);
        }
      );

      this.interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
        console.log("Interstitial ad closed");
        this.onAdReward("interstitial");
        // Add delay to prevent immediate reload issues
        setTimeout(() => this.preloadInterstitialAd(), 2000);
      });

      // Wait a moment before initial preload to ensure ads are fully set up
      setTimeout(() => {
        this.preloadRewardedAd();
        this.preloadInterstitialAd();
      }, 1000);

      this.isInitialized = true;
      console.log("AdService initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ads:", error);
      // Still mark as initialized to prevent infinite retry loops
      this.isInitialized = true;
    }
  }

  private async initConsent() {
    if (isExpoGo) return;

    try {
      const { AdsConsent } = await import("react-native-google-mobile-ads");

      console.log("Requesting consent info update...");
      await AdsConsent.requestInfoUpdate({});

      console.log("Gathering consent...");
      await AdsConsent.gatherConsent();

      const info = await AdsConsent.getConsentInfo();
      console.log("Consent status:", info);

      // Check if we can request ads
      if (info.canRequestAds === false) {
        console.warn("Cannot request ads due to consent status");
        return false;
      }
      return true;
    } catch (error) {
      console.error("Consent initialization error:", error);
      // Don't throw, continue with ads anyway for development
      return true;
    }
  }

  private async currentRequestOptions() {
    if (isExpoGo) return {};

    try {
      const { AdsConsent } = await import("react-native-google-mobile-ads");
      const choices = await AdsConsent.getUserChoices().catch(() => null);

      const allowPersonalized =
        choices?.selectPersonalisedAds === true &&
        choices?.storeAndAccessInformationOnDevice !== false;

      console.log("Ad request options:", { allowPersonalized });
      return { requestNonPersonalizedAdsOnly: !allowPersonalized };
    } catch (error) {
      console.error("Error getting request options:", error);
      return {};
    }
  }

  private async preloadRewardedAd() {
    if (!this.rewardedAd || !this.isInitialized) return;

    try {
      console.log("Preloading rewarded ad...");
      const options = await this.currentRequestOptions();
      await this.rewardedAd.load(options);
    } catch (error) {
      console.error("Error preloading rewarded ad:", error);
    }
  }

  private async preloadInterstitialAd() {
    if (!this.interstitialAd || !this.isInitialized) return;

    try {
      console.log("Preloading interstitial ad...");
      const options = await this.currentRequestOptions();
      await this.interstitialAd.load(options);
    } catch (error) {
      console.error("Error preloading interstitial ad:", error);
    }
  }

  async showRewardedAd(): Promise<boolean> {
    if (isExpoGo) return this.simulateAdInExpo("rewarded");
    if (!this.canShowAd("rewarded")) return false;
    if (!this.isInitialized) await this.initialize();

    try {
      console.log("Attempting to show rewarded ad...");

      // ✅ FIXED: Check if ad exists and is loaded properly
      if (!this.rewardedAd) {
        console.error("Rewarded ad instance not created");
        return false;
      }

      if (!this.rewardedAd.loaded) {
        console.log("Rewarded ad not loaded, loading now...");
        Alert.alert("Loading Ad", "Please wait a moment while the ad loads...");
        const options = await this.currentRequestOptions();
        await this.rewardedAd.load(options);

        // ✅ FIXED: Wait for load with proper event handling
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Load timeout")),
            10000
          );

          const loadedListener = () => {
            clearTimeout(timeout);
            // ✅ FIXED: Safe event listener removal
            if (this.rewardedAd && this.AdEventType) {
              this.rewardedAd.removeAdEventListener(
                this.AdEventType.LOADED,
                loadedListener
              );
            }
            resolve(true);
          };

          const errorListener = (error: any) => {
            clearTimeout(timeout);
            // ✅ FIXED: Safe event listener removal
            if (this.rewardedAd && this.AdEventType) {
              this.rewardedAd.removeAdEventListener(
                this.AdEventType.ERROR,
                errorListener
              );
            }
            reject(error);
          };

          // ✅ FIXED: Use AdEventType consistently
          if (this.rewardedAd && this.AdEventType) {
            this.rewardedAd.addAdEventListener(
              this.AdEventType.LOADED,
              loadedListener
            );
            this.rewardedAd.addAdEventListener(
              this.AdEventType.ERROR,
              errorListener
            );
          } else {
            reject(new Error("Ad instance or event types not available"));
          }
        });
      }

      await this.rewardedAd.show();
      this.recordAdShow("rewarded");
      console.log("Rewarded ad shown successfully");
      return true;
    } catch (error) {
      console.error("Error showing rewarded ad:", error);
      Alert.alert(
        "Ad Not Available",
        "Unable to load ad at this time. Please try again later."
      );
      this.preloadRewardedAd();
      return false;
    }
  }

  async showInterstitialAd(): Promise<boolean> {
    if (isExpoGo) return this.simulateAdInExpo("interstitial");
    if (!this.canShowAd("interstitial")) return false;
    if (!this.isInitialized) await this.initialize();

    try {
      console.log("Attempting to show interstitial ad...");

      // ✅ FIXED: Check if ad exists and is loaded properly
      if (!this.interstitialAd) {
        console.error("Interstitial ad instance not created");
        return false;
      }

      if (!this.interstitialAd.loaded) {
        console.log("Interstitial ad not loaded, loading now...");
        const options = await this.currentRequestOptions();
        await this.interstitialAd.load(options);

        // ✅ FIXED: Wait for load with proper error handling
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Load timeout")),
            10000
          );

          const loadedListener = () => {
            clearTimeout(timeout);
            // ✅ FIXED: Safe event listener removal
            if (this.interstitialAd && this.AdEventType) {
              this.interstitialAd.removeAdEventListener(
                this.AdEventType.LOADED,
                loadedListener
              );
            }
            resolve(true);
          };

          const errorListener = (error: any) => {
            clearTimeout(timeout);
            // ✅ FIXED: Safe event listener removal
            if (this.interstitialAd && this.AdEventType) {
              this.interstitialAd.removeAdEventListener(
                this.AdEventType.ERROR,
                errorListener
              );
            }
            reject(error);
          };

          // ✅ FIXED: Check if instances exist before adding listeners
          if (this.interstitialAd && this.AdEventType) {
            this.interstitialAd.addAdEventListener(
              this.AdEventType.LOADED,
              loadedListener
            );
            this.interstitialAd.addAdEventListener(
              this.AdEventType.ERROR,
              errorListener
            );
          } else {
            reject(new Error("Ad instance or event types not available"));
          }
        });
      }

      await this.interstitialAd.show();
      this.recordAdShow("interstitial");
      console.log("Interstitial ad shown successfully");
      return true;
    } catch (error) {
      console.error("Error showing interstitial ad:", error);
      this.preloadInterstitialAd();
      return false;
    }
  }

  private canShowAd(adType?: "rewarded" | "interstitial"): boolean {
    const now = Date.now();
    const timeSinceLastAd = now - this.lastAdTime;

    const requiredInterval =
      adType === "rewarded" ? this.MIN_LONG_AD_INTERVAL : this.MIN_AD_INTERVAL;

    if (timeSinceLastAd < requiredInterval) {
      const waitTime = Math.ceil((requiredInterval - timeSinceLastAd) / 1000);
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

  private recordAdShow(adType?: "rewarded" | "interstitial") {
    this.adCount++;
    this.lastAdTime = Date.now();
    if (adType) this.lastAdType = adType;
    console.log(`Ad shown: ${adType}, total ads: ${this.adCount}`);
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
              this.recordAdShow(type);
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
        type: "info",
        text1: "Ad Watched",
        text2: `Coins Earned: ${rewardAmount} (Not saved)`,
        visibilityTime: 3000,
      });
      return;
    }

    const userId = session.session.user.id;

    const { data, error } = await supabase.rpc("increment_user_coins", {
      reward: rewardAmount,
    });

    if (error) {
      console.error("Error updating coins:", error.message);
      Alert.alert("Error", "Failed to update your coin balance.");
    } else {
      Toast.show({
        type: "success",
        text1: "Ad Watched",
        text2: `Coins Earned: ${rewardAmount}`,
        visibilityTime: 3000,
      });
    }
  }

  getAdStats() {
    const now = Date.now();
    const timeSinceLastAd = now - this.lastAdTime;

    const lastAdInterval =
      this.lastAdType === "rewarded"
        ? this.MIN_LONG_AD_INTERVAL
        : this.MIN_AD_INTERVAL;

    return {
      adsWatched: this.adCount,
      canWatchMore: this.adCount < this.MAX_ADS_PER_SESSION,
      timeUntilNextAd: Math.max(0, lastAdInterval - timeSinceLastAd),
      remainingAds: this.MAX_ADS_PER_SESSION - this.adCount,
    };
  }

  // Add method to get test device ID for debugging
  getTestDeviceId(): string {
    return ADMIN_TEST_DEVICE_ID;
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
    getTestDeviceId: () => adService.getTestDeviceId(),
    isExpoGo,
  };
};