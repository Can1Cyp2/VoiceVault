// app.config.js
require('dotenv').config(); // Load .env.local for local development

module.exports = () => {
  return {
    name: "VoiceVault",
    slug: "VoiceVault",
    version: "1.2.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.can1cyp2.VoiceVault",
      buildNumber: "1.2.1",
      infoPlist: {
        NSCameraUsageDescription: "This app uses the camera for user profile images. (Future updates may require this permission.)",
        NSPhotoLibraryUsageDescription: "This app accesses your photo library for profile picture uploads. (Future updates may require this permission.)",
        NSMicrophoneUsageDescription: "This app may use the microphone in future updates.",
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      versionCode: 10201,
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.can1cyp2.VoiceVault",
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "CHANGE_NETWORK_STATE",
        "ACCESS_WIFI_STATE",
        "CHANGE_WIFI_STATE"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "33c93c1e-6118-430e-a6d8-ff2e05458e48"
      },
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ''
    },
    owner: "can1cyp2",
    plugins: [
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static"
          },
          android: {
            kotlinVersion: "1.9.25",
            minSdkVersion: 24
          }
        }
      ],
      "expo-secure-store"
    ]
  };
};