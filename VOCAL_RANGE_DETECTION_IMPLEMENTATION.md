# Vocal Range Auto-Detection - Implementation Plan v1.3.6

**Target Release**: Version 1.3.6  
**Feature Scope**: Batch-processed vocal range detection  
**Future Enhancement**: Real-time tuner in v1.5.0+

---

## 🎯 Feature Objective

Enable users to automatically detect their vocal range by recording themselves singing their lowest and highest comfortable notes. This eliminates manual note selection and provides a more accurate, user-friendly experience.

---

## 🏗️ Architecture Overview

### Technology Stack
- **Audio Recording**: `expo-av` (already installed)
- **Pitch Detection**: `react-native-pitch-detector` (native module)
- **Processing Mode**: Batch analysis (not real-time)
- **Storage**: Existing `user_vocal_ranges` table in Supabase

### Why `react-native-pitch-detector`?
1. ✅ Native iOS/Android performance
2. ✅ Works for both range detection AND future tuner
3. ✅ One library, two features (future-proof)
4. ✅ Better accuracy than pure JS solutions
5. ✅ Compatible with `expo-dev-client` (already in use)

### Trade-offs
- ❌ Requires EAS custom build (can't use Expo Go)
- ✅ But we already use dev client, so no new limitation
- ✅ One rebuild now = both features work forever

---

## 📋 User Flow

### Step-by-Step Experience

```
1. User opens Tuner Screen
   └─ Sees "Find My Vocal Range" button
   
2. User taps "Find My Vocal Range"
   └─ Opens VocalRangeDetectorModal
   
3. Instructions Screen
   ├─ "We'll help you find your vocal range!"
   ├─ "Sing your lowest comfortable note for 5 seconds"
   └─ [Start] button
   
4. Record Lowest Note
   ├─ Shows countdown: "3... 2... 1... Sing!"
   ├─ Records for 5 seconds
   ├─ Shows waveform animation
   ├─ Progress bar (0-5 seconds)
   └─ Auto-stops at 5 seconds
   
5. Processing Low Note
   ├─ "Analyzing..." spinner
   ├─ Analyzes all recorded frequencies
   ├─ Finds lowest stable pitch (2+ occurrences)
   └─ Displays: "Detected: E2"
   
6. Confirm or Retry Low Note
   ├─ User can tap "Retry" to re-record
   └─ Or tap "Next" to continue
   
7. Record Highest Note
   ├─ "Now sing your highest comfortable note"
   ├─ Same 5-second recording process
   └─ Auto-stops at 5 seconds
   
8. Processing High Note
   ├─ "Analyzing..." spinner
   ├─ Finds highest stable pitch
   └─ Displays: "Detected: A4"
   
9. Review & Save
   ├─ Shows: "Your Vocal Range: E2 - A4"
   ├─ Visual piano highlighting the range
   ├─ [Save to Profile] button
   └─ [Retry] button (starts over)
   
10. Save Complete
    ├─ Saves to Supabase `user_vocal_ranges`
    ├─ Shows success message
    └─ Returns to Tuner Screen
```

### Visual Mockup

```
┌─────────────────────────────┐
│  Find Your Vocal Range      │
├─────────────────────────────┤
│                             │
│  🎤 Step 1 of 2             │
│                             │
│  Sing your LOWEST           │
│  comfortable note           │
│                             │
│  ████████░░░░░ 60%          │
│  (5 second recording)       │
│                             │
│  ┌─────────────────┐        │
│  │ ~ ~ ~ ~ ~ ~ ~ ~ │        │
│  │~ Waveform ~ ~ ~ │        │
│  │ ~ ~ ~ ~ ~ ~ ~ ~ │        │
│  └─────────────────┘        │
│                             │
│  [   Stop Early   ]         │
│                             │
└─────────────────────────────┘

┌─────────────────────────────┐
│  Detected Note              │
├─────────────────────────────┤
│                             │
│       🎵 E2 🎵              │
│     (82.41 Hz)              │
│                             │
│  Confidence: ●●●●○          │
│                             │
│  [  ↻ Retry  ] [  Next →  ] │
│                             │
└─────────────────────────────┘

┌─────────────────────────────┐
│  Your Vocal Range           │
├─────────────────────────────┤
│                             │
│       E2  -  A4             │
│   (2 octaves, 5 semitones)  │
│                             │
│   Classification:           │
│      🎤 Tenor               │
│                             │
│  ┌─────────────────────┐   │
│  │ Piano visualization │   │
│  │ C D E F G A B C ... │   │
│  │   ██████████        │   │
│  └─────────────────────┘   │
│                             │
│  [ 💾 Save to Profile ]    │
│  [  ↻ Start Over     ]     │
│                             │
└─────────────────────────────┘
```

---

## 🛠️ Technical Implementation

### File Structure

```
app/
├─ screens/
│  └─ TunerScreen/
│     ├─ TunerScreen.tsx (update with button)
│     ├─ VocalRangeDetectorModal.tsx (NEW)
│     ├─ RecordingStep.tsx (NEW)
│     ├─ ResultsStep.tsx (NEW)
│     └─ styles.ts (NEW)
│
├─ util/
│  ├─ pitchDetection.ts (NEW)
│  └─ audioAnalysis.ts (NEW)
│
└─ components/
   └─ WaveformVisualizer.tsx (NEW - optional)
```

### Dependencies to Install

```bash
# Install pitch detector (requires rebuild)
npx expo install react-native-pitch-detector

# Update app.config.js/app.json plugins if needed
```

### Core Utilities

#### `util/pitchDetection.ts`
```typescript
import PitchDetector from 'react-native-pitch-detector';

export interface PitchResult {
  frequency: number;
  note: string;
  octave: number;
  confidence: number;
  timestamp: number;
}

export const VALID_VOCAL_RANGE = {
  minFrequency: 60,   // ~B1 (low bass)
  maxFrequency: 1400, // ~F6 (high soprano)
};

/**
 * Convert frequency (Hz) to musical note
 */
export const frequencyToNote = (frequency: number): { note: string; octave: number } | null => {
  if (frequency < VALID_VOCAL_RANGE.minFrequency || frequency > VALID_VOCAL_RANGE.maxFrequency) {
    return null;
  }

  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  const halfSteps = 12 * Math.log2(frequency / C0);
  const noteNumber = Math.round(halfSteps);
  
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(noteNumber / 12);
  const note = notes[noteNumber % 12];
  
  return { note, octave };
};

/**
 * Format note for display (e.g., "E2", "A#4")
 */
export const formatNote = (note: string, octave: number): string => {
  return `${note}${octave}`;
};

/**
 * Start continuous pitch detection
 * Returns a function to stop detection
 */
export const startPitchDetection = (
  onPitchDetected: (result: PitchResult) => void,
  onError: (error: Error) => void
): () => void => {
  const detector = new PitchDetector();
  
  detector.start({
    sampleRate: 22050,
    bufferSize: 2048,
    onPitchDetected: (frequency: number, confidence: number) => {
      const noteData = frequencyToNote(frequency);
      
      if (noteData && confidence > 0.85) { // Only high-confidence detections
        onPitchDetected({
          frequency,
          note: noteData.note,
          octave: noteData.octave,
          confidence,
          timestamp: Date.now(),
        });
      }
    },
    onError: (error) => {
      onError(new Error(error));
    },
  });
  
  return () => detector.stop();
};
```

#### `util/audioAnalysis.ts`
```typescript
import { PitchResult } from './pitchDetection';
import { NOTES } from './vocalRange';

export interface RangeAnalysisResult {
  lowestNote: string;
  highestNote: string;
  lowestFrequency: number;
  highestFrequency: number;
  confidence: number;
  sampleCount: number;
}

/**
 * Analyze collected pitch samples to find vocal range
 * 
 * Strategy:
 * 1. Filter out outliers (bottom/top 5%)
 * 2. Find most common low frequency (mode in lowest quartile)
 * 3. Find most common high frequency (mode in highest quartile)
 * 4. Convert to note names
 */
export const analyzeVocalRange = (
  pitchSamples: PitchResult[],
  type: 'lowest' | 'highest'
): { note: string; frequency: number; confidence: number } | null => {
  if (pitchSamples.length < 10) {
    return null; // Not enough data
  }

  // Sort by frequency
  const sorted = [...pitchSamples].sort((a, b) => a.frequency - b.frequency);
  
  // Remove outliers (bottom and top 10%)
  const trimCount = Math.floor(sorted.length * 0.1);
  const trimmed = sorted.slice(trimCount, -trimCount);
  
  if (trimmed.length < 5) {
    return null;
  }

  // Get target quartile
  const quartile = type === 'lowest' 
    ? trimmed.slice(0, Math.floor(trimmed.length * 0.25))  // Lowest 25%
    : trimmed.slice(-Math.floor(trimmed.length * 0.25));   // Highest 25%
  
  // Find most stable frequency (frequency that appears most)
  const frequencyMap = new Map<number, number>();
  
  quartile.forEach(sample => {
    // Round to nearest Hz for grouping
    const rounded = Math.round(sample.frequency);
    frequencyMap.set(rounded, (frequencyMap.get(rounded) || 0) + 1);
  });
  
  // Find frequency with highest count
  let maxCount = 0;
  let targetFrequency = 0;
  
  frequencyMap.forEach((count, freq) => {
    if (count > maxCount) {
      maxCount = count;
      targetFrequency = freq;
    }
  });
  
  // Calculate confidence based on how consistent the detection was
  const confidence = maxCount / quartile.length;
  
  // Convert to note name
  const noteData = frequencyToNote(targetFrequency);
  if (!noteData) return null;
  
  const note = formatNote(noteData.note, noteData.octave);
  
  return {
    note,
    frequency: targetFrequency,
    confidence,
  };
};

/**
 * Validate that detected range makes sense
 */
export const validateRange = (lowestNote: string, highestNote: string): boolean => {
  const lowIndex = NOTES.indexOf(lowestNote);
  const highIndex = NOTES.indexOf(highestNote);
  
  if (lowIndex === -1 || highIndex === -1) {
    return false;
  }
  
  // Range must be at least 1 octave (12 semitones)
  // and at most 5 octaves (60 semitones)
  const semitones = highIndex - lowIndex;
  return semitones >= 12 && semitones <= 60;
};

/**
 * Calculate vocal range statistics
 */
export const calculateRangeStats = (lowestNote: string, highestNote: string) => {
  const lowIndex = NOTES.indexOf(lowestNote);
  const highIndex = NOTES.indexOf(highestNote);
  
  const semitones = highIndex - lowIndex;
  const octaves = Math.floor(semitones / 12);
  const remainingSemitones = semitones % 12;
  
  // Classify vocal type (simplified)
  let classification = 'Unknown';
  
  if (lowestNote.includes('2') || lowestNote.includes('1')) {
    if (highestNote.includes('4')) {
      classification = 'Bass';
    } else if (highestNote.includes('5')) {
      classification = 'Baritone / Mezzo-Soprano';
    }
  } else if (lowestNote.includes('3')) {
    if (highestNote.includes('5')) {
      classification = 'Tenor / Alto';
    } else if (highestNote.includes('6')) {
      classification = 'Soprano';
    }
  }
  
  return {
    semitones,
    octaves,
    remainingSemitones,
    classification,
    rangeDescription: `${octaves} octave${octaves !== 1 ? 's' : ''}${
      remainingSemitones > 0 ? `, ${remainingSemitones} semitone${remainingSemitones !== 1 ? 's' : ''}` : ''
    }`,
  };
};
```

### Component Implementation

#### `screens/TunerScreen/VocalRangeDetectorModal.tsx`
```typescript
import React, { useState, useRef, useEffect } from 'react';
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
  const [step, setStep] = useState<Step>('intro');
  const [recording, setRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
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
    setRecordingProgress(0);

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

const styles = StyleSheet.create({
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
```

#### Update `screens/TunerScreen/TunerScreen.tsx`
```typescript
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import VocalRangeDetectorModal from "./VocalRangeDetectorModal";

export default function TunerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [modalVisible, setModalVisible] = useState(false);
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Tune your instruments here!</Text>
      
      <TouchableOpacity
        style={styles.button}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.buttonText}>🎤 Find My Vocal Range</Text>
      </TouchableOpacity>

      <VocalRangeDetectorModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={(low, high) => {
          console.log('Vocal range saved:', low, high);
        }}
      />
    </View>
  );
}

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  text: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 30,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
```

---

## 🧪 Testing Strategy

### Pre-Build Testing Checklist

Before building with EAS, verify:

1. ✅ **Permissions Setup**
   - [ ] iOS: `NSMicrophoneUsageDescription` in app.json
   - [ ] Android: `RECORD_AUDIO` permission in AndroidManifest.xml

2. ✅ **TypeScript Compilation**
   - [ ] Run `npx tsc --noEmit` to check for type errors
   - [ ] All imports resolve correctly
   - [ ] No unused variables or functions

3. ✅ **Mock Testing** (Before Native Module)
   - [ ] Test UI flow with mock data
   - [ ] Test all button interactions
   - [ ] Test modal open/close
   - [ ] Test step transitions

4. ✅ **Integration Points**
   - [ ] Verify `submitVocalRange()` function works
   - [ ] Confirm Supabase connection
   - [ ] Test database writes

### Post-Build Testing

After EAS build completes:

1. **Basic Flow Test**
   - [ ] Open Tuner screen
   - [ ] Tap "Find My Vocal Range"
   - [ ] Complete full flow with real voice
   - [ ] Verify notes saved to profile

2. **Edge Cases**
   - [ ] Test with background noise
   - [ ] Test very low note (below E2)
   - [ ] Test very high note (above C6)
   - [ ] Test canceling mid-recording
   - [ ] Test "Retry" functionality

3. **Error Handling**
   - [ ] Deny microphone permission
   - [ ] Network error during save
   - [ ] Invalid range detection

4. **Performance**
   - [ ] Check CPU usage during recording
   - [ ] Verify memory doesn't leak
   - [ ] Test on low-end device

### Fallback Plan

If pitch detection doesn't work well:

1. **Reduce confidence threshold** (from 0.85 to 0.7)
2. **Increase recording time** (from 5s to 8s)
3. **Add manual override** button (pick note from list)
4. **Phase 2**: Add visual piano for manual selection

---

## 📦 Build & Deployment

### Update app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-build-properties",
        {
          "ios": {
            "deploymentTarget": "13.0"
          },
          "android": {
            "minSdkVersion": 24
          }
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "NSMicrophoneUsageDescription": "VoiceVault needs microphone access to detect your vocal range and tune your voice."
      }
    },
    "android": {
      "permissions": [
        "RECORD_AUDIO"
      ]
    }
  }
}
```

### Build Commands
```bash
# Install dependencies
npm install react-native-pitch-detector

