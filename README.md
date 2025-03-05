# VoiceVault 🎵

**VoiceVault** helps vocalists, music students, and karaoke lovers explore vocal ranges of artists and songs, compare them to their own range, and curate personalized song lists. Built with React Native, Expo, and TypeScript, it uses Supabase for authentication and data storage, delivering a fast, secure, and beautiful mobile experience.

---

## 🚀 Features

### 1. Search & Discovery
- **Dynamic Search**: Search for songs and artists with real-time filtering.
- **Vocal Range Data**: View the lowest and highest notes an artist has sung, fetched from a Supabase database.
- **Range-Based Categorization**: Easily find songs and artists that match your vocal range.

### 2. Vocal Range Comparison
- **Personalized Range**: Logged-in users can set their vocal range (lowest and highest notes).
- **Real-Time Comparison**: Automatically compare your range to an artist’s or song’s range.
- **Color-Coded Indicator**:
  - 🟢 **Green**: Comfortably within your range.
  - 🟡 **Yellow**: Slightly outside but singable (within 3 semitones).
  - 🔴 **Red**: Significantly out of range.
- **Detailed Tooltip**: Tap the indicator to see note differences (e.g., "+4 notes higher than your range").

### 3. Song & Artist Details
- **Artist Profiles**: View an artist’s overall vocal range and a list of their songs with individual ranges.
- **Song Details**: Tap a song to see its vocal requirements on a dedicated page.
- **In-Depth Analysis**: Understand the vocal demands of each song or artist.

### 4. Saved Lists & Personalization
- **Custom Playlists**: Save songs to personalized lists for practice or performance.
- **Recommendations**: Discover new songs tailored to your vocal range.
- **User-Centric Design**: Keep track of your favorite songs with ease.

### 5. Authentication & State Management
- **Secure Login/Signup**: Powered by Supabase for a fast and secure experience.
- **Persistent Data**: Save your vocal range in the database for use across the app.
- **Smart Navigation**: Automatically refreshes on login, removes unnecessary UI elements (e.g., misplaced "list" button in artist details).

---

## 🛠️ Technology Stack

- **Frontend**: React Native, TypeScript, Expo
- **State Management**: React hooks (`useState`, `useEffect`, `useIsFocused`)
- **Backend**: Supabase (PostgreSQL database, authentication, real-time updates)
- **Navigation**: React Navigation (Native Stack Navigator)
- **Styling**: React Native Stylesheets with a modern, minimalist UI
- **Color Scheme**: Dark gray/black backgrounds, vibrant orange accents (`#ff5722`), clean white text

---

## 📖 How It Works

1. **Login or Guest Mode**: Log in to unlock personalized features, or continue as a guest with limited access.
2. **Search Songs/Artists**: Use the search bar to find songs or artists.
3. **View Vocal Ranges**: See the lowest and highest notes for each song or artist.
4. **Compare Ranges**: If logged in, your range is compared to the artist’s or song’s range with a color-coded indicator.
5. **Save to Lists**: Add songs to custom playlists for practice or performance.
6. **Explore Details**: Tap on a song or artist for in-depth vocal insights.

---

## ✨ Why It’s Unique

- **Tailored for Singers**: Find songs that suit your voice, avoiding vocal strain.
- **Real-Time Range Comparison**: Instantly see if a song or artist matches your range.
- **Beautiful UI**: Mobile-friendly with an intuitive dark theme and orange accents.
- **Supabase-Powered**: Fast, secure backend with real-time updates.
- **Future-Ready**: Plans for song difficulty ratings, recording integration, and AI vocal coaching.

VoiceVault is the perfect tool for vocalists, music students, and karaoke enthusiasts to discover music and understand their vocal abilities! 🚀

---

## 🖥️ Installation and Setup

### Prerequisites
- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher
- **Expo CLI**: Install globally with `npm install -g expo-cli`
- **Expo Go App**: For testing on physical devices (available on iOS and Android)

### Steps to Run Locally
1. **Clone the Repository**:
   ===bash
   git clone https://github.com/your-username/voicevault.git
   cd voicevault
   ===

