# VoiceVault - Upcoming Features & Roadmap

This document outlines planned features and enhancements for the VoiceVault app.

---

## 🎤 1. Automatic Vocal Range Detection

### Overview
Allow users to discover their vocal range automatically by singing into their device's microphone. The app will detect the lowest and highest notes they can comfortably sing.

### User Experience
1. **Guided Process**: Users tap "Find My Range" button
2. **Warm-up Instructions**: Display warm-up tips and vocal exercises
3. **Low Note Test**: User sings progressively lower notes
4. **High Note Test**: User sings progressively higher notes
5. **Results**: Display detected range (e.g., "C3 - A5") with vocal type classification

### Technical Implementation

#### Phase 1: Audio Capture
- Use `expo-av` or `react-native-audio` for microphone access
- Request microphone permissions
- Real-time audio stream capture

#### Phase 2: Pitch Detection
- **Option A**: Use `pitchfinder` library (JavaScript)
  - Implements autocorrelation algorithm
  - Detects fundamental frequency (F0)
  
- **Option B**: Use Web Audio API
  - FFT (Fast Fourier Transform) analysis
  - Extract dominant frequency
  
- **Option C**: Use ML Kit or TensorFlow.js
  - Pre-trained pitch detection model
  - More accurate, handles harmonics better

#### Phase 3: Note Mapping
```javascript
// Convert frequency to note name
const frequencyToNote = (frequency) => {
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  const noteNumber = Math.round(12 * Math.log2(frequency / C0));
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(noteNumber / 12);
  const note = noteNames[noteNumber % 12];
  return `${note}${octave}`;
};
```

#### Phase 4: Range Storage
- Store detected range in `user_vocal_ranges` table
- Allow manual adjustment if needed
- Track range history over time (optional)

### UI Components Needed
- **RangeDetectionScreen.tsx**
  - Microphone visualization (waveform/bars)
  - Real-time pitch display
  - Progress indicators
  - "Start", "Stop", "Retry" buttons
  
- **Piano visualization** (reuse existing Piano component)
  - Highlight detected notes in real-time
  - Show range boundaries

### Challenges & Considerations
- **Accuracy**: Background noise, harmonics, voice quality
- **Calibration**: Different microphones, device variations
- **User Guidance**: Clear instructions for best results
- **Privacy**: All processing happens on-device, no audio uploaded
- **Edge Cases**: Very low/high notes outside typical range

### Success Criteria
- ✅ Detects notes within ±1 semitone accuracy
- ✅ Works on both iOS and Android
- ✅ Completes test in under 2 minutes
- ✅ Users can manually override detected range
- ✅ Graceful handling of noisy environments

### Libraries to Explore
- `expo-av` - Audio recording
- `pitchfinder` - Pitch detection algorithms
- `react-native-pitch-detector` - Native pitch detection
- `aubio` - Real-time audio labeling (may need native bridge)
- `tensorflow.js` with CREPE model - ML-based pitch detection

---

## 2. User Profile Pages & Upload History

### Overview
Allow users to view a contributor's profile by clicking on their username from any song they've uploaded. This creates a community-driven experience where users can discover more songs from contributors they trust.

### User Experience
1. **Clickable Username**: Tap username on any song card (where it shows "Uploaded by: [username]")
2. **Profile View**: Navigate to user's profile page
3. **Browse Uploads**: See all songs uploaded by that user
4. **Stats Display**: View contributor statistics
5. **Follow Option**: Optional - follow favorite contributors (future enhancement)

### Technical Implementation

#### Phase 1: Database Schema
```sql
-- Add user profiles table (if not exists)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  total_uploads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for user_profiles
CREATE POLICY "Users can view all profiles"
  ON user_profiles FOR SELECT TO public
  USING (true);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO public
  USING (auth.uid() = user_id);
```

#### Phase 2: SQL Function - Get User Upload Stats
```sql
CREATE OR REPLACE FUNCTION get_user_upload_stats(p_user_id UUID)
RETURNS TABLE (
  total_uploads BIGINT,
  total_approved BIGINT,
  total_pending BIGINT,
  most_uploaded_artist TEXT,
  join_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_uploads,
    COUNT(*) FILTER (WHERE status = 'approved')::BIGINT as total_approved,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as total_pending,
    (SELECT artist FROM songs WHERE user_id = p_user_id 
     GROUP BY artist ORDER BY COUNT(*) DESC LIMIT 1) as most_uploaded_artist,
    (SELECT created_at FROM user_vocal_ranges WHERE user_id = p_user_id LIMIT 1) as join_date
  FROM (
    SELECT status FROM songs WHERE user_id = p_user_id
    UNION ALL
    SELECT status FROM pending_songs WHERE user_id = p_user_id
  ) as all_songs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Phase 3: Frontend Components

**UserProfileScreen.tsx**
```typescript
interface UserProfile {
  user_id: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  total_uploads: number;
  created_at: string;
}

