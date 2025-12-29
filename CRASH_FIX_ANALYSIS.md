# VoiceVault Crash Fix - Detailed Analysis

## The Crash

**Issue:** App crashes immediately after granting microphone permission when trying to record vocal range (admin feature).

**Symptoms:**
- ✅ Demo Mode works perfectly
- ❌ Real microphone access → instant crash
- 💥 Error: `EXC_CRASH (SIGABRT)` on Thread 5
- 📱 Only affects production builds (TestFlight), not Expo Go

## Root Cause Analysis

### The Problem: Incorrect API Usage

The `react-native-pitch-detector` library exports **static methods** on a namespace, not instance methods on a class.

#### What the Code Was Doing (WRONG ❌)
```typescript
// Type definition assumed it was a class
export default class PitchDetector {
  start(options: PitchDetectorOptions): void;
  stop(): void;
}

// Previous commit tried to "fix" by using static methods,
// but the promise handling was still incorrect
```

#### What It Should Be (CORRECT ✅)
```typescript
// It's actually a namespace with static async methods
export namespace PitchDetector {
  function start(): Promise<void>;
  function stop(): Promise<void>;
  function addListener(callback: (result: PitchDetectorResult) => void): PitchDetectorSubscription;
  function removeListener(): void;
}
```

### The Flow of Failure

1. **User taps "Allow" on microphone permission**
2. **`startRecording('low')` is called**
3. **`startPitchDetection()` function executes:**
   - Sets up event listener ✅
   - Calls `PitchDetector.start()` 
   - **BUT**: Doesn't properly await or handle the async start
4. **Native module throws exception during initialization**
5. **React Native's exception handler catches it**
6. **`RCTExceptionsManager.reportFatal` is called**
7. **iOS receives `SIGABRT` and terminates the app** 💥

### Why Demo Mode Worked

Demo mode (`useMockData = true`) bypasses the native module entirely:
- Uses `startMockPitchDetection()` which is pure JavaScript
- Generates fake pitch data with `setInterval()`
- No microphone hardware, no native code, no crash

## The Fix Applied

### 1. Fixed Type Definitions
**File:** `types/react-native-pitch-detector.d.ts`

```typescript
// OLD (incorrect)
export default class PitchDetector {
  start(options: PitchDetectorOptions): void;
  stop(): void;
}

// NEW (correct)
export namespace PitchDetector {
  function start(): Promise<void>;
  function stop(): Promise<void>;
  function isRecording(): Promise<boolean>;
  function addListener(callback: (result: PitchDetectorResult) => void): PitchDetectorSubscription;
  function removeListener(): void;
}
```

### 2. Fixed Implementation
**File:** `app/util/pitchDetection.ts`

**Key Changes:**
1. ✅ Proper async/await handling of `start()` promise
2. ✅ Add listener BEFORE starting detection
3. ✅ Better error handling with try/catch
4. ✅ Cleanup subscription on error
5. ✅ More descriptive error messages

```typescript
// Add listener FIRST
const subscription = PitchDetector.addListener((result) => {
  // Handle pitch data
});

// Then start detection with proper error handling
(async () => {
  try {
    await PitchDetector.start();
    console.log('✅ Pitch detection started successfully');
  } catch (startError: any) {
    console.error('❌ Failed to start pitch detector:', startError);
    isRunning = false;
    if (subscription) {
      PitchDetector.removeListener();
    }
    onError(new Error('Failed to start microphone: ' + (startError?.message || startError)));
  }
})();
```

### 3. Added Missing Configuration
**File:** `package.json`

Added required iOS permissions configuration for `react-native-pitch-detector`:

```json
"reactNativePermissionsIOS": [
  "Microphone"
]
```

This ensures the native module properly requests microphone permissions on iOS.

## Verification Steps

### Before Testing the Fix:

1. **Update version number** in `app.config.js`:
   ```javascript
   version: "1.3.7",
   buildNumber: "1.0.82",
   ```

2. **Commit the changes**:
   ```bash
   git add -A
   git commit -m "fix: Properly handle PitchDetector async API and error handling"
   git push
   ```

3. **Build new TestFlight version**:
   ```bash
   eas build --platform ios --profile production
   ```

### Testing Checklist:

#### Demo Mode (should still work):
- [ ] Open Profile screen
- [ ] Tap "Set My Vocal Range"
- [ ] Enable "Demo Mode" toggle
- [ ] Tap "Start Recording" for low note
- [ ] Should see mock notes appearing (E2)
- [ ] Should complete successfully

