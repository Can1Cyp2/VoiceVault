// app/screens/MetronomeScreen/MetronomeScreen.tsx

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
  TextInput,
  Dimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { Slider } from "react-native-elements";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/StackNavigator";
import { useTheme } from "../../contexts/ThemeContext";

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Scaling utility functions with a cap to prevent oversized elements
const scale = (size: number) => {
  const scaled = (SCREEN_WIDTH / 375) * size;
  return Math.min(scaled, size * 1.2);
};
const verticalScale = (size: number) => {
  const scaled = (SCREEN_HEIGHT / 667) * size;
  return Math.min(scaled, size * 1.2);
};
const moderateScale = (size: number, factor = 0.5) => {
  const scaled = size + (scale(size) - size) * factor;
  return Math.min(scaled, size * 1.2);
};

const MIN_BPM = 30;
const MAX_BPM = 300;
const SUB_TICK_VOLUME = 0.45; // subdivision ticks play quieter than main beats
const STORAGE_KEY = "@voicevault_metronome_settings_v1";

// Click sounds are 16-bit WAVs (no MP3 encoder delay), so attacks land exactly on the beat
const SOUND_SETS = {
  beep: {
    label: "Digital",
    click: require("../../../assets/metronome/beep.wav"),
    accent: require("../../../assets/metronome/beep_accent.wav"),
  },
  wood: {
    label: "Woodblock",
    click: require("../../../assets/metronome/wood.wav"),
    accent: require("../../../assets/metronome/wood_accent.wav"),
  },
  tick: {
    label: "Click",
    click: require("../../../assets/metronome/tick.wav"),
    accent: require("../../../assets/metronome/tick_accent.wav"),
  },
  soft: {
    label: "Soft",
    click: require("../../../assets/metronome/soft.wav"),
    accent: require("../../../assets/metronome/soft_accent.wav"),
  },
  bell: {
    label: "Bell",
    click: require("../../../assets/metronome/bell.wav"),
    accent: require("../../../assets/metronome/bell_accent.wav"),
  },
  cowbell: {
    label: "Cowbell",
    click: require("../../../assets/metronome/cowbell.wav"),
    accent: require("../../../assets/metronome/cowbell_accent.wav"),
  },
  clave: {
    label: "Clave",
    click: require("../../../assets/metronome/clave.wav"),
    accent: require("../../../assets/metronome/clave_accent.wav"),
  },
} as const;
type SoundSetKey = keyof typeof SOUND_SETS;

const TIME_SIGNATURES = ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "9/8", "12/8"] as const;
type TimeSignature = (typeof TIME_SIGNATURES)[number];

const SUBDIVISIONS = [
  { value: 1, symbol: "♩", label: "Quarter" },
  { value: 2, symbol: "♫", label: "Eighth" },
  { value: 3, symbol: "♪3", label: "Triplet" },
  { value: 4, symbol: "♬", label: "16th" },
] as const;

type BeatState = "accent" | "normal" | "mute";

const beatsForSignature = (sig: TimeSignature) => parseInt(sig.split("/")[0], 10);

// Default accents: beat 1, plus every 3rd beat for compound meters (6/8, 9/8, 12/8)
const defaultPattern = (sig: TimeSignature): BeatState[] => {
  const [beats, noteValue] = sig.split("/").map(Number);
  const compound = noteValue === 8 && beats % 3 === 0;
  return Array.from({ length: beats }, (_, i) =>
    (compound ? i % 3 === 0 : i === 0) ? "accent" : "normal"
  );
};

const getTempoMarking = (bpm: number) => {
  if (bpm < 40) return "Grave";
  if (bpm < 60) return "Largo";
  if (bpm < 66) return "Larghetto";
  if (bpm < 76) return "Adagio";
  if (bpm < 108) return "Andante";
  if (bpm < 120) return "Moderato";
  if (bpm < 156) return "Allegro";
  if (bpm < 176) return "Vivace";
  if (bpm < 200) return "Presto";
  return "Prestissimo";
};

