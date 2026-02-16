// app/screens/PianoScreen/PianoScreen.tsx

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "../../navigation/StackNavigator";
import { useTheme } from "../../contexts/ThemeContext";
import * as ScreenOrientation from "expo-screen-orientation";

// ─── Layout ─────────────────────────────────────────────────────
const WHITE_KEY_WIDTH = 52;
const BLACK_KEY_WIDTH = 32;
const BLACK_KEY_RATIO = 0.625;

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

interface NoteInfo {
  name: string;
  isBlack: boolean;
  octave: number;
  frequency: number;
  midiNote: number;
}

function generateNotes(): NoteInfo[] {
  const notes: NoteInfo[] = [];
  for (let midi = 24; midi <= 96; midi++) {
    const noteIndex = (midi - 24) % 12;
    const octave = Math.floor((midi - 12) / 12);
    const noteName = NOTE_NAMES[noteIndex];
    const isBlack = noteName.includes("#");
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);
    notes.push({ name: `${noteName}${octave}`, isBlack, octave, frequency, midiNote: midi });
  }
  return notes;
}

const ALL_NOTES = generateNotes();
const WHITE_NOTES = ALL_NOTES.filter((n) => !n.isBlack);
const BLACK_NOTES = ALL_NOTES.filter((n) => n.isBlack);

// ─── Audio Files ────────────────────────────────────────────────
const NOTE_AUDIO_FILES: Record<string, any> = {
  C1: require("../../../assets/piano/C1.wav"),
  Cs1: require("../../../assets/piano/Cs1.wav"),
  D1: require("../../../assets/piano/D1.wav"),
  Ds1: require("../../../assets/piano/Ds1.wav"),
  E1: require("../../../assets/piano/E1.wav"),
  F1: require("../../../assets/piano/F1.wav"),
  Fs1: require("../../../assets/piano/Fs1.wav"),
  G1: require("../../../assets/piano/G1.wav"),
  Gs1: require("../../../assets/piano/Gs1.wav"),
  A1: require("../../../assets/piano/A1.wav"),
  As1: require("../../../assets/piano/As1.wav"),
  B1: require("../../../assets/piano/B1.wav"),
  C2: require("../../../assets/piano/C2.wav"),
  Cs2: require("../../../assets/piano/Cs2.wav"),
  D2: require("../../../assets/piano/D2.wav"),
  Ds2: require("../../../assets/piano/Ds2.wav"),
  E2: require("../../../assets/piano/E2.wav"),
  F2: require("../../../assets/piano/F2.wav"),
  Fs2: require("../../../assets/piano/Fs2.wav"),
  G2: require("../../../assets/piano/G2.wav"),
  Gs2: require("../../../assets/piano/Gs2.wav"),
  A2: require("../../../assets/piano/A2.wav"),
  As2: require("../../../assets/piano/As2.wav"),
  B2: require("../../../assets/piano/B2.wav"),
  C3: require("../../../assets/piano/C3.wav"),
  Cs3: require("../../../assets/piano/Cs3.wav"),
  D3: require("../../../assets/piano/D3.wav"),
  Ds3: require("../../../assets/piano/Ds3.wav"),
  E3: require("../../../assets/piano/E3.wav"),
  F3: require("../../../assets/piano/F3.wav"),
  Fs3: require("../../../assets/piano/Fs3.wav"),
  G3: require("../../../assets/piano/G3.wav"),
  Gs3: require("../../../assets/piano/Gs3.wav"),
  A3: require("../../../assets/piano/A3.wav"),
  As3: require("../../../assets/piano/As3.wav"),
  B3: require("../../../assets/piano/B3.wav"),
  C4: require("../../../assets/piano/C4.wav"),
  Cs4: require("../../../assets/piano/Cs4.wav"),
  D4: require("../../../assets/piano/D4.wav"),
  Ds4: require("../../../assets/piano/Ds4.wav"),
  E4: require("../../../assets/piano/E4.wav"),
  F4: require("../../../assets/piano/F4.wav"),
  Fs4: require("../../../assets/piano/Fs4.wav"),
  G4: require("../../../assets/piano/G4.wav"),
  Gs4: require("../../../assets/piano/Gs4.wav"),
  A4: require("../../../assets/piano/A4.wav"),
  As4: require("../../../assets/piano/As4.wav"),
  B4: require("../../../assets/piano/B4.wav"),
  C5: require("../../../assets/piano/C5.wav"),
  Cs5: require("../../../assets/piano/Cs5.wav"),
  D5: require("../../../assets/piano/D5.wav"),
  Ds5: require("../../../assets/piano/Ds5.wav"),
  E5: require("../../../assets/piano/E5.wav"),
  F5: require("../../../assets/piano/F5.wav"),
  Fs5: require("../../../assets/piano/Fs5.wav"),
  G5: require("../../../assets/piano/G5.wav"),
  Gs5: require("../../../assets/piano/Gs5.wav"),
  A5: require("../../../assets/piano/A5.wav"),
  As5: require("../../../assets/piano/As5.wav"),
  B5: require("../../../assets/piano/B5.wav"),
  C6: require("../../../assets/piano/C6.wav"),
  Cs6: require("../../../assets/piano/Cs6.wav"),
  D6: require("../../../assets/piano/D6.wav"),
  Ds6: require("../../../assets/piano/Ds6.wav"),
  E6: require("../../../assets/piano/E6.wav"),
  F6: require("../../../assets/piano/F6.wav"),
  Fs6: require("../../../assets/piano/Fs6.wav"),
  G6: require("../../../assets/piano/G6.wav"),
  Gs6: require("../../../assets/piano/Gs6.wav"),
  A6: require("../../../assets/piano/A6.wav"),
  As6: require("../../../assets/piano/As6.wav"),
  B6: require("../../../assets/piano/B6.wav"),
  C7: require("../../../assets/piano/C7.wav"),
};

