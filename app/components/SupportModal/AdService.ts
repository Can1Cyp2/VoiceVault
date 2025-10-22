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
  private interstitialWasShown = false; // Track if interstitial was actually shown
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

      // Request iOS App Tracking Transparency permission first (iOS 14.5+)
      if (Platform.OS === 'ios') {
        await this.requestIOSTrackingPermission();
      }

      // Configure test device FIRST - before any SDK operations
      if (isDev) {
        console.log(`Configuring test device: ${ADMIN_TEST_DEVICE_ID}`);
        await MobileAds().setRequestConfiguration({
          testDeviceIdentifiers: [ADMIN_TEST_DEVICE_ID],
          // Add additional privacy controls for testing
          tagForChildDirectedTreatment: false, // False because app does not directly target children
          tagForUnderAgeOfConsent: false, // False because app does not directly target children. only set to true for users under consent age in their country
        });
        console.log("Test device configured");
      }

      // Initialize SDK
      console.log("Initializing AdMob SDK...");
      const initResult = await MobileAds().initialize();
      console.log("✅ AdMob SDK initialized successfully");
      console.log("SDK initialization result:", initResult);

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

      // ✅ FIXED: Use RewardedAdEventType for LOADED event only
      this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        console.log("Rewarded ad loaded successfully");
      });

      // ✅ Use AdEventType for ERROR and CLOSED (these don't exist in RewardedAdEventType)
      this.rewardedAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.error("Rewarded ad error:", error);
      });

      // ✅ Earned reward event
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
      console.log("Creating interstitial ad instance...");
      try {
        this.interstitialAd = InterstitialAd.createForAdRequest(
          interstitialAdUnit,
          requestOptions
        );
        console.log("✅ Interstitial ad instance created:", !!this.interstitialAd);
      } catch (error) {
        console.error("❌ CRITICAL: Failed to create interstitial ad:", error);
        throw error; // Re-throw to see the full error
      }

      this.interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
        console.log("✅ Interstitial ad loaded successfully");
      });

      this.interstitialAd.addAdEventListener(
        AdEventType.ERROR,
        (error: any) => {
          console.error("❌ Interstitial ad error during preload:", error);
          console.error("Error code:", error?.code);
          console.error("Error message:", error?.message);
        }
      );

      // Track when ad is actually shown (impression)
      this.interstitialAd.addAdEventListener(AdEventType.OPENED, () => {
        console.log("✅ Interstitial ad opened/shown");
        this.interstitialWasShown = true;
      });

      this.interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
        console.log("Interstitial ad closed");
        // Only give reward if ad was actually shown (not closed before showing)
        if (this.interstitialWasShown) {
          console.log("Ad was shown - giving reward");
          this.onAdReward("interstitial");
          this.interstitialWasShown = false; // Reset flag
        } else {
          console.log("Ad was not shown - no reward");
        }
        // Add delay to prevent immediate reload issues
        setTimeout(() => this.preloadInterstitialAd(), 2000);
      });

      // Wait a moment before initial preload to ensure ads are fully set up
      setTimeout(() => {
        console.log("Starting ad preload...");
        console.log("Rewarded ad instance exists:", !!this.rewardedAd);
        console.log("Interstitial ad instance exists:", !!this.interstitialAd);
        this.preloadRewardedAd();
        this.preloadInterstitialAd();
      }, 1000);

      this.isInitialized = true;
      console.log("✅ AdService initialized successfully");
      console.log("Final check - Rewarded ad:", !!this.rewardedAd, "Interstitial ad:", !!this.interstitialAd);
    } catch (error: any) {
      console.error("❌ Failed to initialize ads:", error);
      console.error("Error message:", error?.message);
      console.error("Error stack:", error?.stack);
      console.error("Rewarded ad created:", !!this.rewardedAd);
      console.error("Interstitial ad created:", !!this.interstitialAd);
      
      // Show alert to user about the specific error
      Alert.alert(
        "Ad Initialization Error",
        `Failed to initialize ads: ${error?.message || 'Unknown error'}\n\nRewarded: ${!!this.rewardedAd ? 'OK' : 'FAILED'}\nInterstitial: ${!!this.interstitialAd ? 'OK' : 'FAILED'}`
      );
      
      // Still mark as initialized to prevent infinite retry loops
      this.isInitialized = true;
    }
  }

  private async requestIOSTrackingPermission() {
    if (Platform.OS !== 'ios') return;

    try {
      // Dynamically import expo-tracking-transparency
      const TrackingTransparency = await import('expo-tracking-transparency');
      
      // Request tracking permissions
      const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
      
      console.log('iOS Tracking Permission Status:', status);
      
      if (status === 'granted') {
        console.log('Tracking permission granted - personalized ads enabled');
      } else {
        console.log('Tracking permission denied - using non-personalized ads');
      }
      
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting iOS tracking permission:', error);
      // Continue without tracking permission
      return false;
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

      let allowPersonalized =
        choices?.selectPersonalisedAds === true &&
        choices?.storeAndAccessInformationOnDevice !== false;

      // On iOS, also check App Tracking Transparency status
      if (Platform.OS === 'ios') {
        try {
          const TrackingTransparency = await import('expo-tracking-transparency');
          const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
          
          // Only allow personalized ads if both GDPR consent AND iOS tracking are granted
          if (status !== 'granted') {
            allowPersonalized = false;
            console.log('iOS tracking denied - forcing non-personalized ads');
          }
        } catch (error) {
          console.error('Error checking iOS tracking status:', error);
          allowPersonalized = false;
        }
      }

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
    
    if (!this.isInitialized) {
      console.log("AdService not initialized, initializing now...");
      await this.initialize();
      // Give it a moment to finish initialization
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
      console.log("Attempting to show rewarded ad...");
      console.log("Ad initialization status:", this.isInitialized);
      console.log("Ad instance exists:", !!this.rewardedAd);

      // ✅ FIXED: Check if ad exists and is loaded properly
      if (!this.rewardedAd) {
        console.error("❌ Rewarded ad instance not created");
        Alert.alert(
          "Ad Error",
          "Ad system not initialized. Please restart the app and try again."
        );
        return false;
      }

      console.log("Checking if ad is loaded:", this.rewardedAd.loaded);
      if (!this.rewardedAd.loaded) {
        console.log("Rewarded ad not loaded, loading now...");
        Alert.alert("Loading Ad", "Please wait a moment while the ad loads...");
        const options = await this.currentRequestOptions();
        console.log("Loading ad with options:", options);
        console.log("Loading ad with options:", options);
        await this.rewardedAd.load(options);

        // ✅ FIXED: Wait for load with proper event handling
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error("❌ Ad load timeout after 10 seconds");
            reject(new Error("Load timeout"));
          }, 10000);

          const loadedListener = () => {
            console.log("✅ Ad loaded successfully");
            clearTimeout(timeout);
            // ✅ FIXED: Safe event listener removal - Use RewardedAdEventType for RewardedAd
            if (this.rewardedAd && this.RewardedAdEventType) {
              this.rewardedAd.removeAdEventListener(
                this.RewardedAdEventType.LOADED,
                loadedListener
              );
            }
            resolve(true);
          };

          const errorListener = (error: any) => {
            console.error("❌ Ad load error:", error);
            console.error("Error code:", error?.code);
            console.error("Error message:", error?.message);
            clearTimeout(timeout);
            // ✅ FIXED: Use AdEventType for ERROR event
            if (this.rewardedAd && this.AdEventType) {
              this.rewardedAd.removeAdEventListener(
                this.AdEventType.ERROR,
                errorListener
              );
            }
            reject(error);
          };

          // ✅ FIXED: Use RewardedAdEventType for LOADED, AdEventType for ERROR
          if (this.rewardedAd && this.RewardedAdEventType && this.AdEventType) {
            this.rewardedAd.addAdEventListener(
              this.RewardedAdEventType.LOADED,
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

      console.log("Showing ad now...");
      await this.rewardedAd.show();
      this.recordAdShow("rewarded");
      console.log("✅ Rewarded ad shown successfully");
      return true;
    } catch (error: any) {
      console.error("❌ Error showing rewarded ad:", error);
      console.error("Error code:", error?.code);
      console.error("Error message:", error?.message);
      console.error("Error stack:", error?.stack);
      
      // Provide more specific error messages
      let errorMessage = "Unable to load ad at this time. Please try again later.";
      
      if (error?.code === 3) {
        errorMessage = "No ad inventory available right now. Please try again in a few minutes.";
      } else if (error?.message?.includes("timeout")) {
        errorMessage = "Ad loading timed out. Please check your internet connection.";
      }
      
      Alert.alert("Ad Not Available", errorMessage);
      this.preloadRewardedAd();
      return false;
    }
  }

  async showInterstitialAd(): Promise<boolean> {
    if (isExpoGo) return this.simulateAdInExpo("interstitial");
    if (!this.canShowAd("interstitial")) return false;
    
    if (!this.isInitialized) {
      console.log("AdService not initialized, initializing now...");
      await this.initialize();
      // Give it a moment to finish initialization
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
      console.log("Attempting to show interstitial ad...");
      console.log("Ad initialization status:", this.isInitialized);
      console.log("Interstitial ad instance exists:", !!this.interstitialAd);

      // ✅ FIXED: Check if ad exists and is loaded properly
      if (!this.interstitialAd) {
        console.error("❌ Interstitial ad instance not created");
        Alert.alert(
          "Ad Error",
          "Interstitial ad system not initialized. Please restart the app and try again."
        );
        return false;
      }

      console.log("Checking if interstitial ad is loaded:", this.interstitialAd.loaded);
      if (!this.interstitialAd.loaded) {
        console.log("Interstitial ad not loaded, loading now...");
        const options = await this.currentRequestOptions();
        console.log("Loading interstitial ad with options:", options);
        console.log("Loading interstitial ad with options:", options);
        await this.interstitialAd.load(options);

        // ✅ FIXED: Wait for load with proper error handling
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error("❌ Interstitial ad load timeout after 10 seconds");
            reject(new Error("Load timeout"));
          }, 10000);

          const loadedListener = () => {
            console.log("✅ Interstitial ad loaded successfully");
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
            console.error("❌ Interstitial ad load error:", error);
            console.error("Error code:", error?.code);
            console.error("Error message:", error?.message);
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

      console.log("Showing interstitial ad now...");
      this.interstitialWasShown = false; // Reset before showing
      await this.interstitialAd.show();
      this.recordAdShow("interstitial");
      console.log("✅ Interstitial ad shown successfully");
      return true;
    } catch (error: any) {
      console.error("❌ Error showing interstitial ad:", error);
      console.error("Error code:", error?.code);
      console.error("Error message:", error?.message);
      console.error("Error stack:", error?.stack);
      
      // Provide more specific error messages
      let errorMessage = "Unable to load interstitial ad at this time. Please try again later.";
      
      if (error?.code === 3) {
        errorMessage = "No ad inventory available right now. Please try again in a few minutes.";
      } else if (error?.message?.includes("timeout")) {
        errorMessage = "Ad loading timed out. Please check your internet connection.";
      } else if (error?.message?.includes("not created") || error?.message?.includes("not available")) {
        errorMessage = "Ad not created. The ad system may still be initializing.";
      }
      
      Alert.alert("Ad Not Available", errorMessage);
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
    
    // Allow ad watching even when not logged in, but don't save rewards
    if (!session || !session?.session?.user) {
      Toast.show({
        type: "info",
        text1: "Thank You for Supporting!",
        text2: "Log in to earn and save coins from watching ads",
        visibilityTime: 4000,
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