2. **Install Dependencies**:
   ===bash
   npm install
   ===

3. **Set Up Supabase**:
   - Create a Supabase project at [supabase.com](https://supabase.com).
   - Note your Supabase URL and Anon Key from the project settings.
   - Create the necessary tables (e.g., `songs`, `user_vocal_ranges`, `issues`) in your Supabase database. Refer to the schema in `app/util/supabase.ts`.
   - Update the Supabase configuration in `app/util/supabase.ts` with your URL and Anon Key:
     ===typescript
     const SUPABASE_URL = "https://your-supabase-url.supabase.co";
     const SUPABASE_ANON_KEY = "your-anon-key";
     ===

4. **Run the App**:
   - Start the Expo development server:
     ===bash
     npx expo start
     ===
   - Scan the QR code with the Expo Go app on your device, or run in an emulator/simulator.

5. **Build for Production**:
   - To build for Android or iOS and submit to app stores, use EAS:
     ===bash
     eas build --platform android
     ===
   - Follow the EAS CLI prompts to configure and build your app.

---

## 🐞 Known Issues

### Network Connectivity on Android (Play Store)
- **Issue**: On some Android devices (e.g., Samsung Galaxy S22, Google Pixel 4), the app fails to connect to the Supabase backend when installed via the Play Store, resulting in a "TypeError: Network request failed" error. No requests are logged in Supabase, indicating the issue occurs before the request leaves the device.
- **Devices Affected**:
  - Samsung Galaxy S22 (inconsistent—some devices work, others don’t)
  - Google Pixel 4
  - LG G4 (likely due to Android 6.0, API 23, being below the minimum SDK of 24)
- **Workaround**: The app works correctly when installed via APK, suggesting a Play Store delivery or device-specific issue.
- **Steps Taken**:
  - Added network diagnostics (e.g., `checkInternetConnection`, raw `fetch` tests to Supabase and Google) to confirm the issue.
  - Attempted to apply a network security configuration to allow requests to `ydxbhxstbspjpncpsmrz.supabase.co`, but encountered a `PluginError` with the custom plugin.
  - Manually applied the network security config by prebuilding the Expo project and modifying `AndroidManifest.xml`.
- **Next Steps**:
  - Test the new build with the network security config on affected devices.
  - If the issue persists, explore using a `fetch` polyfill (e.g., `whatwg-fetch`) or investigate Play Store app signing issues.

---

## 🤝 Contributing

Contributions are welcome! If you can help resolve the network connectivity issue on Android or have ideas for new features, please contribute.

### How to Contribute
1. Fork the repository.
2. Create a new branch:
   ===bash
   git checkout -b feature/your-feature-name
   ===
3. Make your changes and commit:
   ===bash
   git commit -m "Add your feature or fix"
   ===
4. Push to your fork:
   ===bash
   git push origin feature/your-feature-name
   ===
5. Open a pull request with a detailed description of your changes.

### Areas for Contribution
- **Network Issue Resolution**: Help debug and fix the "TypeError: Network request failed" issue on Android devices when installed via the Play Store.
- **Feature Enhancements**: Contribute to planned features like song difficulty ratings, recording integration, or AI vocal coaching.
- **Bug Fixes**: Address any other bugs or improve performance.

---

## 🔮 Future Enhancements

- **Song Difficulty Ratings**: Add difficulty levels (e.g., beginner, intermediate, advanced) based on vocal range, technique, and style.
- **Recording Integration**: Allow users to record their singing sessions and compare them to the song’s vocal range.
- **AI Vocal Coaching**: Integrate AI to provide real-time feedback on pitch, tone, and technique during practice.
- **Improved Network Reliability**: Resolve the Android network connectivity issue by:
  - Implementing a `fetch` polyfill if the issue is with React Native’s `fetch` implementation.
  - Exploring Play Store app signing configurations to ensure network requests work consistently.
- **Expanded Database**: Add more songs, artists, and vocal range data to the Supabase database.
- **Offline Mode**: Cache song and artist data for offline access.

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---
