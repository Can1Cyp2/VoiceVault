# Dark Mode Quick Start Guide

## TL;DR
- **200+ hardcoded colors** across ~45 files need updating
- **10-15 hours** of systematic refactoring
- **Difficulty:** Medium (straightforward but time-consuming)
- **Start here:** Theme infrastructure, then high-impact screens

---

## The Numbers

### Color Breakdown by File Type
| Category | Files | Color Instances |
|----------|-------|----------------|
| Main Screens | 15 | ~120 |
| Modals | 7 | ~50 |
| Components | 4 | ~20 |
| Navigation | 1 | ~5 |
| Config | 2 | ~5 |

### Most Color-Heavy Files
1. **SongDetailsScreen.tsx** - 40+ colors
2. **AdminProfileScreen.tsx** - 35+ colors  
3. **ProfileScreen.tsx** - 30+ colors
4. **MetronomeScreen.tsx** - 30+ colors
5. **SearchScreen.tsx** - 25+ colors
6. **SavedListsScreen.tsx** - 25+ colors

---

## 4-Phase Implementation Plan

### ✅ Phase 1: Infrastructure (2-3 hrs)
```bash
# Create new files:
app/contexts/ThemeContext.tsx
app/hooks/useTheme.ts (optional)

# Modify:
app/styles/theme.ts          # Add LightColors & DarkColors
App.tsx                       # Add ThemeProvider
```

**Deliverable:** Working theme context with light/dark schemes

---

### ✅ Phase 2: High-Impact Screens (4-5 hrs)
**Priority order:**
1. SearchScreen.tsx (25 colors) - Most used
2. HomeScreen.tsx (12 colors) - First impression
3. ProfileScreen.tsx (30 colors) - **Add dark mode toggle here**
4. SongDetailsScreen.tsx (40 colors) - Complex UI

**Pattern for each:**
```typescript
// 1. Import at top
import { useTheme } from '../contexts/ThemeContext';

// 2. Get colors in component
const { colors, isDark } = useTheme();

// 3. Move StyleSheet inside component (or use useMemo)
const styles = useMemo(() => StyleSheet.create({
  container: { backgroundColor: colors.background },
  text: { color: colors.textPrimary },
  // ... etc
}), [colors]);

// 4. Test both light and dark
```

---

### ✅ Phase 3: Remaining Screens (3-4 hrs)
**Batch similar files:**
- Auth flows: Login, Signup, Reset Password (similar patterns)
- Lists: SavedLists, ListDetails (similar patterns)
- Tools: Metronome, Tuner (similar patterns)
- Admin: AdminProfile, AdminQuickStats (similar patterns)

---

### ✅ Phase 4: Components & Polish (2-3 hrs)
- SearchBar component
- SupportModal component
- LoadingScreen component
- Icon colors (20+ instances)
- ActivityIndicator colors (10+ instances)
- Final QA & tweaks

---

## Common Color Mappings

### Quick Reference Table
```typescript
// Backgrounds
"#fff", "white"           → colors.backgroundCard
"#f9f9f9", "#F5F5F5"     → colors.background
"#f0f0f0"                → colors.backgroundTertiary

// Text
"#333", "#1A1A1A"        → colors.textPrimary
"#555", "#666"           → colors.textSecondary
"#888", "#999"           → colors.textTertiary

// Borders
"#ddd", "#e0e0e0"        → colors.border
"#ccc"                   → colors.borderLight

// Brand (keep vibrant)
"#ff6600", "tomato"      → colors.primary
"#007bff"                → colors.link
"#4CAF50"                → colors.success
"#ff4444"                → colors.danger

// Special
"rgba(0,0,0,0.5)"        → colors.overlay
```

---

## Code Templates

### 1. Theme Context (ThemeContext.tsx)
```typescript
import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors } from '../styles/theme';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState('system'); // 'light' | 'dark' | 'system'
  
  const isDark = mode === 'system' 
    ? systemScheme === 'dark' 
    : mode === 'dark';
    
  const colors = isDark ? DarkColors : LightColors;
  
  useEffect(() => {
    AsyncStorage.getItem('theme').then(saved => {
      if (saved) setMode(saved);
    });
  }, []);
  
  const setThemeMode = (newMode) => {
    setMode(newMode);
    AsyncStorage.setItem('theme', newMode);
  };
  
  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode: setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
```

### 2. Updated App.tsx
```typescript
import { ThemeProvider } from './app/contexts/ThemeContext';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <ThemeProvider>
      <YourAppContent />
    </ThemeProvider>
  );
}

function YourAppContent() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Rest of your app */}
    </>
  );
}
```

### 3. Dark Mode Toggle (in ProfileScreen.tsx)
```typescript
import { Switch } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

// Inside component:
const { mode, setMode, isDark } = useTheme();

return (
  <View style={styles.settingRow}>
    <Text style={styles.settingLabel}>Dark Mode</Text>
    <Switch
      value={isDark}
      onValueChange={(value) => setMode(value ? 'dark' : 'light')}
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor={isDark ? colors.backgroundCard : colors.backgroundTertiary}
    />
  </View>
);
```