function noteToFileKey(noteName: string): string {
  return noteName.replace("#", "s");
}

function getBlackKeyPosition(note: NoteInfo): number {
  const whiteKeysBefore = WHITE_NOTES.filter((w) => w.midiNote < note.midiNote).length;
  return whiteKeysBefore * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2;
}

// ─── Component ──────────────────────────────────────────────────
type PianoScreenProps = NativeStackScreenProps<RootStackParamList, "Piano">;

export default function PianoScreen({ navigation }: PianoScreenProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const [showLabels, setShowLabels] = useState(true);
  const [sustain, setSustain] = useState(false);
  const [lastPlayedNote, setLastPlayedNote] = useState<string | null>(null);
  const soundRefs = useRef<Map<string, Audio.Sound[]>>(new Map());
  const heldNotes = useRef<Set<string>>(new Set());
  const sustainRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [pianoHeight, setPianoHeight] = useState(240);
  const whiteKeyHeight = pianoHeight;
  const blackKeyHeight = Math.round(pianoHeight * BLACK_KEY_RATIO);

  // Lock to landscape on focus, restore portrait on blur
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE
      ).catch(() => {});

      return () => {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        ).catch(() => {});
      };
    }, [])
  );

  // Configure audio
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  // Scroll to middle C on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollViewRef.current) {
        const c4WhiteIndex = WHITE_NOTES.findIndex((n) => n.name === "C4");
        const scrollTo = Math.max(
          0,
          c4WhiteIndex * WHITE_KEY_WIDTH - Dimensions.get("window").width / 2
        );
        scrollViewRef.current.scrollTo({ x: scrollTo, animated: false });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup sounds on unmount
  useEffect(() => {
    return () => {
      soundRefs.current.forEach((sounds) => {
        sounds.forEach((s) => s.unloadAsync().catch(() => {}));
      });
      soundRefs.current.clear();
    };
  }, []);

  // Keep sustainRef in sync so callbacks always see latest value
  useEffect(() => {
    sustainRef.current = sustain;
  }, [sustain]);

  const stopAllSounds = useCallback(async () => {
    const promises: Promise<void>[] = [];
    soundRefs.current.forEach((sounds) => {
      sounds.forEach((s) => {
        promises.push(
          s.stopAsync().then(() => { s.unloadAsync().catch(() => {}); }).catch(() => {})
        );
      });
    });
    soundRefs.current.clear();
    setActiveNotes(new Set());
    await Promise.all(promises);
  }, []);

  // Remove a specific sound from the ref tracking
  const removeSound = useCallback((noteName: string, sound: Audio.Sound) => {
    const arr = soundRefs.current.get(noteName);
    if (arr) {
      const idx = arr.indexOf(sound);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) {
        soundRefs.current.delete(noteName);
        setActiveNotes((prev) => {
          const next = new Set(prev);
          next.delete(noteName);
          return next;
        });
      }
    }
  }, []);

  // Core: create and play a single sound for a note, return the Sound instance
  const triggerNote = useCallback(async (note: NoteInfo): Promise<Audio.Sound | null> => {
    const fileKey = noteToFileKey(note.name);
    const audioFile = NOTE_AUDIO_FILES[fileKey];
    if (!audioFile) return null;

    try {
      const { sound } = await Audio.Sound.createAsync(audioFile, {
        shouldPlay: true,
        volume: 1.0,
      });

      const existing = soundRefs.current.get(note.name) || [];
      existing.push(sound);
      soundRefs.current.set(note.name, existing);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          removeSound(note.name, sound);

          // If finger is still held, retrigger to extend the note seamlessly
          if (heldNotes.current.has(note.name)) {
            triggerNote(note);
          }
        }
      });

      return sound;
    } catch (error) {
      console.warn("Error playing note:", note.name, error);
      return null;
    }
  }, [removeSound]);

  // Fade out and stop a specific sound
  const fadeOutSound = useCallback(async (sound: Audio.Sound, noteName: string) => {
    try {
      await sound.setVolumeAsync(0.2);
      setTimeout(async () => {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch {}
        removeSound(noteName, sound);
      }, 150);
    } catch {}
  }, [removeSound]);

  // --- Touch handlers ---

  const onKeyDown = useCallback((note: NoteInfo) => {
    heldNotes.current.add(note.name);
    setActiveNotes((prev) => new Set(prev).add(note.name));
    setLastPlayedNote(note.name);
    triggerNote(note);
  }, [triggerNote]);

  const onKeyUp = useCallback((note: NoteInfo) => {
    heldNotes.current.delete(note.name);

    // With sustain: let the note ring out naturally (full WAV duration)
    // Without sustain: fade out and stop immediately on release
    if (!sustainRef.current) {
      const sounds = soundRefs.current.get(note.name);
      if (sounds) {
        // Fade out all instances of this note
        const toFade = [...sounds];
        toFade.forEach((s) => fadeOutSound(s, note.name));
      }
    }

    // Clear visual highlight after a brief moment
    setTimeout(() => {
      if (!heldNotes.current.has(note.name)) {
        setActiveNotes((prev) => {
          const next = new Set(prev);
          next.delete(note.name);
          return next;
        });
      }
    }, 100);
  }, [fadeOutSound]);

  // Quick tap (no hold) — play note with timed highlight for non-held taps
  const onQuickTap = useCallback((note: NoteInfo) => {
    setActiveNotes((prev) => new Set(prev).add(note.name));
    setLastPlayedNote(note.name);
    triggerNote(note);

    if (!sustainRef.current) {
      setTimeout(async () => {
        const sounds = soundRefs.current.get(note.name);
        if (sounds && !heldNotes.current.has(note.name)) {
          [...sounds].forEach((s) => fadeOutSound(s, note.name));
        }
      }, 1200);
    }

    // Visual highlight
    setTimeout(() => {
      if (!heldNotes.current.has(note.name)) {
        setActiveNotes((prev) => {
          const next = new Set(prev);
          next.delete(note.name);
          return next;
        });
      }
    }, sustainRef.current ? 800 : 200);
  }, [triggerNote, fadeOutSound]);

  const totalWidth = WHITE_NOTES.length * WHITE_KEY_WIDTH;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* ── Top Controls ── */}
      <SafeAreaView edges={["top", "left", "right"]} style={styles.topSafeArea}>
        <View style={styles.topBar}>
          {/* Back button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          {/* Current note display */}
          <View style={styles.noteDisplay}>
            <Text style={styles.noteDisplayText}>
              {lastPlayedNote || "\u266A"}
            </Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={[
                styles.controlPill,
                sustain && styles.controlPillActive,
              ]}
              onPress={() => {
                if (sustain) stopAllSounds();
                setSustain(!sustain);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={sustain ? "radio-button-on" : "radio-button-off"}
                size={14}
                color={sustain ? colors.primary : colors.textSecondary}
              />
              <Text style={[
                styles.controlPillText,
                sustain && { color: colors.primary },
              ]}>
                Sustain
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlPill}
              onPress={() => setShowLabels(!showLabels)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showLabels ? "eye" : "eye-off"}
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.controlPillText}>
                Labels
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* ── Piano Keyboard ── */}
      <View
        style={styles.pianoScroll}
        onLayout={(e) => setPianoHeight(e.nativeEvent.layout.height)}
      >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ width: totalWidth, height: whiteKeyHeight }}
        style={{ flex: 1 }}
      >
        <View style={styles.pianoContainer}>
          {/* White Keys */}
          {WHITE_NOTES.map((note, index) => {
            const isActive = activeNotes.has(note.name);
            const isC = note.name.startsWith("C");
            return (
              <View
                key={note.name}
                onTouchStart={() => onKeyDown(note)}
                onTouchEnd={() => onKeyUp(note)}
                onTouchCancel={() => onKeyUp(note)}
                style={[
                  styles.whiteKey,
                  {
                    left: index * WHITE_KEY_WIDTH,
                    height: whiteKeyHeight,
                  },
                  isActive && styles.whiteKeyActive,
                  isC && styles.whiteKeyOctaveStart,
                ]}
              >
                {/* Octave marker on every C key */}
                {isC && (
                  <View style={styles.octaveMarker}>
                    <Text style={styles.octaveMarkerText}>{note.name}</Text>
                  </View>
                )}
                {showLabels && !isC && (
                  <Text style={styles.whiteKeyLabel}>{note.name}</Text>
                )}
              </View>
            );
          })}

          {/* Black Keys */}
          {BLACK_NOTES.map((note) => {
            const isActive = activeNotes.has(note.name);
            const xPos = getBlackKeyPosition(note);
            return (
              <View
                key={note.name}
                onTouchStart={() => onKeyDown(note)}
                onTouchEnd={() => onKeyUp(note)}
                onTouchCancel={() => onKeyUp(note)}
                style={[
                  styles.blackKey,
                  { left: xPos, height: blackKeyHeight },
                  isActive && styles.blackKeyActive,
                ]}
              >
                {showLabels && (
                  <Text style={styles.blackKeyLabel}>{note.name}</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────
const createStyles = (colors: any, isDark: boolean) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topSafeArea: {
      backgroundColor: colors.backgroundCard,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 12,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    noteDisplay: {
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 4,
      minWidth: 60,
      alignItems: "center",
    },
    noteDisplayText: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      letterSpacing: 1,
    },
    controls: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
    },
    controlPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    controlPillActive: {
      backgroundColor: colors.primary + "20",
      borderColor: colors.primary + "40",
    },
    controlPillText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    pianoScroll: {
      flex: 1,
    },
    pianoContainer: {
      flex: 1,
      position: "relative",
    },
    whiteKey: {
      position: "absolute",
      top: 0,
      width: WHITE_KEY_WIDTH,
      backgroundColor: "#F8F8F8",
      borderRightWidth: 1,
      borderRightColor: "#D4D4D4",
      borderBottomWidth: 3,
      borderBottomColor: "#BFBFBF",
      justifyContent: "flex-end",
      alignItems: "center",
      paddingBottom: 8,
    },
    whiteKeyActive: {
      backgroundColor: colors.primary + "35",
      borderBottomColor: colors.primary + "60",
    },
    whiteKeyOctaveStart: {
      borderLeftWidth: 2,
      borderLeftColor: "#AAAAAA",
    },
    octaveMarker: {
      position: "absolute",
      bottom: 6,
      backgroundColor: "rgba(0,0,0,0.06)",
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    octaveMarkerText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#555",
    },
    whiteKeyLabel: {
      fontSize: 9,
      color: "#999",
      fontWeight: "500",
    },
    blackKey: {
      position: "absolute",
      top: 0,
      width: BLACK_KEY_WIDTH,
      backgroundColor: "#1A1A1A",
      borderBottomLeftRadius: 5,
      borderBottomRightRadius: 5,
      borderBottomWidth: 3,
      borderBottomColor: "#000",
      justifyContent: "flex-end",
      alignItems: "center",
      paddingBottom: 6,
      zIndex: 10,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 4,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    blackKeyActive: {
      backgroundColor: colors.primary,
      borderBottomColor: colors.primary + "80",
    },
    blackKeyLabel: {
      fontSize: 7,
      color: "#777",
      fontWeight: "500",
    },
  });
};
