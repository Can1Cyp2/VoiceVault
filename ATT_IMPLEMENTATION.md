# App Tracking Transparency (ATT) Implementation Guide

## Overview
VoiceVault properly implements App Tracking Transparency (ATT) as required by Apple for iPadOS 26.0.1 and all iOS versions.

## Implementation Location

### 1. ATT Permission Request (App.tsx)
**File:** `App.tsx` (lines 19-31)
```typescript
const requestATTPermission = async () => {
  if (Platform.OS !== 'ios') return;
  
  try {
    const TrackingTransparency = await import('expo-tracking-transparency');
    const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
    console.log('🔒 ATT Permission Status:', status);
    return status === 'granted';
  } catch (error) {
    console.error('ATT request error:', error);
    return false;
  }
};
```

**When it's called:** In `App.tsx` `useEffect` (lines 52-63), **before any other initialization**, including AdMob SDK initialization.

### 2. Info.plist Configuration
**File:** `app.config.js` (line 27)
```javascript
NSUserTrackingUsageDescription: "If you choose to watch ads: Your data may be used to deliver more relevant ads and measure ad performance by Google (Admob), VoiceVault does not save this data."
```

This string appears in the ATT system dialog.

## How to Verify ATT Prompt on iPadOS 26.0.1

### Prerequisites
1. **Device Settings:**
   - Go to: Settings > Privacy & Security > Tracking
   - Ensure "Allow Apps to Request to Track" is **ON**
   - If this is OFF, no app can show ATT dialogs

2. **Fresh Install:**
   - Uninstall VoiceVault if previously installed
   - This ensures the ATT prompt will appear again
   - ATT dialogs only show once per app install

### Steps to Reproduce
1. Install VoiceVault build (TestFlight or dev build)
2. Launch the app
3. **ATT dialog should appear immediately on first launch**
4. Dialog will show:
   - App icon and name
   - The message: "If you choose to watch ads: Your data may be used to deliver more relevant ads and measure ad performance by Google (Admob), VoiceVault does not save this data."
   - Two buttons: "Ask App Not to Track" and "Allow"

### Expected Console Logs
When the app launches, you should see these logs in Xcode Console or macOS Console app:
```
🔒 Requesting ATT permission before any initialization...
🔒 ATT Permission Status: granted (or denied/restricted)
✅ ATT request completed
```

## Why ATT Prompt May Not Appear

### Common Issues
1. **Global Setting Disabled**
   - Settings > Privacy & Security > Tracking > "Allow Apps to Request to Track" is OFF
   - Solution: Turn this setting ON

2. **Already Responded**
   - User previously allowed or denied tracking for this app
   - Solution: Uninstall and reinstall the app

3. **Simulator vs Device**
   - Simulators may not show ATT prompts reliably
   - Solution: Test on a real iPad running iPadOS 26.0.1

4. **App Already Running**
   - ATT prompt only appears on fresh app launch
   - Solution: Force quit and relaunch, or reinstall

## Timing and Sequence

### Critical Implementation Details
- ATT request happens **at app startup** (App.tsx useEffect)
- ATT request occurs **before AdMob SDK initialization**
- ATT request occurs **before any data collection**
- This ensures compliance with Apple's requirement: "The request should appear before any data is collected that could be used to track the user."

### Code Flow
```
App Launch
  ↓
App.tsx useEffect runs
  ↓
requestATTPermission() called (iOS only)
  ↓
System ATT dialog appears
  ↓
User responds (Allow/Don't Allow)
  ↓
AdMob SDK initializes (AdService.initialize())
  ↓
App continues normal operation
```

## Privacy & Tracking Declaration

VoiceVault uses Google AdMob for advertising, which may:
- Collect device identifiers (IDFA when tracking allowed)
- Use data for ad personalization (when tracking allowed)
- Share data with ad networks (as part of AdMob functionality)

**When tracking is denied:**
- App requests non-personalized ads only
- IDFA is not accessible
- Ad personalization is disabled

This is implemented in `AdService.ts` `currentRequestOptions()` method (lines 268-287).

## Testing Checklist for Reviewers

- [ ] Fresh install on real iPadOS 26.0.1 device (not simulator)
- [ ] Settings > Privacy & Security > Tracking > "Allow Apps to Request to Track" = ON
- [ ] Launch app (force quit first if needed)
- [ ] ATT system dialog appears immediately
- [ ] Console logs show: "🔒 ATT Permission Status: ..."
- [ ] Choosing "Allow" or "Don't Allow" both work correctly
- [ ] App continues to function after ATT response

## Support Contact
For questions about this implementation, contact:
- Developer: Can1Cyp2
- Email: can1cyp2apps@gmail.com
- Website: https://SebastianLandry.ca

---

## Technical Details for Apple Review Team

**Package:** `expo-tracking-transparency` v6.0.7
**iOS Deployment Target:** iOS 14.5+
**Tested on:** iPadOS 26.0.1
**Framework:** React Native / Expo SDK 54

**Files Modified:**
- `App.tsx` - ATT request at app startup
- `app.config.js` - NSUserTrackingUsageDescription
- `AdService.ts` - AdMob initialization after ATT
