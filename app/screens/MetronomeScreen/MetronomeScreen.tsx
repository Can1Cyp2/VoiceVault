// app/screens/MetronomeScreen/MetronomeScreen.tsx

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  Alert,
  TextInput,
  Dimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { Picker } from "@react-native-picker/picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/StackNavigator";

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

type MetronomeScreenProps = NativeStackScreenProps<RootStackParamList, "Metronome">;

export default function MetronomeScreen({ navigation }: MetronomeScreenProps) {
  const [bpm, setBpm] = useState(120);
  const [bpmInput, setBpmInput] = useState("120");
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSignature, setTimeSignature] = useState("4/4");
  const [beatCount, setBeatCount] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [accentSound, setAccentSound] = useState<Audio.Sound | null>(null);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Request audio permissions on mount
  useEffect(() => {
    const setupAudio = async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== "granted") {
          console.error("Audio permissions not granted");
          Alert.alert(
            "Permission Denied",
            "Audio permissions are required to play metronome sounds. Please enable them in your device settings."
          );
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        const clickSoundObj = new Audio.Sound();
        const accentSoundObj = new Audio.Sound();

        try {
          await clickSoundObj.loadAsync(require("../../../assets/click.mp3"));
          await accentSoundObj.loadAsync(require("../../../assets/accent.mp3"));
          setSound(clickSoundObj);
          setAccentSound(accentSoundObj);
        } catch (error) {
          console.error("Error loading sounds:", error);
          Alert.alert(
            "Audio Error",
            "Failed to load metronome sounds. Using fallback audio."
          );
          await clickSoundObj.loadAsync(require("../../../assets/click.mp3"));
          setSound(clickSoundObj);
          setAccentSound(clickSoundObj);
        }
      } catch (error) {
        console.error("Error setting up audio:", error);
        Alert.alert("Audio Setup Error", "An error occurred while setting up audio.");
      }
    };

    setupAudio();

    return () => {
      sound?.unloadAsync();
      accentSound?.unloadAsync();
    };
  }, []);

  const getBeatsPerMeasure = () => {
    switch (timeSignature) {
      case "3/4":
        return 3;
      case "6/8":
        return 6;
      case "4/4":
      default:
        return 4;
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      const intervalMs = (60 / bpm) * 1000;
      interval = setInterval(() => {
        setBeatCount((prev) => {
          const beatsPerMeasure = getBeatsPerMeasure();
          const newBeat = (prev % beatsPerMeasure) + 1;

          const playSound = async (soundObj: Audio.Sound | null) => {
            try {
              if (soundObj) {
                await soundObj.replayAsync();
              }
            } catch (error) {
              console.error("Error playing sound:", error);
            }
          };

          if (newBeat === 1) {
            playSound(accentSound);
          } else {
            playSound(sound);
          }

          Animated.parallel([
            Animated.sequence([
              Animated.timing(flashAnim, {
                toValue: 1,
                duration: 100,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
              Animated.timing(flashAnim, {
                toValue: 0,
                duration: 100,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(scaleAnim, {
                toValue: 1.1,
                duration: 100,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
            ]),
          ]).start();

          return newBeat;
        });
      }, intervalMs);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, bpm, timeSignature, sound, accentSound, flashAnim, scaleAnim]);

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

  const handleTapTempo = () => {
    const now = Date.now();
    setTapTimes((prev) => {
      const newTapTimes = [...prev, now].slice(-5);

      if (newTapTimes.length > 1) {
        const intervals = newTapTimes
          .slice(1)
          .map((time, i) => time - newTapTimes[i]);
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const calculatedBpm = Math.round(60000 / avgInterval);

        if (calculatedBpm > 240) {
          setTapTimes([]);
          Alert.alert(
            "BPM Too High",
            "The calculated BPM exceeds 240. Tap history reset. Start tapping again.",
            [{ text: "OK" }]
          );
          return [];
        }

        if (calculatedBpm >= 30 && calculatedBpm <= 240) {
          setBpm(calculatedBpm);
          setBpmInput(calculatedBpm.toString());
        }
      }

      return newTapTimes;
    });

    // Flash the circle on tap for visual feedback
    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const toggleMetronome = () => {
    setIsPlaying((prev) => !prev);
    setBeatCount(0);
    setTapTimes([]);
  };

  const adjustBpm = (delta: number) => {
    const newBpm = bpm + delta;
    if (newBpm < 30 || newBpm > 240) return;
    setBpm(newBpm);
    setBpmInput(newBpm.toString());
  };

  const handleBpmInputChange = (text: string) => {
    setBpmInput(text);
  };

  const handleBpmInputSubmit = () => {
    const parsedBpm = parseInt(bpmInput, 10);
    if (isNaN(parsedBpm) || parsedBpm < 30 || parsedBpm > 240) {
      Alert.alert(
        "Invalid BPM",
        "Please enter a number between 30 and 240.",
        [{ text: "OK", onPress: () => setBpmInput(bpm.toString()) }]
      );
      return;
    }
    setBpm(parsedBpm);
    setBpmInput(parsedBpm.toString());
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      bounces={true}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Metronome</Text>
        {isPlaying ? (
          <Animated.View
            style={[
              styles.beatIndicator,
              {
                opacity: flashAnim,
                transform: [{ scale: scaleAnim }],
                backgroundColor: beatCount === 1 ? "#ff6600" : "#32CD32",
                shadowColor: beatCount === 1 ? "#ff6600" : "#32CD32",
                shadowOpacity: flashAnim,
              },
            ]}
          />
        ) : (
          <TouchableOpacity
            style={styles.tapIndicator}
            onPress={handleTapTempo}
            accessible={true}
            accessibilityLabel="Tap to set BPM"
          >
            <Animated.View
              style={[
                styles.beatIndicator,
                {
                  backgroundColor: "#ff6600",
                  shadowColor: "#ff6600",
                  shadowOpacity: 0.5,
                  opacity: flashAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                },
              ]}
            >
              <Text style={styles.tapText}>Tap to BPM</Text>
            </Animated.View>
          </TouchableOpacity>
        )}
        <Text style={styles.beatText}>
          Beat: {beatCount || 1}/{getBeatsPerMeasure()}
        </Text>
        <View style={styles.bpmContainer}>
          <TouchableOpacity
            onPress={() => adjustBpm(-1)}
            style={styles.bpmButton}
            accessible={true}
            accessibilityLabel="Decrease BPM"
          >
            <Ionicons
              name="remove-circle-outline"
              size={moderateScale(30)}
              color="#ff6600"
            />
          </TouchableOpacity>
          <TextInput
            style={styles.bpmInput}
            value={bpmInput}
            onChangeText={handleBpmInputChange}
            onBlur={handleBpmInputSubmit}
            onSubmitEditing={handleBpmInputSubmit}
            keyboardType="numeric"
            returnKeyType="done"
            placeholder="BPM"
            placeholderTextColor="#888"
            accessible={true}
            accessibilityLabel="BPM Input"
            accessibilityHint="Enter a BPM value between 30 and 240"
          />
          <TouchableOpacity
            onPress={() => adjustBpm(1)}
            style={styles.bpmButton}
            accessible={true}
            accessibilityLabel="Increase BPM"
          >
            <Ionicons
              name="add-circle-outline"
              size={moderateScale(30)}
              color="#ff6600"
            />
          </TouchableOpacity>
        </View>
        <View style={styles.pickerContainer}>
          <Text style={styles.label}>Time Signature:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={timeSignature}
              style={styles.picker}
              onValueChange={(itemValue) => {
                setTimeSignature(itemValue);
                setBeatCount(0);
              }}
              itemStyle={styles.pickerItem} // Add itemStyle to control Picker.Item text
              accessible={true}
              accessibilityLabel="Time Signature Picker"
            >
              <Picker.Item label="4/4" value="4/4" />
              <Picker.Item label="3/4" value="3/4" />
              <Picker.Item label="6/8" value="6/8" />
            </Picker>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={toggleMetronome}
          accessible={true}
          accessibilityLabel={isPlaying ? "Stop Metronome" : "Start Metronome"}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={moderateScale(24)}
            color="#fff"
          />
          <Text style={styles.playButtonText}>{isPlaying ? "Stop" : "Start"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: verticalScale(20),
  },
  container: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: "5%",
    paddingVertical: "3%",
  },
  title: {
    fontSize: moderateScale(24),
    fontWeight: "bold",
    color: "#ff6600",
    marginBottom: verticalScale(20),
  },
  beatIndicator: {
    width: SCREEN_WIDTH * 0.3,
    height: SCREEN_WIDTH * 0.3,
    borderRadius: SCREEN_WIDTH * 0.15,
    marginBottom: verticalScale(20),
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowRadius: moderateScale(4),
    elevation: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  tapIndicator: {
    width: SCREEN_WIDTH * 0.3,
    height: SCREEN_WIDTH * 0.3,
    borderRadius: SCREEN_WIDTH * 0.15,
    marginBottom: verticalScale(20),
  },
  tapText: {
    fontSize: moderateScale(14),
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  beatText: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: "#333",
    marginBottom: verticalScale(20),
  },
  bpmContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(30),
    width: "70%",
  },
  bpmButton: {
    padding: moderateScale(8),
    justifyContent: "center",
  },
  bpmInput: {
    fontSize: moderateScale(20),
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    width: SCREEN_WIDTH * 0.2,
    marginHorizontal: SCREEN_WIDTH * 0.03,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: moderateScale(6),
    backgroundColor: "#fff",
    paddingVertical: verticalScale(3),
    paddingHorizontal: scale(5),
    textAlignVertical: "center",
  },
  pickerContainer: {
    alignItems: "center",
    marginBottom: verticalScale(30),
    width: "50%",
  },
  label: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: "#555",
    marginBottom: verticalScale(8),
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: moderateScale(6),
    backgroundColor: "#fff",
    overflow: "hidden",
    width: "100%",
  },
  picker: {
    width: "100%",
    height: Platform.OS === "ios" ? verticalScale(50) : verticalScale(50), // Increased height to prevent clipping
    color: "#333",
  },
  pickerItem: {
    fontSize: Math.round(moderateScale(16)),
    height: Platform.OS === "ios" ? Math.round(verticalScale(50)) : undefined,
    textAlign: "center",
  },
  playButton: {
    flexDirection: "row",
    backgroundColor: "#ff6600",
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(20),
    borderRadius: moderateScale(8),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(3),
    elevation: 3,
  },
  playButtonActive: {
    backgroundColor: "#cc6600",
  },
  playButtonText: {
    color: "#fff",
    fontSize: moderateScale(14),
    fontWeight: "bold",
    marginLeft: scale(8),
  },
});