type LoadedSounds = {
  click?: Audio.Sound;
  accent?: Audio.Sound;
  sub?: Audio.Sound;
};

type MetronomeScreenProps = NativeStackScreenProps<RootStackParamList, "Metronome">;

export default function MetronomeScreen({ navigation }: MetronomeScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [bpm, setBpm] = useState(120);
  const [bpmInput, setBpmInput] = useState("120");
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>("4/4");
  const [subdivision, setSubdivision] = useState(1);
  const [soundSet, setSoundSet] = useState<SoundSetKey>("beep");
  const [volume, setVolume] = useState(1);
  const [pattern, setPattern] = useState<BeatState[]>(defaultPattern("4/4"));
  const [beatCount, setBeatCount] = useState(0);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const flashAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Timing engine state lives in refs so the scheduler always reads fresh values
  // without needing to be torn down and rebuilt mid-playback
  const soundsRef = useRef<LoadedSounds>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextTickTimeRef = useRef(0);
  const tickIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const bpmRef = useRef(bpm);
  const subdivisionRef = useRef(subdivision);
  const patternRef = useRef(pattern);
  const volumeRef = useRef(volume);
  const previewOnLoadRef = useRef(false);

  // Time / Division selectors keep the selected chip centered in view
  const timeScrollRef = useRef<ScrollView>(null);
  const subScrollRef = useRef<ScrollView>(null);
  const timeChipLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const subChipLayouts = useRef<Record<number, { x: number; width: number }>>({});
  const timeScrollWidthRef = useRef(0);
  const subScrollWidthRef = useRef(0);

  const centerSelectedChip = useCallback(
    (
      ref: React.RefObject<ScrollView | null>,
      layout: { x: number; width: number } | undefined,
      viewWidth: number,
      animated: boolean
    ) => {
      if (!layout || !viewWidth) return;
      ref.current?.scrollTo({
        x: Math.max(0, layout.x + layout.width / 2 - viewWidth / 2),
        animated,
      });
    },
    []
  );

  useEffect(() => {
    centerSelectedChip(
      timeScrollRef,
      timeChipLayouts.current[timeSignature],
      timeScrollWidthRef.current,
      true
    );
  }, [timeSignature, centerSelectedChip]);

  useEffect(() => {
    centerSelectedChip(
      subScrollRef,
      subChipLayouts.current[subdivision],
      subScrollWidthRef.current,
      true
    );
  }, [subdivision, centerSelectedChip]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  useEffect(() => {
    subdivisionRef.current = subdivision;
  }, [subdivision]);
  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  // Load persisted settings once on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (typeof saved.bpm === "number" && saved.bpm >= MIN_BPM && saved.bpm <= MAX_BPM) {
            setBpm(saved.bpm);
            setBpmInput(String(saved.bpm));
          }
          if (TIME_SIGNATURES.includes(saved.timeSignature)) {
            setTimeSignature(saved.timeSignature);
            const beats = beatsForSignature(saved.timeSignature);
            if (
              Array.isArray(saved.pattern) &&
              saved.pattern.length === beats &&
              saved.pattern.every((s: string) => ["accent", "normal", "mute"].includes(s))
            ) {
              setPattern(saved.pattern);
            } else {
              setPattern(defaultPattern(saved.timeSignature));
            }
          }
          if ([1, 2, 3, 4].includes(saved.subdivision)) setSubdivision(saved.subdivision);
          if (saved.soundSet in SOUND_SETS) setSoundSet(saved.soundSet);
          if (typeof saved.volume === "number" && saved.volume >= 0 && saved.volume <= 1) {
            setVolume(saved.volume);
          }
        }
      } catch (e) {
        console.error("Error loading metronome settings:", e);
      }
      setSettingsLoaded(true);
    })();
  }, []);

  // Persist settings whenever they change (after initial load)
  useEffect(() => {
    if (!settingsLoaded) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ bpm, timeSignature, subdivision, soundSet, volume, pattern })
    ).catch((e) => console.error("Error saving metronome settings:", e));
  }, [bpm, timeSignature, subdivision, soundSet, volume, pattern, settingsLoaded]);

  // Audio mode setup on mount, full cleanup on unmount
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch((e) => console.error("Error setting up audio mode:", e));

    return () => {
      isPlayingRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      const sounds = soundsRef.current;
      soundsRef.current = {};
      Object.values(sounds).forEach((s) => s?.unloadAsync().catch(() => {}));
    };
  }, []);

  // (Re)load click sounds whenever the sound set changes.
  // "sub" is a third instance of the click so subdivision ticks can play
  // quieter without touching the main click's volume.
  useEffect(() => {
    if (!settingsLoaded) return;
    let cancelled = false;

    (async () => {
      const old = soundsRef.current;
      soundsRef.current = {};
      Object.values(old).forEach((s) => s?.unloadAsync().catch(() => {}));

      try {
        const set = SOUND_SETS[soundSet];
        const click = new Audio.Sound();
        const accent = new Audio.Sound();
        const sub = new Audio.Sound();
        await click.loadAsync(set.click);
        await accent.loadAsync(set.accent);
        await sub.loadAsync(set.click);

        if (cancelled) {
          [click, accent, sub].forEach((s) => s.unloadAsync().catch(() => {}));
          return;
        }

        await click.setVolumeAsync(volumeRef.current);
        await accent.setVolumeAsync(volumeRef.current);
        await sub.setVolumeAsync(volumeRef.current * SUB_TICK_VOLUME);
        soundsRef.current = { click, accent, sub };

        // Preview the new sound when the user picked it (not on initial load)
        if (previewOnLoadRef.current && !isPlayingRef.current) {
          previewOnLoadRef.current = false;
          accent.replayAsync().catch(() => {});
        }
      } catch (e) {
        console.error("Error loading metronome sounds:", e);
        Alert.alert("Audio Error", "Failed to load metronome sounds.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [soundSet, settingsLoaded]);

  // Apply volume changes to the already-loaded sounds
  useEffect(() => {
    const clampedVolume = Math.max(0, Math.min(1, Math.round(volume * 20) / 20));
    volumeRef.current = clampedVolume;
    const { click, accent, sub } = soundsRef.current;
    click?.setVolumeAsync(clampedVolume).catch(() => {});
    accent?.setVolumeAsync(clampedVolume).catch(() => {});
    sub?.setVolumeAsync(clampedVolume * SUB_TICK_VOLUME).catch(() => {});
  }, [volume]);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            // Check if we can go back in the navigation stack
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              // If we can't go back, navigate to Search screen
              navigation.navigate("Search");
            }
          }}
          style={{ paddingLeft: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const animatePulse = useCallback(
    (isAccent: boolean) => {
      flashAnim.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flashAnim, {
            toValue: 1,
            duration: 60,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(flashAnim, {
            toValue: 0,
            duration: 140,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: isAccent ? 1.12 : 1.06,
            duration: 60,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 140,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    },
    [flashAnim, scaleAnim]
  );

  // Fire-and-forget playback: replayAsync restarts from 0 without the
  // stop/seek/play round-trips that made ticks land late
  const playTick = useCallback((kind: keyof LoadedSounds) => {
    soundsRef.current[kind]?.replayAsync().catch(() => {});
  }, []);

  // Drift-corrected scheduler: each timeout is set relative to when the tick
  // SHOULD land, so small timer errors never accumulate the way setInterval does
  const runTick = useCallback(() => {
    if (!isPlayingRef.current) return;

    const sub = subdivisionRef.current;
    const beats = patternRef.current.length;
    const i = tickIndexRef.current;
    const subIndex = i % sub;
    const beatIndex = Math.floor(i / sub) % beats;

    if (subIndex === 0) {
      const state = patternRef.current[beatIndex];
      if (state !== "mute") playTick(state === "accent" ? "accent" : "click");
      setBeatCount(beatIndex + 1);
      animatePulse(state === "accent");
    } else {
      playTick("sub");
    }

    tickIndexRef.current = i + 1;
    const interval = 60000 / bpmRef.current / subdivisionRef.current;
    nextTickTimeRef.current += interval;
    const delay = Math.max(0, nextTickTimeRef.current - Date.now());
    timerRef.current = setTimeout(runTick, delay);
  }, [animatePulse, playTick]);

  const toggleMetronome = () => {
    if (isPlaying) {
      isPlayingRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setIsPlaying(false);
      setBeatCount(0);
    } else {
      tickIndexRef.current = 0;
      nextTickTimeRef.current = Date.now();
      isPlayingRef.current = true;
      setIsPlaying(true);
      runTick();
    }
    setTapTimes([]);
  };

  // Reset tap times if the user stops tapping for 2 seconds
  useEffect(() => {
    if (tapTimes.length === 0) return;

    const lastTap = tapTimes[tapTimes.length - 1];
    const timeout = setTimeout(() => {
      const now = Date.now();
      if (now - lastTap > 2000) {
        setTapTimes([]);
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [tapTimes]);

  const applyBpm = (value: number) => {
    const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)));
    setBpm(clamped);
    setBpmInput(String(clamped));
  };

  const handleTapTempo = () => {
    const now = Date.now();
    setTapTimes((prev) => {
      const newTapTimes = [...prev, now].slice(-5);

      if (newTapTimes.length > 1) {
        const intervals = newTapTimes.slice(1).map((time, i) => time - newTapTimes[i]);
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const calculatedBpm = Math.round(60000 / avgInterval);
        applyBpm(calculatedBpm);
      }

      return newTapTimes;
    });

    if (!isPlaying) {
      // Flash the circle on tap for visual feedback
      flashAnim.setValue(0);
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 80,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 120,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleBpmInputSubmit = () => {
    const parsedBpm = parseInt(bpmInput, 10);
    if (isNaN(parsedBpm) || parsedBpm < MIN_BPM || parsedBpm > MAX_BPM) {
      Alert.alert("Invalid BPM", `Please enter a number between ${MIN_BPM} and ${MAX_BPM}.`, [
        { text: "OK", onPress: () => setBpmInput(bpm.toString()) },
      ]);
      return;
    }
    applyBpm(parsedBpm);
  };

  const handleTimeSignatureChange = (sig: TimeSignature) => {
    setTimeSignature(sig);
    setPattern(defaultPattern(sig));
    setBeatCount(0);
    tickIndexRef.current = 0;
  };

  const cycleBeatState = (index: number) => {
    setPattern((prev) => {
      const next = [...prev];
      const order: BeatState[] = ["normal", "accent", "mute"];
      next[index] = order[(order.indexOf(prev[index]) + 1) % order.length];
      return next;
    });
  };

  const handleSoundSetChange = (key: SoundSetKey) => {
    if (key === soundSet) return;
    previewOnLoadRef.current = true;
    setSoundSet(key);
  };

  const currentBeatIsAccent = pattern[beatCount - 1] === "accent";

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      bounces={true}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Text style={styles.title}>Metronome</Text>

        {/* Beat indicator — always doubles as tap tempo */}
        <TouchableOpacity
          onPress={handleTapTempo}
          activeOpacity={0.7}
          accessible={true}
          accessibilityLabel="Tap to set BPM"
          accessibilityHint="Tap repeatedly at your desired tempo"
        >
          <Animated.View
            style={[
              styles.beatIndicator,
              {
                transform: [{ scale: scaleAnim }],
                backgroundColor: isPlaying
                  ? currentBeatIsAccent
                    ? colors.primaryDark
                    : colors.green
                  : colors.primaryDark,
                shadowColor: isPlaying && !currentBeatIsAccent ? colors.green : colors.primaryDark,
                opacity: flashAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [isPlaying ? 0.55 : 0.9, 1],
                }),
              },
            ]}
          >
            {isPlaying ? (
              <Text style={styles.beatNumber}>{beatCount || 1}</Text>
            ) : (
              <>
                <Text style={styles.circleBpm}>{bpm}</Text>
                <Text style={styles.circleBpmLabel}>BPM</Text>
                <Text style={styles.circleTapHint}>tap tempo</Text>
              </>
            )}
          </Animated.View>
        </TouchableOpacity>

        <Text style={styles.tempoMarking}>
          {bpm} BPM · {getTempoMarking(bpm)}
        </Text>

        {/* Per-beat accent pattern */}
        <View style={styles.dotsRow}>
          {pattern.map((state, i) => {
            const isCurrent = isPlaying && beatCount === i + 1;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => cycleBeatState(i)}
                style={[
                  styles.beatDot,
                  state === "accent" && styles.beatDotAccent,
                  state === "mute" && styles.beatDotMute,
                  isCurrent && styles.beatDotCurrent,
                ]}
                accessible={true}
                accessibilityLabel={`Beat ${i + 1}: ${state}. Tap to change.`}
              >
                <Text
                  style={[
                    styles.beatDotText,
                    state === "mute" && styles.beatDotTextMute,
                  ]}
                >
                  {i + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.hint}>Tap a beat to accent (orange) or mute it</Text>

        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={toggleMetronome}
          accessible={true}
          accessibilityLabel={isPlaying ? "Stop Metronome" : "Start Metronome"}
        >
          <Ionicons name={isPlaying ? "pause" : "play"} size={moderateScale(24)} color="#fff" />
          <Text style={styles.playButtonText}>{isPlaying ? "Stop" : "Start"}</Text>
        </TouchableOpacity>

        {/* Tempo card */}
        <View style={styles.card}>
          <Text style={styles.label}>Tempo</Text>
          <Slider
            value={bpm}
            minimumValue={MIN_BPM}
            maximumValue={MAX_BPM}
            step={1}
            onValueChange={(v: number) => applyBpm(v)}
            allowTouchTrack
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primaryDark}
            thumbStyle={styles.sliderThumb}
            trackStyle={styles.sliderTrack}
          />
          <View style={styles.bpmContainer}>
            <TouchableOpacity
              onPress={() => applyBpm(bpm - 5)}
              style={styles.bpmStepButton}
              accessible={true}
              accessibilityLabel="Decrease BPM by 5"
            >
              <Text style={styles.bpmStepText}>-5</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => applyBpm(bpm - 1)}
              style={styles.bpmButton}
              accessible={true}
              accessibilityLabel="Decrease BPM"
            >
              <Ionicons name="remove-circle-outline" size={moderateScale(30)} color={colors.primaryDark} />
            </TouchableOpacity>
            <TextInput
              style={styles.bpmInput}
              value={bpmInput}
              onChangeText={setBpmInput}
              onBlur={handleBpmInputSubmit}
              onSubmitEditing={handleBpmInputSubmit}
              keyboardType="numeric"
              returnKeyType="done"
              placeholder="BPM"
              placeholderTextColor={colors.textPlaceholder}
              accessible={true}
              accessibilityLabel="BPM Input"
              accessibilityHint={`Enter a BPM value between ${MIN_BPM} and ${MAX_BPM}`}
            />
            <TouchableOpacity
              onPress={() => applyBpm(bpm + 1)}
              style={styles.bpmButton}
              accessible={true}
              accessibilityLabel="Increase BPM"
            >
              <Ionicons name="add-circle-outline" size={moderateScale(30)} color={colors.primaryDark} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => applyBpm(bpm + 5)}
              style={styles.bpmStepButton}
              accessible={true}
              accessibilityLabel="Increase BPM by 5"
            >
              <Text style={styles.bpmStepText}>+5</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Time Signature & Subdivision Side-by-Side */}
        <View style={styles.selectorContainer}>
          {/* Time Signature (Left) */}
          <View style={styles.selectorColumn}>
            <Text style={styles.selectorLabel}>Time</Text>
            <ScrollView
              ref={timeScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.selectorScroll}
              contentContainerStyle={styles.selectorContent}
              onLayout={(e) => {
                timeScrollWidthRef.current = e.nativeEvent.layout.width;
              }}
            >
              {TIME_SIGNATURES.map((sig) => (
                <TouchableOpacity
                  key={sig}
                  onPress={() => handleTimeSignatureChange(sig)}
                  onLayout={(e) => {
                    timeChipLayouts.current[sig] = e.nativeEvent.layout;
                    if (sig === timeSignature) {
                      centerSelectedChip(
                        timeScrollRef,
                        e.nativeEvent.layout,
                        timeScrollWidthRef.current,
                        false
                      );
                    }
                  }}
                  style={[
                    styles.selectorChip,
                    timeSignature === sig && styles.selectorChipSelected,
                  ]}
                  accessible={true}
                  accessibilityLabel={`Time signature ${sig}`}
                  accessibilityState={{ selected: timeSignature === sig }}
                >
                  <Text
                    style={[
                      styles.selectorChipText,
                      timeSignature === sig && styles.selectorChipTextSelected,
                    ]}
                  >
                    {sig}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Subdivision (Right) */}
          <View style={styles.selectorColumn}>
            <Text style={styles.selectorLabel}>Division</Text>
            <ScrollView
              ref={subScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.selectorScroll}
              contentContainerStyle={styles.selectorContent}
              onLayout={(e) => {
                subScrollWidthRef.current = e.nativeEvent.layout.width;
              }}
            >
              {SUBDIVISIONS.map((sub) => (
                <TouchableOpacity
                  key={sub.value}
                  onPress={() => setSubdivision(sub.value)}
                  onLayout={(e) => {
                    subChipLayouts.current[sub.value] = e.nativeEvent.layout;
                    if (sub.value === subdivision) {
                      centerSelectedChip(
                        subScrollRef,
                        e.nativeEvent.layout,
                        subScrollWidthRef.current,
                        false
                      );
                    }
                  }}
                  style={[
                    styles.selectorChip,
                    subdivision === sub.value && styles.selectorChipSelected,
                  ]}
                  accessible={true}
                  accessibilityLabel={`Subdivision: ${sub.label}`}
                  accessibilityState={{ selected: subdivision === sub.value }}
                >
                  <Text
                    style={[
                      styles.selectorChipSymbol,
                      subdivision === sub.value && styles.selectorChipTextSelected,
                    ]}
                  >
                    {sub.symbol}
                  </Text>
                  <Text
                    style={[
                      styles.selectorChipSubLabel,
                      subdivision === sub.value && styles.selectorChipTextSelected,
                    ]}
                  >
                    {sub.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Sound card */}
        <View style={styles.card}>
          <Text style={styles.label}>Sound</Text>
          <View style={styles.chipRow}>
            {(Object.keys(SOUND_SETS) as SoundSetKey[]).map((key) => (
              <TouchableOpacity
                key={key}
                onPress={() => handleSoundSetChange(key)}
                style={[styles.chip, soundSet === key && styles.chipSelected]}
                accessible={true}
                accessibilityLabel={`Sound: ${SOUND_SETS[key].label}`}
                accessibilityState={{ selected: soundSet === key }}
              >
                <Text style={[styles.chipText, soundSet === key && styles.chipTextSelected]}>
                  {SOUND_SETS[key].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.volumeRow}>
            <Ionicons name="volume-low" size={moderateScale(20)} color={colors.textSecondary} />
            <View style={styles.volumeSliderWrapper}>
              {/* Slider runs on integers (0-100): fractional values crash Fabric's
                  int prop conversion ("Loss of precision" render error) */}
              <Slider
                value={Math.round(volume * 100)}
                minimumValue={0}
                maximumValue={100}
                step={5}
                onValueChange={(v: number) => setVolume(Math.max(0, Math.min(100, Math.round(v))) / 100)}
                allowTouchTrack
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primaryDark}
                thumbStyle={styles.sliderThumb}
                trackStyle={styles.sliderTrack}
              />
            </View>
            <Ionicons name="volume-high" size={moderateScale(20)} color={colors.textSecondary} />
            <Text style={styles.volumeText}>{Math.round(Math.max(0, Math.min(1, volume)) * 100)}%</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: typeof import("../../styles/theme").LightColors) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: "center",
      paddingVertical: verticalScale(20),
    },
    container: {
      width: "100%",
      alignItems: "center",
      paddingHorizontal: "5%",
      paddingVertical: "3%",
    },
    title: {
      fontSize: moderateScale(24),
      fontWeight: "bold",
      color: colors.primary,
      marginBottom: verticalScale(16),
    },
    beatIndicator: {
      width: SCREEN_WIDTH * 0.32,
      height: SCREEN_WIDTH * 0.32,
      borderRadius: SCREEN_WIDTH * 0.16,
      marginBottom: verticalScale(12),
      shadowOffset: { width: 0, height: moderateScale(2) },
      shadowOpacity: 0.5,
      shadowRadius: moderateScale(6),
      elevation: 5,
      justifyContent: "center",
      alignItems: "center",
    },
    beatNumber: {
      fontSize: moderateScale(44),
      fontWeight: "bold",
      color: colors.buttonText,
    },
    circleBpm: {
      fontSize: moderateScale(32),
      fontWeight: "bold",
      color: colors.buttonText,
    },
    circleBpmLabel: {
      fontSize: moderateScale(12),
      fontWeight: "600",
      color: colors.buttonText,
      opacity: 0.9,
    },
    circleTapHint: {
      fontSize: moderateScale(10),
      color: colors.buttonText,
      opacity: 0.8,
      marginTop: verticalScale(2),
    },
    tempoMarking: {
      fontSize: moderateScale(15),
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: verticalScale(12),
    },
    dotsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: verticalScale(6),
      paddingHorizontal: scale(10),
    },
    beatDot: {
      width: moderateScale(32),
      height: moderateScale(32),
      borderRadius: moderateScale(16),
      backgroundColor: colors.lightGray,
      borderWidth: 2,
      borderColor: "transparent",
      justifyContent: "center",
      alignItems: "center",
      margin: moderateScale(4),
    },
    beatDotAccent: {
      backgroundColor: colors.primaryDark,
    },
    beatDotMute: {
      backgroundColor: "transparent",
      borderColor: colors.border,
    },
    beatDotCurrent: {
      borderColor: colors.green,
    },
    beatDotText: {
      fontSize: moderateScale(13),
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    beatDotTextMute: {
      color: colors.textPlaceholder,
    },
    hint: {
      fontSize: moderateScale(11),
      color: colors.textTertiary,
      marginBottom: verticalScale(14),
      textAlign: "center",
    },
    card: {
      width: "100%",
      backgroundColor: colors.backgroundCard,
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingVertical: verticalScale(12),
      paddingHorizontal: scale(14),
      marginBottom: verticalScale(14),
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 1,
    },
    label: {
      fontSize: moderateScale(14),
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: verticalScale(8),
    },
    bpmContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    bpmButton: {
      padding: moderateScale(6),
      justifyContent: "center",
    },
    bpmStepButton: {
      paddingVertical: moderateScale(6),
      paddingHorizontal: moderateScale(10),
      borderRadius: moderateScale(8),
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      marginHorizontal: scale(4),
    },
    bpmStepText: {
      fontSize: moderateScale(14),
      fontWeight: "bold",
      color: colors.primaryDark,
    },
    bpmInput: {
      fontSize: moderateScale(20),
      fontWeight: "bold",
      color: colors.textPrimary,
      textAlign: "center",
      width: SCREEN_WIDTH * 0.18,
      marginHorizontal: scale(8),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: moderateScale(6),
      backgroundColor: colors.inputBackground,
      paddingVertical: verticalScale(4),
      paddingHorizontal: scale(5),
      textAlignVertical: "center",
    },
    sliderThumb: {
      width: moderateScale(22),
      height: moderateScale(22),
    },
    sliderTrack: {
      height: moderateScale(4),
      borderRadius: moderateScale(2),
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
    },
    selectorContainer: {
      width: "100%",
      flexDirection: "row",
      gap: scale(12),
      marginBottom: verticalScale(14),
    },
    selectorColumn: {
      flex: 1,
      backgroundColor: colors.backgroundCard,
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingVertical: verticalScale(10),
      paddingHorizontal: 0,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 1,
    },
    selectorLabel: {
      fontSize: moderateScale(13),
      fontWeight: "600",
      color: colors.textSecondary,
      paddingHorizontal: scale(12),
      marginBottom: verticalScale(8),
      textAlign: "center",
    },
    selectorScroll: {
      maxHeight: verticalScale(62),
    },
    selectorContent: {
      alignItems: "center",
      paddingHorizontal: scale(10),
      paddingVertical: verticalScale(2),
    },
    selectorChip: {
      paddingVertical: verticalScale(6),
      paddingHorizontal: scale(12),
      marginHorizontal: scale(4),
      borderRadius: moderateScale(14),
      backgroundColor: colors.inputBackground,
      borderWidth: 1.5,
      borderColor: "transparent",
      minWidth: scale(54),
      minHeight: verticalScale(48),
      alignItems: "center",
      justifyContent: "center",
    },
    selectorChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    selectorChipText: {
      fontSize: moderateScale(14),
      fontWeight: "600",
      color: colors.textPrimary,
      textAlign: "center",
    },
    selectorChipSymbol: {
      fontSize: moderateScale(17),
      fontWeight: "600",
      color: colors.textPrimary,
      textAlign: "center",
    },
    selectorChipSubLabel: {
      fontSize: moderateScale(9.5),
      fontWeight: "600",
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: verticalScale(1),
    },
    selectorChipTextSelected: {
      color: colors.buttonText,
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: moderateScale(18),
      paddingVertical: verticalScale(7),
      paddingHorizontal: scale(14),
      margin: moderateScale(4),
      backgroundColor: colors.inputBackground,
      alignItems: "center",
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: moderateScale(14),
      fontWeight: "600",
      color: colors.textPrimary,
    },
    chipTextSelected: {
      color: colors.buttonText,
    },
    subdivisionChip: {
      minWidth: scale(64),
    },
    chipSymbol: {
      fontSize: moderateScale(17),
      fontWeight: "600",
      color: colors.textPrimary,
    },
    chipSubLabel: {
      fontSize: moderateScale(10),
      color: colors.textSecondary,
      marginTop: verticalScale(1),
    },
    volumeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: verticalScale(10),
      paddingHorizontal: scale(4),
    },
    volumeSliderWrapper: {
      flex: 1,
      marginHorizontal: scale(8),
    },
    volumeText: {
      fontSize: moderateScale(12),
      fontWeight: "600",
      color: colors.textSecondary,
      width: scale(38),
      textAlign: "right",
    },
    playButton: {
      flexDirection: "row",
      backgroundColor: colors.primary,
      paddingVertical: verticalScale(12),
      paddingHorizontal: scale(40),
      borderRadius: moderateScale(10),
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: moderateScale(2) },
      shadowOpacity: 0.3,
      shadowRadius: moderateScale(3),
      elevation: 3,
      marginBottom: verticalScale(18),
    },
    playButtonActive: {
      backgroundColor: colors.primaryDark,
    },
    playButtonText: {
      color: colors.buttonText,
      fontSize: moderateScale(16),
      fontWeight: "bold",
      marginLeft: scale(8),
    },
  });
