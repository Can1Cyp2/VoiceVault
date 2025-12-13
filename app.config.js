// app.config.js
// Developer: Can1Cyp2
// Email: can1cyp2apps@gmail.com
// Website: https://SebastianLandry.ca
require("dotenv").config(); // Load .env.local for local development

module.exports = () => {
  return {
    name: "VoiceVault",
    slug: "VoiceVault",
    version: "1.3.3",
    orientation: "portrait",
    icon: "./assets/dark-glow-nontransparent-icon2.png",
    userInterfaceStyle: "light",
    newArchEnabled: false, // temp

    splash: {
      image: "./assets/dark-glow-nontransparent-icon2.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.can1cyp2.VoiceVault",
      buildNumber: "1.3.3",
      infoPlist: {
        // CRITICAL: AdMob App ID (required by Google Mobile Ads SDK)
        GADApplicationIdentifier: "ca-app-pub-7846050438990670~3247720022",
        // Complete SKAdNetwork setup for iOS 14.5+ ad tracking
        SKAdNetworkItems: [
          // Google AdMob
          { SKAdNetworkIdentifier: "cstr6suwn9.skadnetwork" },
          // Google Ad Manager
          { SKAdNetworkIdentifier: "4fzdc2evr5.skadnetwork" },
          // Unity Ads
          { SKAdNetworkIdentifier: "4468km3ulz.skadnetwork" },
          // Facebook/Meta
          { SKAdNetworkIdentifier: "v9wttpbfk9.skadnetwork" },
          // AppLovin
          { SKAdNetworkIdentifier: "ludvb6z3bs.skadnetwork" },
          // ironSource
          { SKAdNetworkIdentifier: "su67r6k2v3.skadnetwork" },
          // Vungle
          { SKAdNetworkIdentifier: "gta9lk7p23.skadnetwork" },
          // AdColony
          { SKAdNetworkIdentifier: "4pfyvq9l8r.skadnetwork" },
          // Chartboost
          { SKAdNetworkIdentifier: "f38h382jlk.skadnetwork" },
          // InMobi
          { SKAdNetworkIdentifier: "wzmmz9fp6w.skadnetwork" },
          // MyTarget
          { SKAdNetworkIdentifier: "n6fk4nfna4.skadnetwork" },
          // Yandex
          { SKAdNetworkIdentifier: "zq492l623r.skadnetwork" },
          // Tapjoy
          { SKAdNetworkIdentifier: "hs6bdukanm.skadnetwork" },
          // Pangle (TikTok)
          { SKAdNetworkIdentifier: "238da6jt44.skadnetwork" },
          // Mintegral
          { SKAdNetworkIdentifier: "KBD757YWX3.skadnetwork" },
          // Additional Google networks
          { SKAdNetworkIdentifier: "9t245vhmpl.skadnetwork" },
          { SKAdNetworkIdentifier: "9rd848q2bz.skadnetwork" },
          { SKAdNetworkIdentifier: "n6fk4nfna4.skadnetwork" },
          { SKAdNetworkIdentifier: "7ug5zh24hu.skadnetwork" },
          { SKAdNetworkIdentifier: "prc4yf9cyb.skadnetwork" },
          { SKAdNetworkIdentifier: "m8dbw4sv7c.skadnetwork" },
          { SKAdNetworkIdentifier: "c6k4g5qg8m.skadnetwork" },
          { SKAdNetworkIdentifier: "s39g8k73mm.skadnetwork" },
          { SKAdNetworkIdentifier: "3qy4746246.skadnetwork" },
          { SKAdNetworkIdentifier: "f73kdq92p3.skadnetwork" },
          { SKAdNetworkIdentifier: "kbd757ywx3.skadnetwork" },
          { SKAdNetworkIdentifier: "4fzdc2evr5.skadnetwork" },
        ],
        NSUserTrackingUsageDescription:
          "If you choose to watch ads: Your data may be used to deliver more relevant ads and measure ad performance by Google (Admob), VoiceVault does not save this data.",
        NSCameraUsageDescription:
          "This app uses the camera for user profile images. (Future updates may require this permission.)",
        NSPhotoLibraryUsageDescription:
          "This app accesses your photo library for profile picture uploads. (Future updates may require this permission.)",
        ITSAppUsesNonExemptEncryption: false,
        // App Transport Security for ad loading
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSAllowsArbitraryLoadsInWebContent: true,
        },
      },
    },
    android: {
      versionCode: 10301,
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.can1cyp2.VoiceVault",
      permissions: [
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.CHANGE_NETWORK_STATE",
        "android.permission.ACCESS_WIFI_STATE",
        "android.permission.CHANGE_WIFI_STATE",
        "com.google.android.gms.permission.AD_ID",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
      ],
      compileSdkVersion: 35,
      targetSdkVersion: 35,
      config: {
        googleMobileAdsAppId: "ca-app-pub-7846050438990670~7402587455",
      },
      // Add privacy policy for Play Store compliance
      privacyPolicyUrl: "https://can1cyp2.github.io/VoiceVault-Landing/", // Replace with your actual privacy policy URL
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    scheme: "voicevault",
    extra: {
      eas: {
        projectId: "33c93c1e-6118-430e-a6d8-ff2e05458e48",
      },
      SUPABASE_URL: process.env.SUPABASE_URL || "",
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
    },
    owner: "can1cyp2",
    plugins: [
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static",
          },
          android: {
            kotlinVersion: "2.0.21",
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            ndkVersion: "27.0.12077973",
            architectures: ["arm64-v8a", "armeabi-v7a", "x86", "x86_64"],
          },
        },
      ],
      "expo-font",
      "expo-secure-store",
      "expo-video",
      "expo-tracking-transparency",
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: "ca-app-pub-7846050438990670~7402587455",
          iosAppId: "ca-app-pub-7846050438990670~3247720022",
          delay_app_open: 1000,
          user_tracking_usage_description:
            "If you choose to watch ads: Your data may be used to deliver more relevant ads and measure ad performance by Google (Admob), VoiceVault does not save this data.",
        },
      ],
    ],
  };
};
