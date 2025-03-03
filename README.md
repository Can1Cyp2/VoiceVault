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