interface UserStats {
  total_uploads: number;
  total_approved: number;
  total_pending: number;
  most_uploaded_artist: string;
  join_date: string;
}

interface UploadedSong {
  id: number;
  name: string;
  artist: string;
  vocalRange: string;
  created_at: string;
  status: 'approved' | 'pending' | 'rejected';
}
```

**Screen Sections**:
1. **Header Section**
   - Avatar (default if none set)
   - Username & display name
   - Bio/description
   - Member since date

2. **Stats Section**
   - Total songs contributed
   - Approved songs count
   - Pending approval count
   - Most uploaded artist
   - Contribution streak (optional)

3. **Uploaded Songs List**
   - Filterable by status (All, Approved, Pending)
   - Searchable
   - Sortable (newest, oldest, alphabetical)
   - Same card design as main song list

4. **Actions**
   - "Follow" button (future)
   - "Share Profile" (future)
   - "Report User" (admin safety)

#### Phase 4: Navigation Updates

**Update SongDetailsScreen.tsx**:
```typescript
// Add TouchableOpacity to username
<TouchableOpacity onPress={() => handleUsernameClick(song.user_id, song.username)}>
  <Text style={styles.uploadedBy}>
    Uploaded by: {song.username}
  </Text>
</TouchableOpacity>

const handleUsernameClick = (userId: string, username: string) => {
  navigation.navigate('UserProfile', { userId, username });
};
```

**Update StackNavigator.tsx**:
```typescript
export type RootStackParamList = {
  // ... existing routes
  UserProfile: { 
    userId: string; 
    username: string;
  };
};

// Add screen
<Stack.Screen
  name="UserProfile"
  component={UserProfileScreen}
  options={{
    title: "User Profile",
    headerShown: true,
  }}
/>
```

#### Phase 5: API Integration

**Create util/userProfile.ts**:
```typescript
export const fetchUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

