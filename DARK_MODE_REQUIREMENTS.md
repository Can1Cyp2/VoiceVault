# Dark Mode Implementation Requirements for VoiceVault

## Executive Summary
To implement dark mode in VoiceVault, you need to:
1. Create a theme context system
2. Update theme.ts with light and dark color schemes
3. Refactor 200+ hardcoded color values across ~40 files
4. Update app.config.js for system-level colors
5. Add a toggle UI in ProfileScreen
6. Persist user preference

**Estimated Effort:** 10-15 hours

---

## 1. Infrastructure Setup (2-3 hours)

### 1.1 Create Theme Context
**File:** `app/contexts/ThemeContext.tsx` (NEW)

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: typeof LightColors;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
```

**Purpose:** Centralized theme management accessible to all components

---

### 1.2 Expand theme.ts
**File:** `app/styles/theme.ts`

**Current state:** Basic color constants
**Needed changes:** Add complete light/dark color schemes

```typescript
export const LightColors = {
  // Backgrounds
  background: '#f9f9f9',
  backgroundSecondary: '#ffffff',
  backgroundTertiary: '#F5F5F5',
  backgroundCard: '#FFFFFF',
  
  // Text
  textPrimary: '#333',
  textSecondary: '#666',
  textTertiary: '#888',
  textInverse: '#fff',
  
  // Borders
  border: '#ddd',
  borderLight: '#e0e0e0',
  
  // Brand colors (consistent across themes)
  primary: 'tomato',          // #ff6347
  primaryDark: '#ff6600',
  secondary: '#1e90ff',
  success: '#4CAF50',
  warning: '#FF9800',
  danger: '#ff4444',
  
  // UI elements
  shadow: '#000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  disabled: '#d9d9d9',
  
  // Special colors
  accent: '#e91e63',
  link: '#007bff',
  highlight: '#fff5f5',
};

export const DarkColors = {
  // Backgrounds
  background: '#121212',
  backgroundSecondary: '#1e1e1e',
  backgroundTertiary: '#2a2a2a',
  backgroundCard: '#1e1e1e',
  
  // Text
  textPrimary: '#e0e0e0',
  textSecondary: '#b0b0b0',
  textTertiary: '#808080',
  textInverse: '#121212',
  
  // Borders
  border: '#404040',
  borderLight: '#333333',
  
  // Brand colors (slightly adjusted for dark mode)
  primary: '#ff6b52',
  primaryDark: '#ff7733',
  secondary: '#4da6ff',
  success: '#66bb6a',
  warning: '#ffa726',
  danger: '#ff5555',
  
  // UI elements
  shadow: '#000',
  overlay: 'rgba(0, 0, 0, 0.7)',
  disabled: '#444444',
  
  // Special colors
  accent: '#ff4081',
  link: '#42a5f5',
  highlight: '#332222',
};
```

---

## 2. Files Requiring Color Updates (8-10 hours)

### High Priority Files (Heavy Color Usage)

#### 2.1 App.tsx
**Color instances:** 15+
**Hardcoded colors found:**
- `#cc6600`, `#ff6600`, `#ff9933` (tab colors)
- `#fff5f5`, `#555`, `#777` (tab backgrounds)
- `rgba(255, 255, 255, 0.6)` (borders)
- `tomato`, `darkgray`, `gray`, `white`

**Changes needed:**
- Tab bar background colors (3 variations)
- Tab icon colors
- Disabled tab styling
- Border colors for tab buttons

---

#### 2.2 SearchScreen.tsx
**Color instances:** 25+
**Hardcoded colors found:**
- `#F5F5F5`, `#fff`, `#FFFFFF` (backgrounds)
- `#1A1A1A`, `#666`, `#555`, `#333` (text colors)
- `#FF6347` (tomato red - filter buttons)
- `#f0f0f0` (button backgrounds)
- `#FFF0ED` (in-range background)
- Shadow colors

**Changes needed:**
- Container background
- Card backgrounds
- Filter button styling (active/inactive)
- Text colors (title, subtitle, metadata)
- In-range indicator background
- Loading and error states

---

#### 2.3 HomeScreen.tsx
**Color instances:** 12+
**Hardcoded colors found:**
- `#fff` (background)
- `#ff6600`, `#e91e63` (icon colors)
- `#007bff` (button)
- `#555`, `#888` (text)
- `rgba(255, 102, 0, 0.5)` (glow border)

