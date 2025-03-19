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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { Picker } from "@react-native-picker/picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/StackNavigator";

type MetronomeScreenProps = NativeStackScreenProps<RootStackParamList, "Metronome">;

export default function MetronomeScreen({ navigation }: MetronomeScreenProps) {
  const [bpm, setBpm] = useState(120);
  const [bpmInput, setBpmInput] = useState("120"); // For TextInput
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSignature, setTimeSignature] = useState("4/4");
  const [beatCount, setBeatCount] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [accentSound, setAccentSound] = useState<Audio.Sound | null>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current; // For beat indicator pulse

  // Request audio permissions on mount
  useEffect(() => {
    const setupAudio = async () => {
      try {
        // Request audio permissions
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== "granted") {
          console.error("Audio permissions not granted");
          Alert.alert(
            "Permission Denied",
            "Audio permissions are required to play metronome sounds. Please enable them in your device settings."
          );
          return;
        }

        // Set audio mode for consistent playback
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        // Load sounds
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
          // Fallback: Use the same sound for both if one fails
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

          // Play sound with error handling
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

          // Flash and scale animation for beat indicator
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

  const toggleMetronome = () => {
    setIsPlaying((prev) => !prev);
    setBeatCount(0);
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
    <View style={styles.container}>
      <Text style={styles.title}>Metronome</Text>
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
          <Ionicons name="remove-circle-outline" size={40} color="#ff6600" />
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
          <Ionicons name="add-circle-outline" size={40} color="#ff6600" />
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
          size={30}
          color="#fff"
        />
        <Text style={styles.playButtonText}>{isPlaying ? "Stop" : "Start"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ff6600",
    marginBottom: 40,
  },
  beatIndicator: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 40,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
  },
  beatText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 40,
  },
  bpmContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 50,
  },
  bpmButton: {
    padding: 10,
  },
  bpmInput: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    width: 100,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingVertical: 5,
  },
  pickerContainer: {
    alignItems: "center",
    marginBottom: 50,
  },
  label: {
    fontSize: 18,
    fontWeight: "600",
    color: "#555",
    marginBottom: 10,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  picker: {
    width: 160,
    height: Platform.OS === "ios" ? 200 : 30, // Adjusted height for iOS picker wheel
    color: "#333",
  },
  playButton: {
    flexDirection: "row",
    backgroundColor: "#ff6600",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  playButtonActive: {
    backgroundColor: "#cc6600",
  },
  playButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 12,
  },
});