import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { FONTS } from "../../styles/theme";
import { useTheme } from "../../contexts/ThemeContext";
import { getPianoAudioFile } from "../../util/pianoNotes";
import { saveToList } from "../SavedListsScreen/SavedSongLogic";
import {
  frequencyToNote,
  requestMicrophonePermission,
  startPitchDetection,
} from "../../util/pitchDetection";
import {
  clampCents,
  describeOctaveShift,
  formatHeldSeconds,
  getCentsOffTarget,
  getOctaveMatch,
  getSingPitchFeedback,
  getTargetFrequency,
  getTransposedSummary,
  isCloseEnoughToCount,
  shiftNoteOctaves,
  SING_CLOSE_CENTS,
  SING_COUNTABLE_CENTS,
  SING_HOLD_DURATION_MS,
  SING_MAX_RECORD_MS,
  SING_PERFECT_CENTS,
  SING_TUNER_RANGE_CENTS,
  SingModalView,
  SingNoteStatus,
  SingPitchTone,
  SingTestStepResult,
} from "./singThisUtils";

export const IN_RANGE_LIST_NAME = "In Range";

type SingThisSong = {
  name: string;
  artist: string;
  vocalRange: string;
};

type SingThisModalProps = {
  visible: boolean;
  targets: string[];
  onClose: () => void;
  /** Song under test; enables the "add to a list" prompt after a pass. */
  song?: SingThisSong | null;
  isLoggedIn?: boolean;
  /** Called when the user wants to pick a list themselves (parent opens its list modal). */
  onAddToList?: () => void;
};