#### Real Microphone Mode (the fix):
- [ ] Open Profile screen
- [ ] Tap "Set My Vocal Range"
- [ ] **Keep "Demo Mode" OFF**
- [ ] Tap "Start Recording" for low note
- [ ] Tap "Allow" on microphone permission
- [ ] **App should NOT crash** ✅
- [ ] Should see real pitch detection working
- [ ] Sing a low note and verify detection
- [ ] Complete full flow (low + high notes)
- [ ] Save vocal range successfully

## Technical Details from Crash Log

### Stack Trace Analysis

**Thread 5 Crashed** (RCTNativeModule invocation):
```
Last Exception Backtrace:
0   CoreFoundation      __exceptionPreprocess
1   libobjc.A.dylib     objc_exception_throw
2   VoiceVault          RCTFatal
3   VoiceVault          -[RCTExceptionsManager reportFatal:stack:exceptionId:extraDataAsJSON:]
4   VoiceVault          -[RCTExceptionsManager reportException:]
...
9   VoiceVault          facebook::react::invokeInner(...)
10  VoiceVault          facebook::react::RCTNativeModule::invoke(...)
```

**Main Thread** (UIKit layout during alert presentation):
- Was in the middle of presenting the microphone permission alert
- UIKit was performing auto-layout calculations
- This is normal - the crash happened on a background thread

### Why Previous Fix Didn't Work

The previous commit message said: "fix: Correct PitchDetector API usage - use static methods instead of constructor"

**What it fixed:** ✅ Stopped trying to use `new PitchDetector()`  
**What it missed:** ❌ Didn't properly handle the async nature of `start()`  
**Result:** Still crashed because promise rejection wasn't caught

## Expected Behavior After Fix

### Success Flow:
1. User taps "Allow" on permission ✅
2. `PitchDetector.start()` promise resolves ✅
3. Console logs: "✅ Pitch detection started successfully" ✅
4. Listener receives pitch data ✅
5. UI updates with detected notes ✅
6. Recording completes after 5 seconds ✅
7. Analysis shows detected note ✅

### Error Flow (if permission denied):
1. User taps "Don't Allow" ❌
2. `requestMicrophonePermission()` returns `false` ❌
3. Alert shown: "Microphone Permission Required" ✅
4. No crash, graceful fallback ✅

### Error Flow (if start fails):
1. User grants permission ✅
2. Native module fails to initialize ❌
3. `catch` block catches error ✅
4. `onError` callback fires ✅
5. Alert shown: "Microphone access failed: [error]" ✅
6. No crash, graceful error handling ✅

## Prevention Measures

### Code Review Checklist:
- ✅ Always check library documentation for correct API usage
- ✅ Never assume class vs namespace vs object
- ✅ Always handle Promise rejections
- ✅ Test in production build, not just Expo Go
- ✅ Add proper TypeScript types that match actual API

### Future Improvements:
1. Add unit tests for `pitchDetection.ts`
2. Add integration tests for microphone flow
3. Mock native modules in Jest tests
4. Add Sentry/crash reporting for production
5. Consider adding `__DEV__` mode detection logging

## Related Files

### Modified Files:
- ✅ `types/react-native-pitch-detector.d.ts` - Fixed type definitions
- ✅ `app/util/pitchDetection.ts` - Fixed implementation

### Affected Components:
- `app/screens/TunerScreen/VocalRangeDetectorModal.tsx` - Uses `startPitchDetection()`
- `app/screens/ProfileScreen/ProfileScreen.tsx` - Opens the modal

### Configuration Files:
- `package.json` - Contains `react-native-pitch-detector` dependency
- `app.config.js` - Contains microphone permission declaration
- `android/app/src/main/AndroidManifest.xml` - Android permissions
- `ios/VoiceVault/Info.plist` - iOS permissions

## Resources

- [react-native-pitch-detector Documentation](https://1fabiopereira.github.io/react-native-pitch-detector/)
- [API Usage Guide](https://1fabiopereira.github.io/react-native-pitch-detector/docs/usage)
- [GitHub Repo](https://github.com/1fabiopereira/react-native-pitch-detector)

## Deployment Checklist

- [ ] Code changes committed to `1.3.7` branch
- [ ] Version bumped to 1.3.7 (build 1.0.82)
- [ ] EAS build triggered for iOS
- [ ] Build uploaded to TestFlight
- [ ] Internal testing completed
- [ ] Crash-free sessions verified
- [ ] External testing (beta testers)
- [ ] Submit to App Store if all clear

---

**Fix Author:** GitHub Copilot  
**Date:** December 28, 2025  
**Version:** 1.3.7 (build 1.0.82)
