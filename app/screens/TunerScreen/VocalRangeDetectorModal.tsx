// app/screens/TunerScreen/VocalRangeDetectorModal.tsx

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, Alert, StyleSheet, Animated } from 'react-native';
import { startPitchDetection, PitchResult } from '../../util/pitchDetection';
import { analyzeVocalRange, validateRange, calculateRangeStats } from '../../util/audioAnalysis';
import { submitVocalRange } from '../UserVocalRange/UserVocalRangeLogic';
import { useTheme } from '../../contexts/ThemeContext';

type Step = 'intro' | 'recordLow' | 'analyzeLow' | 'confirmLow' | 'recordHigh' | 'analyzeHigh' | 'confirmHigh' | 'results';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (lowNote: string, highNote: string) => void;
}

export default function VocalRangeDetectorModal({ visible, onClose, onSuccess }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState<Step>('intro');
  const [recording, setRecording] = useState(false);
  const [pitchSamples, setPitchSamples] = useState<PitchResult[]>([]);
  const [detectedLowNote, setDetectedLowNote] = useState<string | null>(null);
  const [detectedHighNote, setDetectedHighNote] = useState<string | null>(null);
  const [currentPitch, setCurrentPitch] = useState<PitchResult | null>(null);
  
  const stopDetectionRef = useRef<(() => void) | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressAnimationRef = useRef(new Animated.Value(0)).current;

  const RECORDING_DURATION = 5000; // 5 seconds

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const startRecording = (type: 'low' | 'high') => {
    setPitchSamples([]);
    setRecording(true);

    // Animate progress bar
    Animated.timing(progressAnimationRef, {
      toValue: 100,
      duration: RECORDING_DURATION,
      useNativeDriver: false,
    }).start();

    // Start pitch detection
    stopDetectionRef.current = startPitchDetection(
      (result) => {
        setPitchSamples(prev => [...prev, result]);
        setCurrentPitch(result);
      },
      (error) => {
        Alert.alert('Error', 'Microphone access failed: ' + error.message);
        stopRecording();
      }
    );

    // Auto-stop after duration
    recordingTimerRef.current = setTimeout(() => {
      stopRecording();
      analyzeRecording(type);
    }, RECORDING_DURATION);
  };

  const stopRecording = () => {
    if (stopDetectionRef.current) {
      stopDetectionRef.current();
      stopDetectionRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecording(false);
    setCurrentPitch(null);
    progressAnimationRef.setValue(0);
  };

  const analyzeRecording = (type: 'low' | 'high') => {
    setStep(type === 'low' ? 'analyzeLow' : 'analyzeHigh');

    setTimeout(() => {
      const result = analyzeVocalRange(pitchSamples, type === 'low' ? 'lowest' : 'highest');

      if (!result || result.confidence < 0.3) {
        Alert.alert(
          'Detection Failed',
          'Could not detect a clear note. Please try again in a quieter environment.',
          [{ text: 'Retry', onPress: () => setStep(type === 'low' ? 'recordLow' : 'recordHigh') }]
        );
        return;
      }

      if (type === 'low') {
        setDetectedLowNote(result.note);
        setStep('confirmLow');
      } else {
        setDetectedHighNote(result.note);
        setStep('confirmHigh');
      }
    }, 1000); // Simulate processing
  };

  const handleSaveRange = async () => {
    if (!detectedLowNote || !detectedHighNote) return;

    if (!validateRange(detectedLowNote, detectedHighNote)) {
      Alert.alert('Invalid Range', 'The detected range seems unusual. Please try again.');
      return;
    }

    try {
      await submitVocalRange(detectedLowNote, detectedHighNote);
      onSuccess(detectedLowNote, detectedHighNote);
      onClose();
      Alert.alert('Success', 'Your vocal range has been saved!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save vocal range. Please try again.');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'intro':
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Find Your Vocal Range
            </Text>
            <Text style={[styles.instructions, { color: colors.textSecondary }]}>
              We'll guide you through detecting your lowest and highest comfortable notes.
            </Text>
            <Text style={[styles.instructions, { color: colors.textSecondary }]}>
              Find a quiet place and prepare to sing!
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => setStep('recordLow')}
            >
              <Text style={styles.buttonText}>Start</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case 'recordLow':
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Step 1 of 2</Text>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Sing Your LOWEST Note
            </Text>
            <Text style={[styles.instructions, { color: colors.textSecondary }]}>
              Sing and hold your lowest comfortable note for 5 seconds
            </Text>
            
            {!recording && (
              <TouchableOpacity
                style={[styles.button, styles.recordButton]}
                onPress={() => startRecording('low')}
              >
                <Text style={styles.buttonText}>🎤 Start Recording</Text>
              </TouchableOpacity>
            )}
            
            {recording && (
              <>
                {currentPitch && (
                  <View style={styles.pitchDisplay}>
                    <Text style={[styles.currentNote, { color: colors.accent }]}>
                      {currentPitch.note}{currentPitch.octave}
                    </Text>
                    <Text style={[styles.frequency, { color: colors.textSecondary }]}>
                      {currentPitch.frequency.toFixed(2)} Hz
                    </Text>
                  </View>
                )}
                <View style={styles.progressContainer}>
                  <Animated.View
                    style={[
                      styles.progressBar,
                      {
                        width: progressAnimationRef.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.button, styles.stopButton]}
                  onPress={() => {
                    stopRecording();
                    analyzeRecording('low');
                  }}
                >
                  <Text style={styles.buttonText}>Stop Early</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );

      case 'analyzeLow':
      case 'analyzeHigh':
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Analyzing...
            </Text>
            <Text style={[styles.instructions, { color: colors.textSecondary }]}>
              Processing your recording
            </Text>
          </View>
        );

      case 'confirmLow':
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Detected Note
            </Text>
            <Text style={[styles.detectedNote, { color: colors.accent }]}>
              🎵 {detectedLowNote} 🎵
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => setStep('recordLow')}
              >
                <Text style={styles.buttonText}>↻ Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={() => setStep('recordHigh')}
              >
                <Text style={styles.buttonText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'recordHigh':
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Step 2 of 2</Text>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Sing Your HIGHEST Note
            </Text>
            <Text style={[styles.instructions, { color: colors.textSecondary }]}>
              Sing and hold your highest comfortable note for 5 seconds
            </Text>
            
            {!recording && (
              <TouchableOpacity
                style={[styles.button, styles.recordButton]}
                onPress={() => startRecording('high')}
              >
                <Text style={styles.buttonText}>🎤 Start Recording</Text>
              </TouchableOpacity>
            )}
            
            {recording && (
              <>
                {currentPitch && (
                  <View style={styles.pitchDisplay}>
                    <Text style={[styles.currentNote, { color: colors.accent }]}>
                      {currentPitch.note}{currentPitch.octave}
                    </Text>
                    <Text style={[styles.frequency, { color: colors.textSecondary }]}>
                      {currentPitch.frequency.toFixed(2)} Hz
                    </Text>
                  </View>
                )}
                <View style={styles.progressContainer}>
                  <Animated.View
                    style={[
                      styles.progressBar,
                      {
                        width: progressAnimationRef.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.button, styles.stopButton]}
                  onPress={() => {
                    stopRecording();
                    analyzeRecording('high');
                  }}
                >
                  <Text style={styles.buttonText}>Stop Early</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );

      case 'confirmHigh':
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Detected Note
            </Text>
            <Text style={[styles.detectedNote, { color: colors.accent }]}>
              🎵 {detectedHighNote} 🎵
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => setStep('recordHigh')}
              >
                <Text style={styles.buttonText}>↻ Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={() => setStep('results')}
              >
                <Text style={styles.buttonText}>See Results →</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'results':
        if (!detectedLowNote || !detectedHighNote) return null;
        
        const stats = calculateRangeStats(detectedLowNote, detectedHighNote);
        
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Your Vocal Range
            </Text>
            <Text style={[styles.rangeDisplay, { color: colors.accent }]}>
              {detectedLowNote} - {detectedHighNote}
            </Text>
            <Text style={[styles.rangeStats, { color: colors.textSecondary }]}>
              {stats.rangeDescription}
            </Text>
            {stats.classification !== 'Unknown' && (
              <Text style={[styles.classification, { color: colors.textPrimary }]}>
                🎤 {stats.classification}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleSaveRange}
            >
              <Text style={styles.buttonText}>💾 Save to Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                setDetectedLowNote(null);
                setDetectedHighNote(null);
                setStep('intro');
              }}
            >
              <Text style={styles.buttonText}>↻ Start Over</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderStep()}
      </View>
    </Modal>
  );
}

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  stepContainer: {
    width: '100%',
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 16,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginVertical: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#666',
  },
  recordButton: {
    backgroundColor: '#FF3B30',
  },
  stopButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 20,
  },
  cancelText: {
    fontSize: 16,
  },
  pitchDisplay: {
    alignItems: 'center',
    marginVertical: 20,
  },
  currentNote: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  frequency: {
    fontSize: 16,
    marginTop: 5,
  },
  progressContainer: {
    width: '80%',
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 20,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  detectedNote: {
    fontSize: 56,
    fontWeight: 'bold',
    marginVertical: 30,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 15,
  },
  rangeDisplay: {
    fontSize: 40,
    fontWeight: 'bold',
    marginVertical: 20,
  },
  rangeStats: {
    fontSize: 18,
    marginBottom: 10,
  },
  classification: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 30,
  },
});