export default function SingThisModal({
  visible,
  targets,
  onClose,
  song = null,
  isLoggedIn = false,
  onAddToList,
}: SingThisModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [view, setView] = useState<SingModalView>("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [stepResults, setStepResults] = useState<SingTestStepResult[]>([]);
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [liveFrequency, setLiveFrequency] = useState<number | null>(null);
  const [centsOff, setCentsOff] = useState<number | null>(null);
  const [heldMs, setHeldMs] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSavingToList, setIsSavingToList] = useState(false);
  const [savedToInRange, setSavedToInRange] = useState(false);

  const detectionStopRef = useRef<(() => void) | null>(null);
  const recordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const referenceSoundRef = useRef<Audio.Sound | null>(null);
  const heldMsRef = useRef(0);
  const matchStartRef = useRef<number | null>(null);
  // Octave shift of the match currently being held (0 = exact octave).
  const activeShiftRef = useRef<number | null>(null);
  const isListeningRef = useRef(false);
  const isStartingRef = useRef(false);

  const currentTarget = targets[stepIndex] || "";
  const currentStepStatus = stepResults[stepIndex]?.status ?? "pending";
  const hasNextTarget = stepIndex + 1 < targets.length;
  const targetFrequency = useMemo(
    () => getTargetFrequency(currentTarget),
    [currentTarget]
  );
  const pitchFeedback = useMemo(
    () => getSingPitchFeedback(centsOff, isListening),
    [centsOff, isListening]
  );
  const pitchColor = getToneColor(pitchFeedback.tone, colors);
  // When the singer is on the right note but in another octave, run the
  // tuner off the octave-shifted residual so the needle stays useful.
  const liveOctaveMatch = useMemo(() => getOctaveMatch(centsOff), [centsOff]);
  const displayCents = liveOctaveMatch ? liveOctaveMatch.residualCents : centsOff;
  const indicatorPercent =
    ((clampCents(displayCents) + SING_TUNER_RANGE_CENTS) /
      (SING_TUNER_RANGE_CENTS * 2)) *
    100;
  const closeZoneInsetPercent =
    ((SING_TUNER_RANGE_CENTS - SING_COUNTABLE_CENTS) /
      (SING_TUNER_RANGE_CENTS * 2)) *
    100;
  const perfectZoneInsetPercent =
    ((SING_TUNER_RANGE_CENTS - SING_PERFECT_CENTS) /
      (SING_TUNER_RANGE_CENTS * 2)) *
    100;
  const heldProgress = Math.min(heldMs / SING_HOLD_DURATION_MS, 1);
  const allTargetsPassed =
    targets.length > 0 &&
    targets.every((_target, index) => stepResults[index]?.status === "passed");
  const allTargetsMatched =
    targets.length > 0 &&
    targets.every((_target, index) => {
      const status = stepResults[index]?.status;
      return status === "passed" || status === "octave";
    });
  const transposedSummary = useMemo(
    () => getTransposedSummary(stepResults),
    [stepResults]
  );
  const currentStepOctaveShift = stepResults[stepIndex]?.octaveShift ?? 0;
  const successfulRange = useMemo(() => {
    // Octave matches count too — report the note the singer actually hit.
    const matchedNotes = stepResults
      .filter((step) => step.status === "passed" || step.status === "octave")
      .map((step) =>
        step.status === "octave"
          ? shiftNoteOctaves(step.target, step.octaveShift ?? 0)
          : step.target
      );

    if (matchedNotes.length === 0) return null;
    if (matchedNotes.length === 1) return matchedNotes[0];

    // Octave shifts can reorder the notes (e.g. a low target sung two
    // octaves up) — sort by pitch so the range always reads low - high.
    const sorted = [...matchedNotes].sort(
      (a, b) => (getTargetFrequency(a) ?? 0) - (getTargetFrequency(b) ?? 0)
    );
    return `${sorted[0]} - ${sorted[sorted.length - 1]}`;
  }, [stepResults]);

  const clearPitchState = useCallback(() => {
    setLiveNote(null);
    setLiveFrequency(null);
    setCentsOff(null);
  }, []);

  const stopReferenceSound = useCallback(async () => {
    const sound = referenceSoundRef.current;
    if (!sound) return;

    referenceSoundRef.current = null;
    await sound.stopAsync().catch(() => {});
    await sound.unloadAsync().catch(() => {});
  }, []);

  const stopListening = useCallback(
    (resetHold: boolean = true, clearPitch: boolean = false) => {
      if (recordTimeoutRef.current) {
        clearTimeout(recordTimeoutRef.current);
        recordTimeoutRef.current = null;
      }

      if (detectionStopRef.current) {
        detectionStopRef.current();
        detectionStopRef.current = null;
      }

      isListeningRef.current = false;
      isStartingRef.current = false;
      setIsListening(false);

      if (resetHold) {
        heldMsRef.current = 0;
        matchStartRef.current = null;
        activeShiftRef.current = null;
        setHeldMs(0);
      }

      if (clearPitch) {
        clearPitchState();
      }
    },
    [clearPitchState]
  );

  const resetModalState = useCallback(() => {
    stopListening(true, true);
    setView("intro");
    setStepIndex(0);
    setStepResults([]);
    setIsSavingToList(false);
    setSavedToInRange(false);
  }, [stopListening]);

  useEffect(() => {
    if (!visible) {
      resetModalState();
      void stopReferenceSound();
    }
  }, [resetModalState, stopReferenceSound, visible]);

  useEffect(() => {
    return () => {
      stopListening(true, true);
      void stopReferenceSound();
    };
  }, [stopListening, stopReferenceSound]);

  const updateCurrentStep = useCallback(
    (status: SingNoteStatus, nextHeldMs: number, octaveShift?: number) => {
      if (!currentTarget) return;

      setStepResults((prev) => {
        const next = [...prev];
        next[stepIndex] = {
          target: currentTarget,
          status,
          heldMs: nextHeldMs,
          ...(octaveShift ? { octaveShift } : {}),
        };
        return next;
      });
    },
    [currentTarget, stepIndex]
  );

  const finalizeRecording = useCallback(
    (status: SingNoteStatus, octaveShift?: number) => {
      if (!isListeningRef.current) return;

      const finalHeldMs = heldMsRef.current;
      stopListening(false);
      matchStartRef.current = null;
      activeShiftRef.current = null;
      setHeldMs(finalHeldMs);
      updateCurrentStep(status, finalHeldMs, octaveShift);
    },
    [stopListening, updateCurrentStep]
  );

  const playReferenceNote = useCallback(async () => {
    if (!currentTarget || isListening) return;

    const audioFile = getPianoAudioFile(currentTarget);
    if (!audioFile) {
      Alert.alert("Note unavailable", `No audio sample found for ${currentTarget}.`);
      return;
    }

    try {
      await stopReferenceSound();
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
      console.error("Error playing Sing It reference note:", error);
      Alert.alert("Playback Error", "Could not play this note right now.");
    }
  }, [currentTarget, isListening, stopReferenceSound]);

  const startRecording = useCallback(async () => {
    if (!currentTarget || isListening || isStartingRef.current) return;

    isStartingRef.current = true;
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      isStartingRef.current = false;
      Alert.alert(
        "Microphone Permission Required",
        "VoiceVault needs microphone access to check your pitch."
      );
      return;
    }

    stopListening(true, true);
    isStartingRef.current = true;
    await stopReferenceSound();
    heldMsRef.current = 0;
    matchStartRef.current = null;
    setHeldMs(0);
    setIsListening(true);
    isListeningRef.current = true;
    updateCurrentStep("recording", 0);

    try {
      detectionStopRef.current = startPitchDetection(
        (result) => {
          if (!isListeningRef.current) return;

          const noteData = frequencyToNote(result.frequency);
          if (!noteData) return;

          const detectedNote = `${noteData.note}${noteData.octave}`;
          const nextCentsOff = getCentsOffTarget(result.frequency, targetFrequency);
          const counts = isCloseEnoughToCount(
            nextCentsOff,
            detectedNote,
            currentTarget
          );
          // Exact matches win; otherwise a right-note-wrong-octave match
          // still accrues hold time and finishes as a transposed pass.
          const octaveMatch = counts ? null : getOctaveMatch(nextCentsOff);
          const matchShift = counts ? 0 : octaveMatch?.octaveShift ?? null;

          setLiveFrequency(result.frequency);
          setLiveNote(detectedNote);
          setCentsOff(nextCentsOff);

          if (matchShift !== null) {
            // Restart the hold when the singer jumps between octaves.
            if (
              !matchStartRef.current ||
              activeShiftRef.current !== matchShift
            ) {
              matchStartRef.current = Date.now();
              activeShiftRef.current = matchShift;
            }

            const nextHeldMs = Date.now() - matchStartRef.current;
            heldMsRef.current = nextHeldMs;
            setHeldMs(nextHeldMs);

            if (nextHeldMs >= SING_HOLD_DURATION_MS) {
              finalizeRecording(
                matchShift === 0 ? "passed" : "octave",
                matchShift === 0 ? undefined : matchShift
              );
            }
          } else {
            matchStartRef.current = null;
            activeShiftRef.current = null;
            if (heldMsRef.current !== 0) {
              heldMsRef.current = 0;
              setHeldMs(0);
            }
          }
        },
        (error) => {
          console.error("Sing It pitch detection error:", error);
          Alert.alert("Sing It Error", "Could not start the microphone check right now.");
          stopListening(true);
          updateCurrentStep("failed", 0);
        },
        false
      );
    } catch (error) {
      console.error("Failed to start Sing It recording:", error);
      Alert.alert("Sing It Error", "Could not start the microphone check right now.");
      stopListening(true);
      updateCurrentStep("failed", 0);
      return;
    } finally {
      isStartingRef.current = false;
    }

    recordTimeoutRef.current = setTimeout(() => {
      finalizeRecording("failed");
    }, SING_MAX_RECORD_MS);
  }, [
    currentTarget,
    finalizeRecording,
    isListening,
    stopListening,
    stopReferenceSound,
    targetFrequency,
    updateCurrentStep,
  ]);

  const confirmReady = useCallback(() => {
    if (!targets.length) {
      Alert.alert(
        "Sing It!",
        "This song does not have a valid vocal range to test right now."
      );
      return;
    }

    stopListening(true, true);
    setStepResults(
      targets.map((target) => ({
        target,
        status: "pending" as SingNoteStatus,
        heldMs: 0,
      }))
    );
    setStepIndex(0);
    setView("note");
  }, [stopListening, targets]);

  const retryCurrentNote = useCallback(() => {
    stopListening(true, true);
    updateCurrentStep("pending", 0);
  }, [stopListening, updateCurrentStep]);

  const goToNextNote = useCallback(() => {
    if (!hasNextTarget) return;

    stopListening(true, true);
    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    setStepResults((prev) => {
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
  }, [hasNextTarget, stepIndex, stopListening]);

  const finishTest = useCallback(() => {
    stopListening(false);
    setView("complete");
  }, [stopListening]);

  const closeModal = useCallback(() => {
    resetModalState();
    void stopReferenceSound();
    onClose();
  }, [onClose, resetModalState, stopReferenceSound]);

  // Save the tested song straight into the "In Range" list.
  // saveToList creates the list automatically if it doesn't exist yet.
  const handleAddToInRangeList = useCallback(async () => {
    if (!song || isSavingToList) return;

    setIsSavingToList(true);
    try {
      await saveToList(song.name, song.artist, song.vocalRange, IN_RANGE_LIST_NAME);
      setSavedToInRange(true);
    } finally {
      setIsSavingToList(false);
    }
  }, [isSavingToList, song]);

  const handlePickAnotherList = useCallback(() => {
    closeModal();
    onAddToList?.();
  }, [closeModal, onAddToList]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={closeModal}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modalTitle}>Sing It!</Text>

            {view === "intro" && (
              <>
                <Text style={styles.disclaimer}>
                  Match the lowest and highest notes to check whether this range feels comfortable.
                </Text>
                <Text style={styles.instructions}>
                  Hold each note for 2 seconds. A close pitch counts, and the tuner will show whether you are perfect, close, or off.
                </Text>
                <TouchableOpacity style={styles.primaryButton} onPress={confirmReady}>
                  <Text style={styles.primaryButtonText}>I am Ready</Text>
                </TouchableOpacity>
              </>
            )}

            {view === "note" && currentTarget && (
              <>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepLabel}>
                    Note {stepIndex + 1} of {targets.length}
                  </Text>
                  <Text style={styles.targetNote}>{currentTarget}</Text>
                  <Text style={styles.targetHint}>Hold close enough for 2 seconds</Text>
                </View>

                <View style={styles.pitchPanel}>
                  <View style={styles.noteGrid}>
                    <View style={styles.noteTile}>
                      <Text style={styles.noteTileLabel}>Target</Text>
                      <Text style={styles.noteTileValue}>{currentTarget}</Text>
                    </View>
                    <View style={styles.noteTile}>
                      <Text style={styles.noteTileLabel}>Current</Text>
                      <Text style={styles.noteTileValue}>
                        {liveNote || (isListening ? "--" : "Not listening")}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.feedbackRow}>
                    <View style={[styles.feedbackDot, { backgroundColor: pitchColor }]} />
                    <View style={styles.feedbackTextWrap}>
                      <Text style={[styles.feedbackLabel, { color: pitchColor }]}>
                        {pitchFeedback.label}
                      </Text>
                      <Text style={styles.feedbackDetail}>{pitchFeedback.detail}</Text>
                    </View>
                  </View>

                  <View style={styles.tunerLabels}>
                    <Text style={styles.tunerLabel}>Low</Text>
                    <Text style={styles.tunerLabel}>Perfect</Text>
                    <Text style={styles.tunerLabel}>High</Text>
                  </View>
                  <View style={styles.tunerTrack}>
                    <View
                      style={[
                        styles.closeZone,
                        {
                          left: `${closeZoneInsetPercent}%`,
                          right: `${closeZoneInsetPercent}%`,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.perfectZone,
                        {
                          left: `${perfectZoneInsetPercent}%`,
                          right: `${perfectZoneInsetPercent}%`,
                        },
                      ]}
                    />
                    <View style={styles.centerLine} />
                    <View
                      style={[
                        styles.tunerNeedle,
                        {
                          left: `${indicatorPercent}%`,
                          backgroundColor: pitchColor,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.legendRow}>
                    <StatusChip label="Perfect" tone="perfect" colors={colors} />
                    <StatusChip
                      label={`Close ±${SING_CLOSE_CENTS}`}
                      tone="close"
                      colors={colors}
                    />
                    <StatusChip
                      label={`Counts ±${SING_COUNTABLE_CENTS}`}
                      tone="close"
                      colors={colors}
                    />
                    <StatusChip label="Off" tone="off" colors={colors} />
                  </View>

                  <Text style={styles.centsText}>
                    {centsOff === null
                      ? liveFrequency
                        ? `${Math.round(liveFrequency)} Hz`
                        : "No pitch detected yet"
                      : liveOctaveMatch
                      ? `${describeOctaveShift(liveOctaveMatch.octaveShift)} — ${Math.abs(
                          liveOctaveMatch.residualCents
                        )} cents ${liveOctaveMatch.residualCents < 0 ? "low" : "high"}`
                      : `${Math.abs(centsOff)} cents ${centsOff < 0 ? "low" : "high"}`}
                  </Text>
                </View>

                <View style={styles.holdPanel}>
                  <View style={styles.holdTextRow}>
                    <Text style={styles.holdLabel}>Close-enough hold</Text>
                    <Text style={styles.holdValue}>
                      {formatHeldSeconds(heldMs)}s / {SING_HOLD_DURATION_MS / 1000}s
                    </Text>
                  </View>
                  <View style={styles.holdTrack}>
                    <View
                      style={[
                        styles.holdFill,
                        {
                          width: `${heldProgress * 100}%`,
                          backgroundColor: pitchColor,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.buttonStack}>
                  <TouchableOpacity
                    style={[
                      styles.secondaryButton,
                      isListening && styles.disabledButton,
                    ]}
                    onPress={playReferenceNote}
                    disabled={isListening}
                  >
                    <Ionicons name="volume-high-outline" size={18} color={colors.textPrimary} />
                    <Text style={styles.secondaryButtonText}>Play Reference</Text>
                  </TouchableOpacity>

                  {(currentStepStatus === "pending" || currentStepStatus === "failed") && (
                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        isListening && styles.disabledButton,
                      ]}
                      onPress={startRecording}
                      disabled={isListening}
                    >
                      <Ionicons name="mic-outline" size={18} color={colors.buttonText} />
                      <Text style={styles.primaryButtonText}>
                        {currentStepStatus === "failed" ? "Record Again" : "Record Note"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {currentStepStatus === "passed" && (
                  <View style={styles.statusRow}>
                    <Ionicons name="checkmark-circle" size={22} color={getToneColor("perfect", colors)} />
                    <Text style={styles.statusText}>Held successfully</Text>
                  </View>
                )}
                {currentStepStatus === "octave" && (
                  <>
                    <View style={styles.statusRow}>
                      <Ionicons
                        name="swap-vertical"
                        size={22}
                        color={getToneColor("close", colors)}
                      />
                      <Text style={styles.statusText}>
                        Held {shiftNoteOctaves(currentTarget, currentStepOctaveShift)} —{" "}
                        {describeOctaveShift(currentStepOctaveShift)} than the target
                      </Text>
                    </View>
                    <Text style={styles.disclaimer}>
                      That's the same note in a different octave. It counts as a
                      transposed match: you could sing this part of the song
                      shifted {currentStepOctaveShift > 0 ? "up" : "down"}. Try
                      again if you want to reach the written octave.
                    </Text>
                  </>
                )}
                {currentStepStatus === "failed" && (
                  <View style={styles.statusRow}>
                    <Ionicons name="close-circle" size={22} color={getToneColor("off", colors)} />
                    <Text style={styles.statusText}>Not held close enough for 2 seconds</Text>
                  </View>
                )}

                {currentStepStatus === "failed" && (
                  <TouchableOpacity style={styles.secondaryButton} onPress={retryCurrentNote}>
                    <Text style={styles.secondaryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                )}

                {currentStepStatus === "octave" && (
                  <TouchableOpacity style={styles.secondaryButton} onPress={retryCurrentNote}>
                    <Text style={styles.secondaryButtonText}>Try the Written Octave</Text>
                  </TouchableOpacity>
                )}

                {(currentStepStatus === "passed" || currentStepStatus === "octave") &&
                  hasNextTarget && (
                  <TouchableOpacity style={styles.primaryButton} onPress={goToNextNote}>
                    <Text style={styles.primaryButtonText}>Next Note</Text>
                  </TouchableOpacity>
                )}

                {(currentStepStatus === "passed" || currentStepStatus === "octave") &&
                  !hasNextTarget && (
                  <TouchableOpacity style={styles.primaryButton} onPress={finishTest}>
                    <Text style={styles.primaryButtonText}>See Results</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {view === "complete" && (
              <>
                <Text style={styles.resultTitle}>Great work</Text>
                <View style={styles.resultCard}>
                  <Text style={styles.resultCardTitle}>
                    {transposedSummary ? "Range you sang" : "Successful range"}
                  </Text>
                  <Text style={styles.resultCardBody}>
                    {successfulRange || "No notes were held for 2 seconds yet."}
                  </Text>
                </View>
                {transposedSummary && (
                  <View style={styles.resultCard}>
                    <Text style={styles.resultCardTitle}>🎼 Transposed match</Text>
                    <Text style={styles.resultCardBody}>{transposedSummary}</Text>
                    <Text style={[styles.resultCardBody, { marginTop: 6 }]}>
                      Transposing just means performing the song in a lower or
                      higher key — ask for a different backing track key, use a
                      pitch-shift setting, or simply sing it in your octave.
                    </Text>
                  </View>
                )}
                <Text style={styles.resultBody}>
                  {allTargetsPassed
                    ? "You should be able to approach this song's listed range."
                    : allTargetsMatched
                    ? "You can likely sing this song transposed, even though the written range isn't a match yet."
                    : "Try again to confirm the full listed range."}
                </Text>

                {allTargetsPassed && song && isLoggedIn && (
                  <View style={styles.addToListCard}>
                    <Text style={styles.resultCardTitle}>Add this song to a list?</Text>
                    {savedToInRange ? (
                      <View style={styles.statusRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={getToneColor("perfect", colors)}
                        />
                        <Text style={styles.statusText}>
                          Saved to your "{IN_RANGE_LIST_NAME}" list
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.primaryButton,
                          isSavingToList && styles.disabledButton,
                        ]}
                        onPress={handleAddToInRangeList}
                        disabled={isSavingToList}
                      >
                        <Ionicons name="bookmark-outline" size={18} color={colors.buttonText} />
                        <Text style={styles.primaryButtonText}>
                          {isSavingToList
                            ? "Saving..."
                            : `Add to "${IN_RANGE_LIST_NAME}" List`}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {onAddToList && (
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={handlePickAnotherList}
                      >
                        <Text style={styles.secondaryButtonText}>Pick Another List</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {allTargetsPassed && song && !isLoggedIn && (
                  <Text style={styles.resultCardBody}>
                    Log in to save songs you can sing to a list.
                  </Text>
                )}

                <TouchableOpacity style={styles.primaryButton} onPress={confirmReady}>
                  <Text style={styles.primaryButtonText}>Test Again</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function StatusChip({
  label,
  tone,
  colors,
}: {
  label: string;
  tone: SingPitchTone;
  colors: typeof import("../../styles/theme").LightColors;
}) {
  const chipStyles = createChipStyles(colors);

  return (
    <View style={chipStyles.chip}>
      <View
        style={[
          chipStyles.chipDot,
          { backgroundColor: getToneColor(tone, colors) },
        ]}
      />
      <Text style={chipStyles.chipText}>{label}</Text>
    </View>
  );
}

const getToneColor = (
  tone: SingPitchTone,
  colors: typeof import("../../styles/theme").LightColors
) => {
  if (tone === "perfect") return colors.success || "#4CAF50";
  if (tone === "close") return colors.warning || "#FFA500";
  if (tone === "off") return colors.danger || "#FF5252";
  return colors.textSecondary;
};

const createChipStyles = (colors: typeof import("../../styles/theme").LightColors) =>
  StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginRight: 6,
    },
    chipText: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 11,
      fontWeight: "600",
    },
  });

const createStyles = (colors: typeof import("../../styles/theme").LightColors) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: colors.backgroundCard,
      borderRadius: 20,
      width: "92%",
      maxHeight: "88%",
      overflow: "hidden",
    },
    modalScrollContent: {
      padding: 22,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 24,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 16,
    },
    disclaimer: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 12,
    },
    instructions: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 14,
    },
    stepHeader: {
      alignItems: "center",
      marginBottom: 14,
    },
    stepLabel: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      marginBottom: 6,
      textTransform: "uppercase",
    },
    targetNote: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 42,
      fontWeight: "bold",
      lineHeight: 48,
    },
    targetHint: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 13,
      marginTop: 4,
    },
    pitchPanel: {
      backgroundColor: colors.backgroundTertiary,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    noteGrid: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 12,
    },
    noteTile: {
      flex: 1,
      backgroundColor: colors.backgroundCard,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    noteTileLabel: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      marginBottom: 4,
      textTransform: "uppercase",
    },
    noteTileValue: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 22,
      fontWeight: "bold",
    },
    feedbackRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    feedbackDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 10,
    },
    feedbackTextWrap: {
      flex: 1,
    },
    feedbackLabel: {
      fontFamily: FONTS.primary,
      fontSize: 15,
      fontWeight: "bold",
      marginBottom: 2,
    },
    feedbackDetail: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 12,
    },
    tunerLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    tunerLabel: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 11,
      fontWeight: "600",
    },
    tunerTrack: {
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.backgroundCard,
      borderColor: colors.border,
      borderWidth: 1,
      marginBottom: 10,
      overflow: "hidden",
      position: "relative",
    },
    closeZone: {
      position: "absolute",
      top: 0,
      bottom: 0,
      backgroundColor: `${colors.warning || "#FFA500"}26`,
    },
    perfectZone: {
      position: "absolute",
      top: 0,
      bottom: 0,
      backgroundColor: `${colors.success || "#4CAF50"}36`,
    },
    centerLine: {
      position: "absolute",
      left: "50%",
      top: -2,
      bottom: -2,
      width: 2,
      backgroundColor: colors.textSecondary,
    },
    tunerNeedle: {
      position: "absolute",
      top: -3,
      width: 8,
      height: 24,
      borderRadius: 4,
      transform: [{ translateX: -4 }],
    },
    legendRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
      marginBottom: 8,
    },
    centsText: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 12,
      textAlign: "center",
    },
    holdPanel: {
      marginBottom: 14,
    },
    holdTextRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    holdLabel: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 12,
      fontWeight: "600",
    },
    holdValue: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 12,
      fontWeight: "700",
    },
    holdTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.backgroundTertiary,
      overflow: "hidden",
    },
    holdFill: {
      height: "100%",
      borderRadius: 4,
    },
    buttonStack: {
      gap: 10,
      marginBottom: 12,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 13,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    primaryButtonText: {
      color: colors.buttonText,
      fontFamily: FONTS.primary,
      fontSize: 15,
      fontWeight: "bold",
    },
    secondaryButton: {
      backgroundColor: colors.backgroundTertiary,
      borderColor: colors.border,
      borderWidth: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 14,
      fontWeight: "700",
    },
    disabledButton: {
      opacity: 0.55,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    statusText: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 14,
      fontWeight: "600",
    },
    resultTitle: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 22,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 12,
    },
    resultCard: {
      backgroundColor: colors.backgroundTertiary,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    resultCardTitle: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 14,
      fontWeight: "bold",
      marginBottom: 4,
    },
    resultCardBody: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 13,
      lineHeight: 19,
    },
    resultBody: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    addToListCard: {
      backgroundColor: colors.backgroundTertiary,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
      gap: 10,
    },
    cancelButton: {
      alignItems: "center",
      borderRadius: 8,
      paddingVertical: 12,
      marginTop: 8,
    },
    cancelText: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 15,
    },
  });
