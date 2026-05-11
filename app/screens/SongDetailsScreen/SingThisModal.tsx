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
import {
  frequencyToNote,
  requestMicrophonePermission,
  startPitchDetection,
} from "../../util/pitchDetection";
import {
  clampCents,
  formatHeldSeconds,
  getCentsOffTarget,
  getSingPitchFeedback,
  getTargetFrequency,
  isCloseEnoughToCount,
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

type SingThisModalProps = {
  visible: boolean;
  targets: string[];
  onClose: () => void;
};

export default function SingThisModal({
  visible,
  targets,
  onClose,
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

  const detectionStopRef = useRef<(() => void) | null>(null);
  const recordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const referenceSoundRef = useRef<Audio.Sound | null>(null);
  const heldMsRef = useRef(0);
  const matchStartRef = useRef<number | null>(null);
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
  const indicatorPercent =
    ((clampCents(centsOff) + SING_TUNER_RANGE_CENTS) /
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
  const successfulRange = useMemo(() => {
    const passedTargets = stepResults
      .filter((step) => step.status === "passed")
      .map((step) => step.target);

    if (passedTargets.length === 0) return null;
    return passedTargets.length === 1
      ? passedTargets[0]
      : `${passedTargets[0]} - ${passedTargets[passedTargets.length - 1]}`;
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
    (status: SingNoteStatus, nextHeldMs: number) => {
      if (!currentTarget) return;

      setStepResults((prev) => {
        const next = [...prev];
        next[stepIndex] = {
          target: currentTarget,
          status,
          heldMs: nextHeldMs,
        };
        return next;
      });
    },
    [currentTarget, stepIndex]
  );

  const finalizeRecording = useCallback(
    (status: SingNoteStatus) => {
      if (!isListeningRef.current) return;

      const finalHeldMs = heldMsRef.current;
      stopListening(false);
      matchStartRef.current = null;
      setHeldMs(finalHeldMs);
      updateCurrentStep(status, finalHeldMs);
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

          setLiveFrequency(result.frequency);
          setLiveNote(detectedNote);
          setCentsOff(nextCentsOff);

          if (counts) {
            if (!matchStartRef.current) {
              matchStartRef.current = Date.now();
            }

            const nextHeldMs = Date.now() - matchStartRef.current;
            heldMsRef.current = nextHeldMs;
            setHeldMs(nextHeldMs);

            if (nextHeldMs >= SING_HOLD_DURATION_MS) {
              finalizeRecording("passed");
            }
          } else {
            matchStartRef.current = null;
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

                {currentStepStatus === "passed" && hasNextTarget && (
                  <TouchableOpacity style={styles.primaryButton} onPress={goToNextNote}>
                    <Text style={styles.primaryButtonText}>Next Note</Text>
                  </TouchableOpacity>
                )}

                {currentStepStatus === "passed" && !hasNextTarget && (
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
                  <Text style={styles.resultCardTitle}>Successful range</Text>
                  <Text style={styles.resultCardBody}>
                    {successfulRange || "No notes were held for 2 seconds yet."}
                  </Text>
                </View>
                <Text style={styles.resultBody}>
                  {allTargetsPassed
                    ? "You should be able to approach this song's listed range."
                    : "Try again to confirm the full listed range."}
                </Text>
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