# Prebuild (generate native code)
npx expo prebuild

# Build for development
eas build --profile development --platform android
eas build --profile development --platform ios

# Build for production (later)
eas build --profile production --platform all
```

### Expected Build Time
- Android: ~15-20 minutes
- iOS: ~20-30 minutes

---

## ✅ Success Criteria

### Must Have (v1.3.6)
- ✅ Users can record and detect lowest note
- ✅ Users can record and detect highest note
- ✅ Detected range saves to user profile
- ✅ Works on both iOS and Android
- ✅ Graceful error handling for failed detections
- ✅ Clear user instructions throughout flow

### Nice to Have
- ✅ Visual waveform during recording
- ✅ Confidence indicator for detections
- ✅ Vocal type classification (Bass, Tenor, etc.)
- ⚠️ Piano visualization (can reuse existing component)

### Future Enhancements (v1.5.0+)
- Real-time tuner display
- Practice mode with pitch feedback
- Range history tracking
- Comparison with professional singers

---

## 🐛 Known Limitations & Workarounds

### Issue 1: Background Noise
**Problem**: Noisy environments affect accuracy  
**Workaround**: 
- Show "Find a quiet place" instruction
- Require high confidence threshold (>0.85)
- Allow retry functionality

### Issue 2: Harmonics Confusion
**Problem**: May detect octave above/below actual note  
**Workaround**:
- Filter frequencies outside vocal range (60-1400Hz)
- Use statistical mode (most common) instead of average
- Validate range is reasonable (1-5 octaves)

### Issue 3: Very High/Low Notes
**Problem**: Extreme notes harder to detect  
**Workaround**:
- Extended recording time for edge notes
- Manual override option
- Show confidence indicator

### Issue 4: Microphone Quality
**Problem**: Phone mic quality varies  
**Workaround**:
- Normalize input levels
- Use robust pitch detection algorithm (YIN/autocorrelation)
- Test on multiple devices

---

## 🔄 Future Migration Path

### To Real-time Tuner (v1.5.0)

Same library, different UI:

```typescript
// Vocal Range Detection (v1.3.6)
const samples = [];
startPitchDetection((pitch) => {
  samples.push(pitch); // Collect
});
// Later: analyze all samples