### 4. Converting a Screen (Example)
```typescript
// BEFORE
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
  title: {
    color: '#333',
  },
});

// AFTER
import { useTheme } from '../../contexts/ThemeContext';
import { useMemo } from 'react';

function MyScreen() {
  const { colors } = useTheme();
  
  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.backgroundCard,
    },
    title: {
      color: colors.textPrimary,
    },
  }), [colors]);
  
  return <View style={styles.container}>...</View>;
}
```

---

## Testing Checklist

### Per Screen
- [ ] Open in light mode - everything visible?
- [ ] Toggle to dark mode - everything visible?
- [ ] Text has good contrast
- [ ] Borders are subtle but visible
- [ ] Buttons are clearly interactive
- [ ] No white flashes during transitions

### Overall
- [ ] Theme persists after app restart
- [ ] No console errors
- [ ] Performance is acceptable
- [ ] All modals work in both modes
- [ ] Icons are visible
- [ ] ActivityIndicators use theme colors

---

## Regex Find Patterns

Use VS Code search (Ctrl+Shift+F) with regex enabled:

### Find all hex colors:
```
#[0-9a-fA-F]{3,6}\b
```

### Find backgroundColor with hardcoded values:
```
backgroundColor:\s*["'](?!colors|COLORS)
```

### Find color properties:
```
(?:color|backgroundColor|borderColor|shadowColor|tintColor):\s*["'][^"']*["']
```

### Find rgba/rgb:
```
rgba?\([^)]+\)
```

---

## Common Pitfalls

### ❌ Don't Do This
```typescript
// StyleSheet outside component - can't access theme!
const styles = StyleSheet.create({ ... });

function MyScreen() {
  const { colors } = useTheme();
  return <View style={styles.container} />;
}
```

### ✅ Do This Instead
```typescript
function MyScreen() {
  const { colors } = useTheme();
  
  const styles = useMemo(() => StyleSheet.create({
    container: { backgroundColor: colors.background }
  }), [colors]);
  
  return <View style={styles.container} />;
}
```

### ❌ Don't Hardcode in JSX
```typescript
<Text style={{ color: '#333' }}>Hello</Text>
```

### ✅ Use Theme Colors
```typescript
<Text style={{ color: colors.textPrimary }}>Hello</Text>
```

---

## Shortcuts & Tips

### 1. Batch Process Similar Files
Group files by pattern (modals, lists, etc.) and apply same changes

### 2. Use Multi-Cursor
- Select all instances of a color
- Edit simultaneously
- Saves tons of time!

### 3. Test After Each File
Don't refactor 10 files then test - test incrementally

### 4. Start Simple
Begin with screens that only use COLORS constants - quick wins!

### 5. Use Git Branches
Create feature branch, commit after each screen works

---

## Expected Results

### Light Mode (Current)
- Bright, clean appearance
- White backgrounds
- Dark text
- Orange/tomato accents

### Dark Mode (New)
- Dark gray/black backgrounds (#121212, #1e1e1e)
- Light gray text (#e0e0e0)
- Slightly brighter accents for visibility
- Reduced eye strain in low light

---

## File Structure After Implementation

```
VoiceVault/
├── app/
│   ├── contexts/
│   │   └── ThemeContext.tsx         ← NEW
│   ├── hooks/
│   │   └── useTheme.ts              ← NEW (optional)
│   ├── styles/
│   │   └── theme.ts                 ← MODIFIED (add colors)
│   ├── screens/
│   │   ├── HomeScreen/
│   │   │   └── HomeScreen.tsx       ← MODIFIED
│   │   ├── ProfileScreen/
│   │   │   └── ProfileScreen.tsx    ← MODIFIED (add toggle)
│   │   └── ... (all other screens)  ← MODIFIED
│   └── components/
│       └── ... (all components)     ← MODIFIED
├── App.tsx                          ← MODIFIED (add provider)
└── DARK_MODE_REQUIREMENTS.md        ← THIS DOC
```

---

## Next Steps

1. **Read full requirements:** `DARK_MODE_REQUIREMENTS.md`
2. **Create theme infrastructure** (Phase 1)
3. **Test basic switching** with one screen
4. **Systematically update** remaining screens
5. **QA thoroughly** in both modes
6. **Ship it!** 🚀

---

## Questions to Decide

- [ ] Support system theme detection? (auto light/dark based on OS)
- [ ] Three modes (light/dark/system) or just two (light/dark)?
- [ ] Should brand colors (orange) be identical or slightly different?
- [ ] Animated transitions between themes?
- [ ] Per-screen theme override needed?

---

## Success Metrics

✅ **Done when:**
- All screens work perfectly in both modes
- No hardcoded color values remain (except intentional ones)
- Theme persists across app restarts
- User can toggle easily from ProfileScreen
- App passes visual QA in both modes

**Good luck!** You've got this. It's tedious but very achievable. 💪