export const fetchUserUploadedSongs = async (userId: string) => {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const fetchUserStats = async (userId: string) => {
  const { data, error } = await supabase
    .rpc('get_user_upload_stats', { p_user_id: userId });
  
  if (error) throw error;
  return data;
};
```

### UI/UX Features

#### Profile Customization (Future)
- Upload avatar/profile picture
- Edit bio (150 character limit)
- Set display name (different from username)
- Privacy settings (hide pending songs, etc.)

#### Stats Visualization
- Bar chart of uploads by month
- Pie chart of genres uploaded
- Contribution timeline
- Top 5 most popular songs uploaded

#### Badges & Achievements
- "Pioneer" - First 100 users
- "Contributor" - 10+ approved songs
- "Curator" - 50+ approved songs
- "Legend" - 100+ approved songs
- "Genre Expert" - 20+ songs in one genre
- "Accuracy Master" - 95%+ approval rate

### Security & Privacy

**RLS Policies**:
- Anyone can view public profile data
- Users can only edit their own profile
- Admins can view all data including pending/rejected songs
- Regular users only see approved songs on others' profiles

**Privacy Options** (Future):
- Make profile private (only show approved songs)
- Hide statistics
- Anonymous uploads (don't show username)
- Block specific users from viewing profile

### Moderation Features

**Admin Tools**:
- View all user uploads (including rejected)
- Ban user from uploading
- Hide user profile
- Bulk approve/reject user's pending songs
- View user report history

**User Safety**:
- Report inappropriate profiles
- Block users
- Hide content from specific uploaders

### Database Indexes
```sql
-- Improve query performance
CREATE INDEX idx_songs_user_id ON songs(user_id);
CREATE INDEX idx_pending_songs_user_id ON pending_songs(user_id);
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
```

### Migration File
```sql
-- supabase/migrations/20260115_add_user_profiles.sql
-- Create user_profiles table
-- Add RLS policies
-- Create get_user_upload_stats function
-- Add indexes
```

### Success Criteria
- ✅ Clicking username navigates to profile
- ✅ Profile loads in under 2 seconds
- ✅ Shows accurate upload count
- ✅ Displays all approved songs
- ✅ Admins can see all uploads
- ✅ Mobile-responsive design
- ✅ Works offline with cached data

### Challenges & Considerations
- **Username Changes**: Handle username updates gracefully
- **Deleted Users**: Show "User Deleted" for removed accounts
- **Performance**: Paginate song lists for users with 100+ uploads
- **Consistency**: Sync username across songs, pending_songs, profiles
- **Privacy**: Balance transparency with user privacy
- **Spam Prevention**: Detect and limit spam uploaders

### Future Enhancements
- Follow/unfollow system
- Leaderboards (most uploads, highest approval rate)
- User rankings (Gold/Silver/Bronze contributors)
- Direct messaging between users
- Collaboration features (co-upload songs)
- Profile verification badges
- Integration with social media profiles

---

## 📋 3. Other Planned Features

### 🎵 Advanced Song Filtering
- Filter songs by vocal range compatibility
- "Songs I Can Sing" personalized list
- Difficulty rating based on range requirements
- Genre and artist filtering

### 📊 Vocal Progress Tracking
- Track range improvements over time
- Weekly/monthly vocal stats
- Achievement badges (e.g., "Extended Range", "High Note Master")
- Practice session logging

### 🎼 Custom Practice Exercises
- Warm-up routines based on user's range
- Scale practice with metronome integration
- Breath control exercises
- Interval training

### 👥 Social Features
- Share vocal range with friends
- Compare ranges with other users (anonymous)
- Vocal range leaderboards
- Song recommendations from similar voices

### 🎙️ Recording & Playback
- Record practice sessions
- Playback with pitch visualization
- Compare recordings over time
- Share recordings (optional)

### 🔔 Smart Notifications
- Daily practice reminders
- New songs in your range notifications
- Weekly progress reports
- Warm-up routine suggestions

### 🌐 Offline Mode
- Cache favorite songs for offline access
- Offline practice mode
- Sync data when back online

### 🎨 Customization
- Custom vocal range labels (e.g., "My Comfort Zone", "Challenge Range")
- Personalized practice goals
- Custom song collections
- Theme customization (already implemented)

### 🔊 Audio Feedback
- Real-time pitch correction guidance
- "On pitch" / "Too high" / "Too low" indicators
- Visual pitch matching game

### 📱 Widget Support
- Home screen widget showing daily practice stats
- Quick access to vocal range display
- Song of the day widget

---

## 🚀 Priority Ranking

### High Priority (Next 3 Months)
1. ✅ **Content Moderation** (COMPLETED)
2. 👤 **User Profile Pages** (IN PLANNING)
3. 🎤 **Automatic Vocal Range Detection** (IN PLANNING)
4. 📊 **Vocal Progress Tracking**

### Medium Priority (3-6 Months)
5. 🎵 **Advanced Song Filtering**
6. 🎼 **Custom Practice Exercises**
7. 🎙️ **Recording & Playback**
8. 🎹 **Real-time Guitar/Vocal Tuner** (Post 1.3.6)
9. 👥 **Social Features** (follows, messaging)
10. 🔔 **Smart Notifications**
11. 🌐 **Offline Mode**
12. 🎨 **Advanced Customization**

---

## 💡 Feature Requests from Users

Track user-requested features here:
- [ ] Export vocal range data
- [ ] Integration with Spotify/Apple Music
- [ ] Vocal coach recommendations
- [ ] Group practice sessions
- [ ] Video tutorials for vocal techniques

---

## 📝 Technical Debt & Improvements

- Migrate to Supabase v2 authentication API
- Add comprehensive error logging
- Improve offline data caching
- Optimize database queries
- Add E2E testing for critical flows
- Implement CI/CD pipeline
- Performance monitoring with Sentry/Firebase

---

## 🔬 Research & Exploration

### Vocal Range Detection Deep Dive
- **Research Papers**:
  - "CREPE: A Convolutional Representation for Pitch Estimation" (Kim et al., 2018)
  - "PYIN: A Fundamental Frequency Estimator" (Mauch & Dixon, 2014)
  
- **Open Source Projects**:
  - Mozilla's pitch detection in Web Audio API
  - Sonic Visualiser's pitch tracking
  - Praat (phonetics software) algorithms

- **Commercial Inspiration**:
  - Yousician's pitch detection
  - Smule's vocal analysis
  - SingSharp's real-time feedback

---

## 📅 Release Timeline

### Version 1.3.7 (January 2026) - CURRENT
- 🎤 **Vocal Range Auto-Detection** (Batch processing mode)
- Record and analyze lowest/highest notes
- Integration with existing user vocal range system

### Version 1.4.0 (Q1 2026)
- 👤 **User Profile Pages**
- Upload history viewing
- Contributor statistics
- Clickable usernames

### Version 1.5.0 (Q2 2026)
- 🎹 **Real-time Instrument/Vocal Tuner**
- Live pitch display (<100ms latency)
- Visual tuner interface
- Multi-instrument support

### Version 1.6.0 (Q3 2026)
- Advanced filtering
- Custom exercises
- Recording & playback

### Version 2.0.0 (Q4 2026)
- Social features
- AI-powered recommendations
- Premium features

---

## 🤝 Contributing Ideas

Have a feature idea? Submit it by:
1. Creating an issue in the repository
2. Emailing suggestions to [your-email]
3. Using the in-app feedback form

---

**Last Updated**: December 26, 2025  
**Next Review**: January 15, 2026