**Changes needed:**
- Screen background
- Button backgrounds (login, signup, logout)
- Icon colors (tools, support)
- Text colors
- Glow/shadow effects

---

#### 2.4 ProfileScreen.tsx
**Color instances:** 30+
**Hardcoded colors found:**
- `#fff`, `#fff5f5` (backgrounds)
- `#333`, `#555`, `#666`, `#888` (text variations)
- `#007bff`, `#4caf50` (buttons)
- `#ff4757` (admin badge)
- `#f44336` (delete button)
- Modal overlay colors

**Changes needed:**
- Screen background
- Button styling (6+ different buttons)
- Text hierarchy (username, vocal range, coins)
- Admin badge styling
- Modal backgrounds
- Delete account section

**Special note:** Add dark mode toggle here

---

#### 2.5 SongDetailsScreen.tsx
**Color instances:** 40+
**Uses:** Mix of COLORS constants and hardcoded values
**Hardcoded colors found:**
- `white`, `#ccc` (backgrounds)
- `rgba(0, 0, 0, 0.5)` (modals)
- Shadow colors

**Changes needed:**
- Already uses some COLORS constants (good!)
- Update remaining hardcoded values
- Modal styling
- Card backgrounds

---

#### 2.6 SavedListsScreen.tsx
**Color instances:** 25+
**Uses:** COLORS constants + some hardcoded
**Hardcoded colors found:**
- `#ff4444` (delete button)
- `white`, `rgba(255, 255, 255, 0.8)` (text on cards)
- Shadow colors

**Changes needed:**
- List card backgrounds
- Text on colored backgrounds
- Delete/action button colors
- Empty state styling

---

#### 2.7 MetronomeScreen.tsx
**Color instances:** 30+
**Hardcoded colors found:**
- `#f5f5f5` (background)
- `#ff6600`, `#32CD32`, `#808080` (indicator colors)
- `#fff`, `#333`, `#555`, `#999` (text)
- `#ddd` (borders)
- Shadow colors

**Changes needed:**
- Screen background
- Beat indicator colors (keep vibrant for visibility)
- Control button styling
- Input field backgrounds
- Text colors

---

#### 2.8 Profile Modals
**Files:**
- ProfileMenu.tsx (8 colors)
- EditProfileModal.tsx (15 colors)
- AdminProfileScreen.tsx (35+ colors)
- AdminQuickStats.tsx (12 colors)

**Common patterns:**
- Modal overlays: `rgba(0, 0, 0, 0.5)`
- Modal backgrounds: `#fff`
- Input borders: `#ccc`, `#ddd`
- Button colors: `#007bff`
- Text: `#333`, `#555`, `#666`

---

#### 2.9 Auth Screens
**Files:**
- LoginModal.tsx (12 colors)
- SignupModal.tsx (10 colors)
- ForgotPasswordScreen.tsx (4 colors)
- ResetPasswordScreen.tsx (3 colors)

**Common patterns:**
- Modal overlays and backgrounds
- Input field styling
- Button colors
- Link colors
- Placeholder text colors

---

#### 2.10 List Screens
**Files:**
- ListDetailsScreen.tsx (15+ colors)
- AddSongScreen.tsx (colors to verify)

---

### Medium Priority Files

#### 2.11 Components
**Files:**
- SearchBar.tsx (6 colors)
- SupportModal.tsx (8 colors)
- Piano.tsx (uses COLORS - verify)
- LoadingScreen.tsx (3 colors)

---

#### 2.12 Navigation
**Files:**
- StackNavigator.tsx (icon colors)

---

### Low Priority Files (Minimal Colors)

#### 2.13 Simple Screens
- TunerScreen.tsx (2 colors)
- LogoutScreen.tsx (2 colors)
- LoginScreen.tsx (2 colors)
- DonateScreen.tsx (to verify)
- ArtistDetailsScreen.tsx (to verify)

---

## 3. Icon Colors (1 hour)

### Ionicons Color Props
**Found 20+ instances with hardcoded colors:**

```typescript
// Examples found:
<Ionicons name="cog-outline" size={30} color="#ff6600" />
<Ionicons name="heart-outline" size={30} color="#e91e63" />
<Ionicons name="add-circle" size={36} color="tomato" />
<Ionicons name="arrow-back" size={24} color="#ff6600" />
```

