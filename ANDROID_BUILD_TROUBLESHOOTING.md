# Android Build Troubleshooting Guide

This document contains solutions to common Android build issues for VoiceVault.

## Table of Contents
- [Local Android Builds](#local-android-builds)
- [Memory Issues](#memory-issues)
- [SDK Component Requirements](#sdk-component-requirements)
- [Signing & Release Builds](#signing--release-builds)

---

## Local Android Builds

### Prerequisites
- **Android Studio** installed with SDK Manager access
- **JDK** matching your project's Java version
- **Gradle** (or use the wrapper `gradlew`)

### Build Commands
```bash
# From android directory
cd android

# Build unsigned APK
.\gradlew assembleRelease

# Build signed AAB for Play Store
.\gradlew bundleRelease
```

---

## Memory Issues

### Problem: `OutOfMemoryError: Metaspace`
**Symptoms:**
```
Execution failed for task ':expo-updates:kspReleaseKotlin'
> A failure occurred while executing com.google.devtools.ksp.gradle.KspAAWorkerAction
   > Metaspace
```

**Solution:**
Increase Gradle JVM memory in `android/gradle.properties`:

```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
```

**Why it works:** Large React Native/Expo projects with many modules need more memory during Kotlin Symbol Processing (KSP). Default 2GB heap + 512MB metaspace is insufficient.

---

## SDK Component Requirements

### Problem: Missing SDK Components
**Symptoms:**
- `CMake '3.22.1' was not found`
- `No version of NDK matched`
- Build fails at task configuration

**Solution:**
Install exact versions via Android Studio SDK Manager:

1. **Open Android Studio** → Tools → SDK Manager → SDK Tools tab
2. **Check "Show Package Details"** (bottom right)
3. **Install these exact versions:**

| Component | Required Version | Why |
|-----------|-----------------|-----|
| CMake | **3.22.1** | Native C++ compilation for expo-modules-core, react-native-screens |
| NDK | **27.1.12297006** | Side-by-side installation required by Expo SDK 54 |
| Build Tools | **36.0.0** | Latest compatible version |
| Platform SDK | **35 (Android 15.0)** | Target SDK for compileSdk/targetSdk |

**Important Notes:**
- ❌ CMake 4.x will NOT work - must use 3.22.1
- ❌ Newer NDK versions may cause issues - use exact version
- ✅ Multiple versions can coexist (e.g., CMake 3.22.1 + 4.1.2)

**Android SDK Location:**
```
Windows: C:\Users\<username>\AppData\Local\Android\Sdk
Mac: ~/Library/Android/sdk
Linux: ~/Android/Sdk
```

---

## Signing & Release Builds

### Setting Up Keystore for Play Store

#### 1. Download Existing Keystore (if you used EAS before)
```bash
eas credentials
# Select: Keystore → Display/Download
```

#### 2. Create keystore.properties
Create `android/keystore.properties` (this file is git-ignored):

```properties
storePassword=your_store_password
keyPassword=your_key_password
keyAlias=your_key_alias
storeFile=your-keystore.jks
```

**⚠️ Security Note:** Never commit this file! It's protected by `.gitignore`.

#### 3. Place Keystore File
- Download your `.jks` file from EAS
- Place in `android/app/` directory
- Update `storeFile` path in `keystore.properties` to match

#### 4. Build Configuration
The `android/app/build.gradle` is already configured to:
- Load properties from `keystore.properties`
- Sign release builds automatically
- Use debug keystore for debug builds

#### 5. Build Signed AAB
```bash
cd android
.\gradlew bundleRelease
```

**Output:** `android/app/build/outputs/bundle/release/app-release.aab`

This AAB file is ready to upload to Google Play Console.

---

## Quick Reference: Build Progress Indicators

When builds work correctly, you should see:

```
> Configure project :
[ExpoRootProject] Using the following versions:
  - buildTools:  36.0.0
  - minSdk:      24
  - compileSdk:  35
  - targetSdk:   35
  - ndk:         27.1.12297006
  - kotlin:      2.1.20
  - ksp:         2.1.20-2.0.1
```

Successful build ends with:
```
BUILD SUCCESSFUL in Xm Ys
XXX actionable tasks: XX executed, XX up-to-date
```

---

## Common Error Solutions

### Error: "No variants exist"
**Cause:** React Native modules have no build variants configured  
**Solution:** Run `npx expo prebuild --clean` to regenerate native folders

### Error: "Keystore file not found"
**Cause:** Path to `.jks` file is incorrect in `keystore.properties`  
**Solution:** Use absolute path or place keystore in `android/app/` and use just the filename

### Error: "Gradle daemon stopped"
**Cause:** Out of memory or long-running daemon  
**Solution:** 
```bash
.\gradlew --stop
.\gradlew assembleRelease
```

### Error: Build stalls/hangs
**Cause:** Network issues downloading dependencies  
**Solution:**
```bash
.\gradlew assembleRelease --refresh-dependencies
```

---

## EAS Build Credits Exhausted?

If you run out of EAS free tier builds:
1. **Wait** until monthly reset (1st of month)
2. **Upgrade** to paid EAS plan
3. **Build locally** using this guide (free!)

Local builds give you:
- ✅ Unlimited builds
- ✅ Faster iteration
- ✅ Full control over configuration
- ❌ Need to manage SDK components yourself

---

## Environment Info

This guide was created for:
- **Project:** VoiceVault version 1.2.9
- **Expo SDK:** 54.0.23
- **React Native:** 0.81.5
- **Date:** November 2025
- **Build Tool:** Gradle 8.14.3

---

## Getting Help

If issues persist:
1. Check Android Studio build errors in detail
2. Verify SDK component versions match exactly
3. Clear Gradle cache: `.\gradlew clean`
4. Delete `node_modules` and `package-lock.json`, reinstall: `npm install`
5. Regenerate native folders: `npx expo prebuild --clean`

**Remember:** The keys to success are:
- Exact SDK versions (especially CMake 3.22.1)
- Sufficient memory allocation
- Proper keystore configuration
