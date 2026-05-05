// app/screens/SongDetailsScreen/SongDetailsScreen.tsx

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  FlatList,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  Dimensions,
} from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "../../styles/theme";
import { useTheme } from "../../contexts/ThemeContext";

import {
  fetchUserLists,
  saveNewList,
} from "../SavedListsScreen/SavedListsLogic";
import { saveToList } from "../SavedListsScreen/SavedSongLogic";
import { supabase } from "../../util/supabase";
import { findClosestVocalRangeFit, noteToValue } from "./RangeBestFit";
import SongRangeRecommendation from "./SongRangeRecommendation";
import Piano from '../../components/Piano/Piano';
import { getPianoAudioFile } from "../../util/pianoNotes";
import {
  startPitchDetection,
  requestMicrophonePermission,
  frequencyToNote,
} from "../../util/pitchDetection";

const { width } = Dimensions.get('window');
const SING_HOLD_DURATION_MS = 4000;
const SING_MAX_RECORD_MS = 7000;

type SingModalView = "intro" | "note" | "complete";

type SingNoteStatus = "pending" | "recording" | "passed" | "failed";

type SingTestStepResult = {
  target: string;
  status: SingNoteStatus;
  heldMs: number;
};

// SongDetailsScreen component:
// Displays details of a song, including vocal range and options to save it to a list.
export const SongDetailsScreen = ({ route, navigation }: any) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { name, artist, vocalRange } = route.params;

  const { male, female, maleOutOfRange, femaleOutOfRange } =
    findClosestVocalRangeFit(vocalRange);

  const [isModalVisible, setModalVisible] = useState(false);
  const [customListName, setCustomListName] = useState("");
  const [existingLists, setExistingLists] = useState<any[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isIssueModalVisible, setIssueModalVisible] = useState(false);
  const [issueText, setIssueText] = useState("");
  const referenceSoundRef = useRef<Audio.Sound | null>(null);
  const [isSingModalVisible, setSingModalVisible] = useState(false);
  const [singView, setSingView] = useState<SingModalView>("intro");
  const [singStepIndex, setSingStepIndex] = useState(0);
  const [singStepResults, setSingStepResults] = useState<SingTestStepResult[]>([]);
  const [singLiveNote, setSingLiveNote] = useState<string | null>(null);
  const [singHeldMs, setSingHeldMs] = useState(0);
  const [singIsListening, setSingIsListening] = useState(false);
  const singDetectionStopRef = useRef<(() => void) | null>(null);
  const singRecordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singHoldMsRef = useRef(0);
  const singMatchStartRef = useRef<number | null>(null);
  const singIsListeningRef = useRef(false);

  // Parse vocal range to extract lowest and highest notes
  const parseVocalRange = (range: string) => {
    if (!range) return { lowest: '', highest: '', octaveRange: '' };

    const parts = range.split(/ - | – /);
    if (parts.length === 2) {
      const lowest = parts[0].trim();
      const highest = parts[1].trim();
      
      const lowValue = noteToValue(lowest);
      const highValue = noteToValue(highest);

      if (!isNaN(lowValue) && !isNaN(highValue)) {
        const octaveDiff = Math.floor(Math.abs(highValue - lowValue) / 12);
        const noteDiff = Math.abs(highValue - lowValue) % 12;
        const octaveRange = `${octaveDiff} octave${octaveDiff !== 1 ? 's' : ''}, ${noteDiff} note${noteDiff !== 1 ? 's' : ''}`;
        return { lowest, highest, octaveRange };
      }

      return { lowest, highest, octaveRange: "Invalid range" };
    }
    return { lowest: range, highest: range, octaveRange: "1,0" };
  };

  const { lowest, highest, octaveRange } = parseVocalRange(vocalRange);
  const singTargets = useMemo(() => {
    try {
      if (!lowest || !highest) {
        return [] as string[];
      }

      noteToValue(lowest);
      noteToValue(highest);

      return lowest === highest ? [lowest] : [lowest, highest];
    } catch {
      return [] as string[];
    }
  }, [lowest, highest]);
  const currentSingTarget = singTargets[singStepIndex] || "";
  const currentStepStatus = singStepResults[singStepIndex]?.status ?? "pending";
  const hasNextSingTarget = singStepIndex + 1 < singTargets.length;
  const allSingTargetsPassed = useMemo(() => {
    if (singTargets.length === 0) return false;
    return singTargets.every(
      (_target, index) => singStepResults[index]?.status === "passed"
    );
  }, [singTargets, singStepResults]);
  const successfulSingRange = useMemo(() => {
    const passedNotes = singStepResults
      .filter((step) => step.status === "passed")
      .map((step) => step.target);

    if (passedNotes.length === 0) return null;

    try {
      const sorted = [...passedNotes].sort(
        (a, b) => noteToValue(a) - noteToValue(b)
      );
      return `${sorted[0]} - ${sorted[sorted.length - 1]}`;
    } catch {
      return passedNotes.length === 1 ? passedNotes[0] : passedNotes.join(" - ");
    }
  }, [singStepResults]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    return () => {
      if (referenceSoundRef.current) {
        referenceSoundRef.current.unloadAsync().catch(() => {});
        referenceSoundRef.current = null;
      }
    };
  }, []);

  const stopSingSession = useCallback((resetHold: boolean = true) => {
    if (singRecordTimeoutRef.current) {
      clearTimeout(singRecordTimeoutRef.current);
      singRecordTimeoutRef.current = null;
    }

    if (singDetectionStopRef.current) {
      singDetectionStopRef.current();
      singDetectionStopRef.current = null;
    }

    singIsListeningRef.current = false;
    setSingIsListening(false);

    if (resetHold) {
      singHoldMsRef.current = 0;
      singMatchStartRef.current = null;
      setSingHeldMs(0);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopSingSession();
    };
  }, [stopSingSession]);

  const playReferenceNote = async (note: string) => {
    if (!note) return;

    const audioFile = getPianoAudioFile(note);
    if (!audioFile) {
      Alert.alert("Note unavailable", `No audio sample found for ${note}.`);
      return;
    }

    try {
      if (referenceSoundRef.current) {
        await referenceSoundRef.current.stopAsync().catch(() => {});
        await referenceSoundRef.current.unloadAsync().catch(() => {});
        referenceSoundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(audioFile, {
        shouldPlay: true,
        volume: 1,
      });

      referenceSoundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          if (referenceSoundRef.current === sound) {
            referenceSoundRef.current = null;
          }
        }
      });
    } catch (error) {
      console.error("Error playing reference note:", error);
      Alert.alert("Playback Error", "Could not play this note right now.");
    }
  };

  const updateCurrentStep = useCallback(
    (status: SingNoteStatus, heldMs: number) => {
      if (!currentSingTarget) return;

      setSingStepResults((prev) => {
        const next = [...prev];
        next[singStepIndex] = {
          target: currentSingTarget,
          status,
          heldMs,
        };
        return next;
      });
    },
    [currentSingTarget, singStepIndex]
  );

  const finalizeRecording = useCallback(
    (status: SingNoteStatus) => {
      if (!singIsListeningRef.current) return;

      const finalHeldMs = singHoldMsRef.current;
      stopSingSession(false);
      singMatchStartRef.current = null;
      setSingIsListening(false);
      setSingHeldMs(finalHeldMs);
      updateCurrentStep(status, finalHeldMs);
    },
    [stopSingSession, updateCurrentStep]
  );

  const startSingRecording = useCallback(async () => {
    if (!currentSingTarget) return;

    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      Alert.alert(
        "Microphone Permission Required",
        "VoiceVault needs microphone access to record your note."
      );
      return;
    }

    stopSingSession();
    setSingLiveNote(null);
    setSingHeldMs(0);
    singHoldMsRef.current = 0;
    singMatchStartRef.current = null;
    setSingIsListening(true);
    singIsListeningRef.current = true;
    updateCurrentStep("recording", 0);

    try {
      singDetectionStopRef.current = startPitchDetection(
        (result) => {
          if (!singIsListeningRef.current) return;

          const noteData = frequencyToNote(result.frequency);
          if (!noteData) {
            return;
          }

          const detectedNote = `${noteData.note}${noteData.octave}`;
          setSingLiveNote(detectedNote);

          if (detectedNote === currentSingTarget) {
            if (!singMatchStartRef.current) {
              singMatchStartRef.current = Date.now();
            }

            const heldMs = Date.now() - singMatchStartRef.current;
            singHoldMsRef.current = heldMs;
            setSingHeldMs(heldMs);

            if (heldMs >= SING_HOLD_DURATION_MS) {
              finalizeRecording("passed");
            }
          } else {
            singMatchStartRef.current = null;
            if (singHoldMsRef.current !== 0) {
              singHoldMsRef.current = 0;
              setSingHeldMs(0);
            }
          }
        },
        (error) => {
          console.error("Sing test pitch detection error:", error);
          Alert.alert("Sing Test Error", "Could not start the microphone check right now.");
          stopSingSession();
          setSingIsListening(false);
        },
        false
      );
    } catch (error) {
      console.error("Failed to start sing recording:", error);
      Alert.alert("Sing Test Error", "Could not start the microphone check right now.");
      stopSingSession();
      setSingIsListening(false);
      return;
    }

    singRecordTimeoutRef.current = setTimeout(() => {
      finalizeRecording("failed");
    }, SING_MAX_RECORD_MS);
  }, [currentSingTarget, finalizeRecording, stopSingSession, updateCurrentStep]);

  const handleConfirmSingReady = useCallback(() => {
    if (!singTargets.length) {
      Alert.alert(
        "Sing This!",
        "This song does not have a valid vocal range to test right now."
      );
      return;
    }

    const steps = singTargets.map((target) => ({
      target,
      status: "pending" as SingNoteStatus,
      heldMs: 0,
    }));

    stopSingSession();
    setSingStepResults(steps);
    setSingStepIndex(0);
    setSingLiveNote(null);
    setSingHeldMs(0);
    setSingView("note");
  }, [singTargets, stopSingSession]);

  const handleRetrySingNote = useCallback(() => {
    stopSingSession();
    setSingLiveNote(null);
    setSingHeldMs(0);
    updateCurrentStep("pending", 0);
  }, [stopSingSession, updateCurrentStep]);

  const handleNextSingNote = useCallback(() => {
    if (!hasNextSingTarget) return;

    stopSingSession();
    const nextIndex = singStepIndex + 1;
    setSingStepIndex(nextIndex);
    setSingLiveNote(null);
    setSingHeldMs(0);
    setSingIsListening(false);

    setSingStepResults((prev) => {
      const next = [...prev];
      if (next[nextIndex]) {
        next[nextIndex] = {
          ...next[nextIndex],
          status: "pending",
          heldMs: 0,
        };
      }
      return next;
    });
  }, [hasNextSingTarget, singStepIndex, stopSingSession]);

  const handleFinishSingTest = useCallback(() => {
    stopSingSession();
    setSingView("complete");
  }, [stopSingSession]);

  const handleOpenSingModal = useCallback(() => {
    setSingModalVisible(true);
    setSingView("intro");
    setSingStepIndex(0);
    setSingStepResults([]);
    setSingLiveNote(null);
    setSingHeldMs(0);
    stopSingSession();
  }, [stopSingSession]);

  const handleCloseSingModal = useCallback(() => {
    stopSingSession();
    setSingModalVisible(false);
    setSingView("intro");
    setSingStepIndex(0);
    setSingStepResults([]);
    setSingLiveNote(null);
    setSingHeldMs(0);
  }, [stopSingSession]);

  // Check if the user is logged in and set header options
  useEffect(() => {
    const checkLoginStatus = async () => {
      const session = supabase.auth.session();
      setIsLoggedIn(!!session);

      supabase.auth.onAuthStateChange(
        (_event: string, session: { user: any } | null) => {
          setIsLoggedIn(!!session);
        }
      );
    };

    checkLoginStatus();
  }, []);

  // Dynamically update the header button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isLoggedIn ? (
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Ionicons
              name="add-circle-outline"
              size={30}
              color={COLORS.primary}
              style={{ marginRight: 15 }}
            />
          </TouchableOpacity>
        ) : null,
    });
  }, [isLoggedIn, navigation]);

  // Fetch the user's existing lists when the modal is opened
  useEffect(() => {
    const loadLists = async () => {
      const lists = await fetchUserLists();
      setExistingLists(lists || []);
    };

    if (isModalVisible) {
      loadLists();
    }
  }, [isModalVisible]);

  // Check if the modal should open based on route params:
  useEffect(() => {
    if (route.params?.showAddToListModal) {
      setModalVisible(true);
      navigation.setParams({ showAddToListModal: false });
    }
  }, [route.params?.showAddToListModal]);

  // Helper function to get out-of-range message
  const getOutOfRangeMessage = (outOfRange: string | null) => {
    if (outOfRange === "lower") {
      return "(This song is lower than the typical range for this category, it may be very difficult to sing. Consider transposing.)";
    }
    if (outOfRange === "higher") {
      return "(This song is higher than the typical range for this category. Consider transposing.)";
    }
    return null;
  };

  // Function to handle saving to a custom list
  const handleSaveToCustomList = async () => {
    if (customListName.trim() === "") {
      Alert.alert("Error", "Please enter a list name.");
      return;
    }

    try {
      await saveNewList(customListName);
      await saveToList(name, artist, vocalRange, customListName);
      setCustomListName("");
      setModalVisible(false);
      const updatedLists = await fetchUserLists();
      setExistingLists(updatedLists || []);
      Alert.alert("Success", `Added "${name}" to "${customListName}"`);
    } catch (error) {
      console.error("Error saving to custom list:", error);
      Alert.alert("Error", "Could not save the song to the new list.");
    }
  };

  const handleSaveToExistingList = async (listName: string) => {
    await saveToList(name, artist, vocalRange, listName);
    setModalVisible(false);
  };

  // Function to handle artist, sends user to artist page
  const handleArtistPress = () => {
    navigation.navigate("ArtistDetails", {
      name: artist,
    });
  };

  // Submit the issue report to Supabase
  const handleSubmitIssue = async () => {
    if (!issueText.trim()) {
      Alert.alert("Error", "Please enter an issue description.");
      return;
    }

    try {
      const session = supabase.auth.session();
      if (!session) {
        Alert.alert(
          "Sign In Required",
          "You must be signed in to report an issue."
        );
        return;
      }

      const user = supabase.auth.user();

      if (!user) {
        Alert.alert(
          "Sign In Required",
          "You must be signed in to report an issue."
        );
        return;
      }

      let username = user.user_metadata?.display_name;

      if (!username || username.trim() === "") {
        Alert.alert(
          "Set Username",
          "Your username is missing. Please go to profile settings and set a display name."
        );
        return;
      }

      const issuePayload = {
        song_id: route.params.song_id || null,
        song_name: name,
        vocal_range: vocalRange,
        user_id: user.id,
        username: username,
        user_email: user.email || "No email",
        issue_text: issueText,
        status: "pending",
      };

      const { error } = await supabase.from("issues").insert([issuePayload]);

      if (error) {
        console.error("Supabase Insert Error:", error);
        Alert.alert("Error", `Failed to submit issue: ${error.message}`);
        return;
      }

      Alert.alert("Success", "Issue reported successfully.");
      setIssueText("");
      setIssueModalVisible(false);
    } catch (error) {
      console.error("Unexpected Error submitting issue:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Album Art Placeholder */}
      <View style={styles.albumArtContainer}>
        <View style={styles.albumArt}>
          <Text style={styles.albumArtText}>🎵</Text>
          <Text style={styles.albumTitle}>{name}</Text>
          <Text style={styles.albumArtist}>{artist?.toUpperCase() || 'UNKNOWN'}</Text>
        </View>
      </View>

      {/* Song Title */}
      <Text style={styles.songTitle}>{name}</Text>
      
      {/* Artist Name */}
      {artist && (
        <TouchableOpacity onPress={handleArtistPress}>
          <Text style={styles.artistName}>{artist}</Text>
        </TouchableOpacity>
      )}

      {/* Status Badge */}
      <View style={styles.statusBadge}>
        {route.params.username ? (
          <Text style={styles.statusText}>Uploaded by: {route.params.username}</Text>
        ) : (
          <Text style={styles.statusTextVerified}>✅ Verified Vocal Range</Text>
        )}
      </View>

      {/* Vocal Range Header */}
      {vocalRange && (
        <>
          <View style={styles.vocalRangeHeader}>
            <Text style={styles.vocalRangeIcon}>🎤</Text>
            <Text style={styles.vocalRangeTitle}>Vocal Range: {vocalRange}</Text>
          </View>

          <Piano vocalRange={vocalRange} />

          {/* Range Details */}
          <View style={styles.rangeDetails}>
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Lowest Note:</Text>
              <View style={styles.rangeValueWithAudio}>
                <Text style={styles.rangeValue}>{lowest}</Text>
                <TouchableOpacity
                  style={styles.noteAudioButton}
                  onPress={() => {
                    void playReferenceNote(lowest);
                  }}
                >
                  <Ionicons
                    name="volume-high-outline"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Highest Note:</Text>
              <View style={styles.rangeValueWithAudio}>
                <Text style={styles.rangeValue}>{highest}</Text>
                <TouchableOpacity
                  style={styles.noteAudioButton}
                  onPress={() => {
                    void playReferenceNote(highest);
                  }}
                >
                  <Ionicons
                    name="volume-high-outline"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Octave Range:</Text>
              <Text style={styles.rangeValue}>{octaveRange}</Text>
            </View>
          </View>

          {/* Best Fit Section */}
          <View style={styles.bestFitSection}>
            <Text style={styles.bestFitTitle}>Best Fit Analysis</Text>
            <View style={styles.bestFitCard}>
              <Text style={styles.bestFitLabel}>Male Voice:</Text>
              <Text style={styles.bestFitValue}>{male}</Text>
              {maleOutOfRange && (
                <Text style={styles.outOfRangeText}>
                  {getOutOfRangeMessage(maleOutOfRange)}
                </Text>
              )}
            </View>
            <View style={styles.bestFitCard}>
              <Text style={styles.bestFitLabel}>Female Voice:</Text>
              <Text style={styles.bestFitValue}>{female}</Text>
              {femaleOutOfRange && (
                <Text style={styles.outOfRangeText}>
                  {getOutOfRangeMessage(femaleOutOfRange)}
                </Text>
              )}
            </View>
          </View>
        </>
      )}

      {/* Personalized Recommendation Component */}
      <SongRangeRecommendation songVocalRange={vocalRange} isLoggedIn={isLoggedIn} />

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {/* <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>COMPARE RANGE</Text> // MIGHT ADD THIS LATER
        </TouchableOpacity> */}
        {isLoggedIn && (
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.primaryButtonText}>ADD TO LIST</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.singButton} onPress={handleOpenSingModal}>
          <Ionicons name="mic-outline" size={18} color={colors.buttonText} />
          <Text style={styles.singButtonText}>SING THIS!</Text>
        </TouchableOpacity>
      </View>

      {/* Share Button */}
      {/* <TouchableOpacity style={styles.shareButton}>
        <Text style={styles.shareButtonText}>SHARE</Text> // MIGHT ADD THIS LATER
      </TouchableOpacity> */}

      {/* Report Issue Button */}
      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => setIssueModalVisible(true)}
      >
        <Ionicons name="alert-circle-outline" size={24} color={COLORS.primary} />
        <Text style={styles.reportButtonText}>Report Issue</Text>
      </TouchableOpacity>

      {/* Modal for adding to list */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Add to List</Text>

                <TouchableOpacity
                  style={styles.listOptionAlwaysSaved}
                  onPress={() => handleSaveToExistingList("All Saved Songs")}
                >
                  <Text style={styles.listOptionTextAlwaysSaved}>
                    📌 All Saved Songs (Auto-added)
                  </Text>
                </TouchableOpacity>

                <FlatList
                  data={existingLists.filter(
                    (list) => list.name !== "All Saved Songs"
                  )}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listOption}
                      onPress={() => handleSaveToExistingList(item.name)}
                    >
                      <Text style={styles.listOptionText}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.noListText}>No saved lists found.</Text>
                  }
                  keyboardShouldPersistTaps="handled"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Custom List Name"
                  value={customListName}
                  onChangeText={setCustomListName}
                  placeholderTextColor={colors.textPlaceholder}
                />

                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleSaveToCustomList}
                >
                  <Text style={styles.modalButtonText}>Add to New List</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Issue Report Modal */}
      <Modal visible={isIssueModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Report an Issue</Text>
            <TextInput
              style={styles.issueInput}
              placeholder="Describe the issue... contact voicevaultcontact@gmail.com if this issue fails to send."
              value={issueText}
              onChangeText={setIssueText}
              multiline
              placeholderTextColor={colors.textPlaceholder}
            />
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={handleSubmitIssue}
            >
              <Text style={styles.modalButtonText}>Submit</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalCancelButton}
              onPress={() => setIssueModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isSingModalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCloseSingModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sing This!</Text>
            {singView === "intro" && (
              <>
                <Text style={styles.singDisclaimer}>
                  Matching these notes only suggests whether this range is comfortable.
                  It does not guarantee that you will sing the song well, and the listed
                  vocal range may be approximate or simplified.
                </Text>
                <Text style={styles.singInstructions}>
                  When you are ready, we will guide you through the lowest and highest notes.
                  You will record each note and hold it for 4 seconds.
                </Text>
                <TouchableOpacity style={styles.modalButton} onPress={handleConfirmSingReady}>
                  <Text style={styles.modalButtonText}>I am Ready</Text>
                </TouchableOpacity>
              </>
            )}

            {singView === "note" && currentSingTarget && (
              <>
                <Text style={styles.singStepLabel}>
                  Note {singStepIndex + 1} of {singTargets.length}
                </Text>
                <Text style={styles.singTargetText}>{currentSingTarget}</Text>
                <Text style={styles.singTargetHint}>
                  Hold for {SING_HOLD_DURATION_MS / 1000} seconds
                </Text>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    void playReferenceNote(currentSingTarget);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Play Reference Again</Text>
                </TouchableOpacity>

                {(currentStepStatus === "pending" || currentStepStatus === "failed") && (
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={startSingRecording}
                    disabled={singIsListening}
                  >
                    <Text style={styles.modalButtonText}>
                      {currentStepStatus === "failed" ? "Record Again" : "Record Note"}
                    </Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.singLiveText}>
                  Detected: {singLiveNote || (singIsListening ? "Listening..." : "Not listening")}
                </Text>
                <Text style={styles.singProgressText}>
                  Held: {Math.min(singHeldMs, SING_HOLD_DURATION_MS) / 1000}s / {SING_HOLD_DURATION_MS / 1000}s
                </Text>

                {currentStepStatus === "passed" && (
                  <View style={styles.singStatusRow}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.success || colors.primary} />
                    <Text style={styles.singStatusText}>Held successfully</Text>
                  </View>
                )}
                {currentStepStatus === "failed" && (
                  <View style={styles.singStatusRow}>
                    <Ionicons name="close-circle" size={22} color={colors.danger || colors.primary} />
                    <Text style={styles.singStatusText}>Not held for long enough</Text>
                  </View>
                )}

                {currentStepStatus === "failed" && (
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleRetrySingNote}>
                    <Text style={styles.secondaryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                )}

                {currentStepStatus === "passed" && hasNextSingTarget && (
                  <TouchableOpacity style={styles.modalButton} onPress={handleNextSingNote}>
                    <Text style={styles.modalButtonText}>Next Note</Text>
                  </TouchableOpacity>
                )}

                {currentStepStatus === "passed" && !hasNextSingTarget && (
                  <TouchableOpacity style={styles.modalButton} onPress={handleFinishSingTest}>
                    <Text style={styles.modalButtonText}>See Results</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {singView === "complete" && (
              <>
                <Text style={styles.singResultText}>Great work!</Text>
                <View style={styles.singResultCard}>
                  <Text style={styles.singResultCardTitle}>Successful range</Text>
                  <Text style={styles.singResultCardBody}>
                    {successfulSingRange || "No notes were held for 4 seconds yet."}
                  </Text>
                </View>
                <Text style={styles.singResultText}>
                  {allSingTargetsPassed
                    ? "You should be able to sing this song."
                    : "Try again if you want to confirm the full range."}
                </Text>
                <TouchableOpacity style={styles.modalButton} onPress={handleConfirmSingReady}>
                  <Text style={styles.modalButtonText}>Test Again</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.modalCancelButton} onPress={handleCloseSingModal}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  // Album Art
  albumArtContainer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 30,
  },
  albumArt: {
    width: 280,
    height: 280,
    backgroundColor: colors.backgroundCard,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  albumArtText: {
    fontSize: 60,
    marginBottom: 20,
  },
  albumTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    fontFamily: FONTS.primary,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  albumArtist: {
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: FONTS.primary,
    textAlign: 'center',
    letterSpacing: 2,
  },

  // Song Info
  songTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.textPrimary,
    fontFamily: FONTS.primary,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  artistName: {
    fontSize: 24,
    color: colors.textSecondary,
    fontFamily: FONTS.primary,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Status Badge
  statusBadge: {
    alignSelf: 'center',
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 30,
  },
  statusText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: FONTS.primary,
    fontWeight: 'bold',
  },
  statusTextVerified: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: FONTS.primary,
    fontWeight: 'bold',
  },

  // Vocal Range
  vocalRangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  vocalRangeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  vocalRangeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: FONTS.primary,
  },

  

  // Range Details
  rangeDetails: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  rangeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rangeLabel: {
    fontSize: 18,
    color: colors.textSecondary,
    fontFamily: FONTS.primary,
    flex: 1,
  },
  rangeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    fontFamily: FONTS.primary,
  },
  rangeValueWithAudio: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteAudioButton: {
    marginLeft: 8,
    padding: 4,
  },

  // Best Fit Section
  bestFitSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  bestFitTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    fontFamily: FONTS.primary,
    marginBottom: 15,
  },
  bestFitCard: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bestFitLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: FONTS.primary,
    marginBottom: 4,
  },
  bestFitValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    fontFamily: FONTS.primary,
  },
  outOfRangeText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontFamily: FONTS.primary,
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 15,
    marginBottom: 20,
    marginTop: 20, // Add this line
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.buttonText,
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: FONTS.primary,
    letterSpacing: 1,
  },
  singButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  singButtonText: {
    color: colors.buttonText,
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: FONTS.primary,
    letterSpacing: 1,
  },

  // Share Button
  shareButton: {
    marginHorizontal: 20,
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.textSecondary,
    marginBottom: 20,
  },
  shareButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: FONTS.primary,
    letterSpacing: 1,
  },

  // Report Button
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    paddingVertical: 12,
  },
  reportButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: FONTS.primary,
    marginLeft: 8,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: FONTS.primary,
  },
  listOptionAlwaysSaved: {
    backgroundColor: colors.secondary,
    padding: 14,
    borderRadius: 8,
    marginVertical: 4,
    alignItems: 'center',
  },
  listOptionTextAlwaysSaved: {
    fontSize: 16,
    color: colors.buttonText,
    fontWeight: 'bold',
    fontFamily: FONTS.primary,
  },
  listOption: {
    backgroundColor: colors.backgroundTertiary,
    padding: 14,
    borderRadius: 8,
    marginVertical: 4,
    alignItems: 'center',
  },
  listOptionText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: FONTS.primary,
  },
  noListText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: 20,
    fontFamily: FONTS.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
    fontSize: 16,
    fontFamily: FONTS.primary,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
  },
  modalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  modalButtonText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: FONTS.primary,
  },
  modalCancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontFamily: FONTS.primary,
  },
  issueInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    height: 120,
    textAlignVertical: 'top',
    marginVertical: 10,
    fontSize: 16,
    fontFamily: FONTS.primary,
  },
  singDisclaimer: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: FONTS.primary,
    lineHeight: 20,
    marginBottom: 14,
  },
  singInstructions: {
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: FONTS.primary,
    lineHeight: 21,
    marginBottom: 14,
  },
  singStepLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: FONTS.primary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  singTargetText: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: 'bold',
    fontFamily: FONTS.primary,
    marginBottom: 8,
  },
  singTargetHint: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: FONTS.primary,
    marginBottom: 12,
  },
  singLiveText: {
    fontSize: 15,
    color: colors.primary,
    fontFamily: FONTS.primary,
    marginBottom: 14,
  },
  singProgressText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: FONTS.primary,
    marginBottom: 12,
  },
  singStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  singStatusText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: FONTS.primary,
  },
  singResultText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: FONTS.primary,
    lineHeight: 22,
    marginBottom: 12,
  },
  singResultCard: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  singResultCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
    fontFamily: FONTS.primary,
    marginBottom: 4,
  },
  singResultCardBody: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: FONTS.primary,
    lineHeight: 19,
  },
  secondaryButton: {
    backgroundColor: colors.backgroundTertiary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONTS.primary,
  },
});