**Solution:** Use theme colors
```typescript
<Ionicons name="cog-outline" size={30} color={colors.primary} />
```

---

## 4. Special Cases & Considerations

### 4.1 StatusBar
**File:** App.tsx or theme context
```typescript
import { StatusBar } from 'expo-status-bar';
<StatusBar style={isDark ? 'light' : 'dark'} />
```

---

### 4.2 App Config
**File:** app.config.js
```javascript
backgroundColor: "#ffffff", // Line 20, 93
```

**Solution:** This is for splash screen - may need conditional config or stick with light

---

### 4.3 ActivityIndicator Colors
**Found in 10+ files:**
```typescript
<ActivityIndicator size="large" color="tomato" />
<ActivityIndicator size="large" color="#007bff" />
<ActivityIndicator color="#ff4757" />
```

**Change to:**
```typescript
<ActivityIndicator size="large" color={colors.primary} />
```

---

### 4.4 Placeholder Text Colors
**Found in multiple input fields:**
```typescript
placeholderTextColor="#777"
placeholderTextColor="#888"
placeholderTextColor="#999"
```

**Change to:**
```typescript
placeholderTextColor={colors.textTertiary}
```

---

### 4.5 Shadow Colors
**Many instances of:**
```typescript
shadowColor: '#000',
shadowColor: "#000",
```

**Solution:** Shadows work in dark mode, but may need:
```typescript
shadowColor: colors.shadow,
```

---

### 4.6 Modal Overlays
**Common pattern:**
```typescript
backgroundColor: "rgba(0, 0, 0, 0.5)",
```

**Dark mode adjustment:**
```typescript
backgroundColor: colors.overlay, // rgba(0, 0, 0, 0.7) for dark
```

---

### 4.7 Brand Colors to Keep Consistent
**These should remain similar in both themes:**
- Primary orange: `#ff6600` → slightly adjusted for dark
- Success green: `#4CAF50` → `#66bb6a`
- Danger red: `#ff4444` → `#ff5555`
- Link blue: `#007bff` → `#42a5f5`

---

## 5. Implementation Strategy

### Phase 1: Infrastructure (2-3 hours)
1. ✅ Create ThemeContext.tsx
2. ✅ Expand theme.ts with full color palettes
3. ✅ Wrap App.tsx in ThemeProvider
4. ✅ Test basic theme switching

### Phase 2: High-Impact Screens (4-5 hours)
1. ✅ SearchScreen.tsx
2. ✅ HomeScreen.tsx
3. ✅ ProfileScreen.tsx (add toggle here)
4. ✅ SongDetailsScreen.tsx
5. ✅ Test each screen in both modes

### Phase 3: Remaining Screens (3-4 hours)
1. ✅ SavedListsScreen.tsx
2. ✅ MetronomeScreen.tsx
3. ✅ All modals (Login, Signup, Edit Profile, etc.)
4. ✅ Admin screens
5. ✅ AddSongScreen.tsx

### Phase 4: Components & Polish (2-3 hours)
1. ✅ SearchBar component
2. ✅ SupportModal component
3. ✅ LoadingScreen component
4. ✅ Icon colors throughout
5. ✅ ActivityIndicators
6. ✅ Final testing & adjustments

---

## 6. Testing Checklist

### Functionality Tests
- [ ] Theme persists across app restarts
- [ ] Toggle switch works correctly
- [ ] System theme detection works (if implementing)
- [ ] No flash of wrong theme on startup

### Visual Tests per Screen
- [ ] Text is readable in both modes
- [ ] Buttons have sufficient contrast
- [ ] Modal overlays are appropriate
- [ ] Icons are visible
- [ ] Input fields are usable
- [ ] Borders/dividers are visible but subtle
- [ ] Cards stand out from background
- [ ] Success/error states are clear

### Edge Cases
- [ ] Nested modals (if any)
- [ ] Loading states
- [ ] Empty states
- [ ] Error states
- [ ] Admin-only features
- [ ] Disabled states

---

## 7. Files Summary

### Total Files to Modify: ~45

#### Create New (2 files):
1. `app/contexts/ThemeContext.tsx`
2. `app/hooks/useTheme.ts` (optional, for easier imports)

#### Modify Existing:

**Core (4 files):**
- App.tsx
- app/styles/theme.ts
- app.config.js (optional)
- index.ts (to import ThemeProvider)