// Real-time Tuner (v1.5.0)
startPitchDetection((pitch) => {
  setDisplayNote(pitch); // Show immediately
});
```

**Changes needed**:
1. Add tuner needle visualization
2. Show "in tune" / "sharp" / "flat" indicators
3. Reduce UI update throttling (60fps)
4. Add instrument presets (guitar, violin, etc.)

---

## 📝 Commit Strategy

```bash
# Feature branch (already created)
git checkout -b 1.3.6/tuner-range

# Commits:
1. "Add pitch detection utilities and types"
2. "Create VocalRangeDetectorModal component"
3. "Integrate detector modal with TunerScreen"
4. "Add microphone permissions to app config"
5. "Update dependencies for pitch detection"
6. "Test: Verify modal flow with mock data"
7. "Build: Configure EAS for native modules"

# After testing:
8. "Fix: [specific issues found during testing]"
9. "Polish: UI improvements and error handling"
10. "Docs: Update README with new feature"

# Merge to main
git checkout main
git merge 1.3.6/tuner-range
git push origin main
```

---

## 📋 Pre-Build Checklist

Before running `eas build`:

- [ ] All TypeScript files compile without errors
- [ ] No ESLint/Prettier warnings
- [ ] Modal tested with mock flow (no pitch detection yet)
- [ ] Permissions added to app.json
- [ ] Dependencies installed (`react-native-pitch-detector`)
- [ ] Git committed all changes
- [ ] Reviewed code for TODOs or debug logs
- [ ] Tested on Expo Go (basic UI, not pitch detection)
- [ ] EAS account configured
- [ ] Build profile exists in eas.json

---

**Last Updated**: December 26, 2025  
**Status**: Ready for implementation  
**Estimated Dev Time**: 6-8 hours  
**Estimated Build Time**: 20-30 minutes  
**Total Time to Production**: 1-2 days
