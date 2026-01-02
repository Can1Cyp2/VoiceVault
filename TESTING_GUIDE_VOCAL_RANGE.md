# Testing Guide for Vocal Range Detection Feature

## ✅ Pre-Build Testing (Do This First!)

### 1. Install Dependencies
```bash
npm install
```

### 2. Test UI Flow with Mock Data
The feature includes mock pitch detection so you can test the UI before building:

```bash
# Start Expo
npm start

# Or run on specific platform
npm run android
npm run ios
```

### 3. Manual UI Testing Checklist
- [ ] Open app and go to Tuner tab
- [ ] Tap "🎤 Find My Vocal Range" button
- [ ] Modal opens with intro screen
- [ ] Tap "Start" button
- [ ] Step 1 screen appears
- [ ] Tap "🎤 Start Recording"
- [ ] See live pitch display (mock data will cycle through notes)
- [ ] Progress bar animates for 5 seconds
- [ ] Auto-stops and shows "Analyzing..." screen
- [ ] Shows detected note (random from mock data)
- [ ] Tap "Next →"
- [ ] Step 2 screen appears for high note
- [ ] Repeat recording process
- [ ] Shows results screen with range
- [ ] Shows vocal classification (Bass, Tenor, etc.)
- [ ] Tap "💾 Save to Profile"
- [ ] Success alert appears
- [ ] Check Profile screen - range should be saved

## 🔨 Build for Native Testing

### 4. Prebuild (Generate Native Code)
```bash
npx expo prebuild --clean
```

### 5. Build with EAS

#### Development Build (for testing):
```bash
# Android
eas build --profile development --platform android

# iOS  
eas build --profile development --platform ios
```

#### After Build Completes:
1. Download and install the build on your device
2. Run `npm start` to start the Metro bundler
3. Scan QR code from dev build app

## 🧪 Post-Build Testing

### Real Microphone Testing Checklist

#### Test 1: Normal Flow
- [ ] Open Tuner tab
- [ ] Tap "🎤 Find My Vocal Range"
- [ ] Grant microphone permission when prompted
- [ ] Sing low note (e.g., speak/hum in low voice)
- [ ] Verify live pitch display shows your actual note
- [ ] Complete recording
- [ ] Verify detected note makes sense
- [ ] Sing high note
- [ ] Verify high note detected correctly
- [ ] Save range
- [ ] Check saved in profile

#### Test 2: Edge Cases
- [ ] Try canceling mid-recording
- [ ] Try "Retry" button
- [ ] Try "Start Over" from results
- [ ] Deny microphone permission - verify error message
- [ ] Test in noisy environment - verify "Detection Failed" message
- [ ] Test very low note (below E2)
- [ ] Test very high note (above C6)

#### Test 3: Error Handling
- [ ] Turn off wifi/data before saving - verify error
- [ ] Try to save invalid range (manually trigger if possible)
- [ ] Logout and try to use feature - verify login prompt

## 🐛 Known Issues to Watch For

### If Pitch Detection Doesn't Work:
1. **Check Permissions**
   - iOS: Settings > VoiceVault > Microphone = ON
   - Android: Settings > Apps > VoiceVault > Permissions > Microphone = Allowed

2. **Check Build**
   - Ensure you built with `eas build` (not Expo Go)
   - Verify `react-native-pitch-detector` is in dependencies

3. **Check Console Logs**
   - Look for "Native pitch detector not available" (means using mock)
   - Look for microphone permission errors

### If Accuracy is Poor:
- Find quieter environment
- Speak/sing louder and more steadily
- Hold note for full 5 seconds
- Try adjusting confidence threshold in code (currently 0.85)

## 📊 Expected Results

### Typical Vocal Ranges:
- **Bass**: E2 - E4
- **Baritone**: A2 - A4
- **Tenor**: C3 - C5
- **Alto**: F3 - F5
- **Soprano**: C4 - C6

### Detection Accuracy:
- ✅ Should be within ±1 semitone
- ✅ Should show consistent note when holding steady pitch
- ⚠️ May fluctuate in noisy environments
- ⚠️ Extreme notes (very low/high) may be harder to detect

## 🔍 Debugging Commands

### View Logs
```bash
# Android
npx react-native log-android

# iOS
npx react-native log-ios
```

### Check Native Module
```javascript
// Add to pitchDetection.ts temporarily
console.log('Native module available:', require('react-native-pitch-detector'));
```

## ✨ Success Criteria

Before considering feature complete:
- [x] UI flows smoothly through all steps
- [x] Microphone permission requested properly
- [x] Live pitch display updates in real-time
- [x] Detected notes are accurate (±1 semitone)
- [x] Range saves to Supabase correctly
- [x] Range appears in Profile screen
- [x] Works on both iOS and Android
- [x] Error handling for all edge cases
- [x] No crashes or freezes

## 📝 Next Steps After Testing

If everything works:
1. Update version to 1.3.6 in package.json and app.config.js
2. Merge to main branch
3. Build production version with `eas build --profile production`
4. Submit to app stores

If issues found:
1. Document specific issue
2. Check implementation plan
3. Fix and test again
4. Do NOT waste builds - test thoroughly with mock first!

---

**Last Updated**: December 26, 2025  
**Feature**: Vocal Range Auto-Detection  
**Version**: 1.3.6
