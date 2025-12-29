// app/util/pitchDetection.ts

import { Platform, PermissionsAndroid } from 'react-native';
import { Audio } from 'expo-av';

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

// Global index for mock data to persist across recordings
let mockDataIndex = 0;

/**
 * Reset mock data index (for testing purposes)
 */
export const resetMockIndex = () => {
  mockDataIndex = 0;
};

/**
 * Request microphone permission (works on both iOS and Android)
 */
export const requestMicrophonePermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'VoiceVault needs access to your microphone to detect your vocal range.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      // iOS: Use Expo's Audio API to request permission
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    }
  } catch (error) {
    console.error('Error requesting microphone permission:', error);
    return false;
  }
};

/**
 * Mock pitch detection function (extracted for reuse)
 */
const startMockPitchDetection = (
  onPitchDetected: (result: PitchResult) => void,
  isRunning: () => boolean
): (() => void) => {
  const mockFrequencies = [
    // First 35 samples: E2 (for LOW note recording)
    82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 82.41,
    82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 82.41,
    82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 82.41,
    82.41, 82.41, 82.41, 82.41, 82.41,
    // Next 35 samples: C5 (for HIGH note recording)
    523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 523.25,
    523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 523.25,
    523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 523.25, 523.25,
    523.25, 523.25, 523.25, 523.25, 523.25,
  ];
  
  const interval = setInterval(() => {
    if (!isRunning()) return;
    
    // Add slight realistic pitch variation (vibrato)
    const baseFrequency = mockFrequencies[mockDataIndex % mockFrequencies.length];
    const frequency = baseFrequency + (Math.random() - 0.5) * 2; // ±1 Hz variation
    const noteData = frequencyToNote(frequency);
    
    if (noteData) {
      onPitchDetected({
        frequency,
        note: noteData.note,
        octave: noteData.octave,
        confidence: 0.92 + Math.random() * 0.08,
        timestamp: Date.now(),
      });
    }
    
    mockDataIndex++;
  }, 150); // Update every 150ms
  
  return () => {
    if (interval) clearInterval(interval);
  };
};

/**
 * Start continuous pitch detection using react-native-pitch-detector
 * Returns a function to stop detection
 * 
 * @param onPitchDetected - Callback when pitch is detected
 * @param onError - Callback when error occurs
 * @param forceMock - Force use of mock data (for demo/testing purposes)
 */
export const startPitchDetection = (
  onPitchDetected: (result: PitchResult) => void,
  onError: (error: Error) => void,
  forceMock: boolean = false
): (() => void) => {
  // This will be replaced with actual native module implementation
  // For now, we'll use a mock for UI testing
  
  let isRunning = true;
  let interval: NodeJS.Timeout;

  // Use mock data if forced or in development mode when native module unavailable
  if (forceMock) {
    console.log('Using mock pitch detection (demo mode enabled)');
    return startMockPitchDetection(onPitchDetected, () => isRunning);
  }

  // Check if native module is available
  try {
    // @ts-ignore - Native module not yet imported
    const { PitchDetector } = require('react-native-pitch-detector');
    
    if (!PitchDetector) {
      throw new Error('PitchDetector module not found');
    }
    
    // Add listener for pitch detection results
    const subscription = PitchDetector.addListener((result: { frequency: number; tone: string }) => {
      if (!isRunning) return;
      
      const noteData = frequencyToNote(result.frequency);
      
      if (noteData) {
        onPitchDetected({
          frequency: result.frequency,
          note: noteData.note,
          octave: noteData.octave,
          confidence: 0.9, // Library doesn't provide confidence, assume high
          timestamp: Date.now(),
        });
      }
    });
    
    // Start pitch detection
    PitchDetector.start()
      .then(() => {
        console.log('Pitch detection started successfully');
      })
      .catch((startError: any) => {
        console.error('Failed to start pitch detector:', startError);
        onError(new Error('Failed to start microphone: ' + startError.message));
      });
    
    return () => {
      isRunning = false;
      PitchDetector.stop().catch((err: any) => console.error('Error stopping detector:', err));
      PitchDetector.removeListener();
    };
  } catch (error) {
    // In dev mode, silently use mock data (native modules not available in Expo Go)
    if (__DEV__) {
      // Only log once to avoid spam
      if (!global.__pitchDetectorWarningShown) {
        console.log('📱 Expo Go detected - using mock pitch data. Build with expo-dev-client for real microphone access.');
        global.__pitchDetectorWarningShown = true;
      }
      return startMockPitchDetection(onPitchDetected, () => isRunning);
    } else {
      // Production mode: show proper error to user
      console.error('Pitch detector native module failed to load:', error);
      onError(new Error('Microphone access unavailable. Please ensure microphone permissions are granted and the app is up to date.'));
      return () => {};
    }
  }
};