**Screens (20+ files):**
- HomeScreen.tsx
- SearchScreen.tsx
- ProfileScreen.tsx ⭐ (add toggle)
- SongDetailsScreen.tsx
- SavedListsScreen.tsx
- ListDetailsScreen.tsx
- AddSongScreen.tsx
- MetronomeScreen.tsx
- TunerScreen.tsx
- LoginScreen.tsx
- LogoutScreen.tsx
- DonateScreen.tsx
- ArtistDetailsScreen.tsx
- DetailsScreen.tsx
- ForgotPasswordScreen.tsx
- ResetPasswordScreen.tsx

**Modals (6+ files):**
- LoginModal.tsx
- SignupModal.tsx
- EditProfileModal.tsx
- SupportModal.tsx
- ProfileMenu.tsx
- AdminProfileScreen.tsx
- AdminQuickStats.tsx

**Components (4 files):**
- SearchBar.tsx
- LoadingScreen.tsx
- Piano.tsx (verify)
- SupportModal.tsx

**Navigation (1 file):**
- StackNavigator.tsx

---

## 8. Color Migration Cheat Sheet

### Search & Replace Patterns
Use these regex patterns to find hardcoded colors:

```
#[0-9a-fA-F]{3,6}\b
rgb\(
rgba\(
backgroundColor:\s*["'](?!COLORS)
color:\s*["'](?!COLORS)
```

### Common Replacements

| Hardcoded Value | Replace With | Purpose |
|----------------|--------------|---------|
| `#fff`, `#ffffff`, `white` | `colors.backgroundCard` | Card/modal backgrounds |
| `#f9f9f9`, `#F5F5F5`, `#f5f5f5` | `colors.background` | Screen backgrounds |
| `#333`, `#1A1A1A` | `colors.textPrimary` | Primary text |
| `#666`, `#555` | `colors.textSecondary` | Secondary text |
| `#888`, `#999` | `colors.textTertiary` | Tertiary/placeholder text |
| `#ddd`, `#e0e0e0` | `colors.border` | Borders |
| `#ff6600`, `#ff6347`, `tomato` | `colors.primary` | Primary brand |
| `#007bff` | `colors.link` | Links/secondary buttons |
| `#4CAF50` | `colors.success` | Success states |
| `#ff4444`, `#f44336` | `colors.danger` | Delete/danger actions |
| `rgba(0, 0, 0, 0.5)` | `colors.overlay` | Modal overlays |

---

## 9. Implementation Example

### Before:
```typescript
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
  text: {
    color: '#333',
  },
  button: {
    backgroundColor: '#ff6600',
  },
});
```

### After:
```typescript
// At top of component
const { colors } = useTheme();

// In component
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundCard,
  },
  text: {
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.primary,
  },
});
```

**Note:** StyleSheet must be created inside component to access theme context!

---

## 10. Potential Issues & Solutions

### Issue 1: StyleSheet.create() is static
**Problem:** Can't use theme colors in StyleSheet outside component
**Solution:** Move StyleSheet.create() inside component or use inline styles for themed values

### Issue 2: Performance with many StyleSheet recreations
**Solution:** Use useMemo to memoize styles
```typescript
const styles = useMemo(() => createStyles(colors), [colors]);
```

### Issue 3: Third-party component colors
**Solution:** Wrap or extend components to accept theme colors

### Issue 4: Image/asset visibility
**Solution:** May need light/dark versions of some images, or use tintColor

---

## 11. Nice-to-Have Enhancements

### System Theme Detection
```typescript
const colorScheme = useColorScheme(); // from react-native
```

### Animated Theme Transitions
```typescript
import { Animated } from 'react-native';
// Animate color changes
```

### Per-Screen Theme Override
Allow certain screens to force light/dark mode

### Theme Preview
Show both modes side-by-side before committing

---

## Summary

**Total Hardcoded Colors:** 200+ instances
**Files to Modify:** ~45 files
**New Files to Create:** 1-2 files
**Estimated Time:** 10-15 hours

**Difficulty:** Medium
- ✅ Straightforward task with clear patterns
- ✅ Existing theme.ts provides good foundation
- ⚠️ Time-consuming due to volume
- ⚠️ Requires systematic approach
- ⚠️ Testing is critical

**ROI:** High - Dark mode is a highly requested feature that improves user experience significantly.
