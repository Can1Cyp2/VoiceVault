// app/util/pitchDetection.ts

import { Platform, PermissionsAndroid } from 'react-native';
import { Audio } from 'expo-av';
import * as Sentry from '@sentry/react-native';

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
  // Validate input
  if (!frequency || !isFinite(frequency) || frequency <= 0) {
    return null;
  }
  
  if (frequency < VALID_VOCAL_RANGE.minFrequency || frequency > VALID_VOCAL_RANGE.maxFrequency) {
    return null;
  }

  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  const halfSteps = 12 * Math.log2(frequency / C0);
  
  // Check for invalid calculations
  if (!isFinite(halfSteps)) {
    return null;
  }
  
  const noteNumber = Math.round(halfSteps);
  
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(noteNumber / 12);
  const noteIndex = ((noteNumber % 12) + 12) % 12; // Ensure positive index
  const note = notes[noteIndex];
  
  // Final validation
  if (!note || !isFinite(octave)) {
    return null;
  }
  
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
    console.log('🔍 [PitchDetection] Attempting to load native module...');
    const { PitchDetector } = require('react-native-pitch-detector');
    
    if (!PitchDetector) {
      console.error('❌ [PitchDetection] PitchDetector object is null/undefined');
      throw new Error('PitchDetector module not found');
    }
    
    console.log('✅ [PitchDetection] Native module loaded successfully');
    console.log('🎧 [PitchDetection] Adding event listener...');
    
    // Add listener for pitch detection results BEFORE starting
    try {
      PitchDetector.addListener((result: { frequency: number; tone: string }) => {
        // CRITICAL: Wrap callback in try/catch to prevent unhandled exceptions
        try {
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
        } catch (callbackError: any) {
          console.error('❌ [PitchDetection] Listener callback error:', callbackError);
          // Send to Sentry for tracking
          Sentry.captureException(callbackError, {
            tags: {
              component: 'PitchDetection',
              function: 'listenerCallback',
            },
            extra: {
              frequency: result?.frequency,
              tone: result?.tone,
              isRunning,
            },
          });
          // Don't propagate - just log it to avoid crash
        }
      });
      console.log('✅ [PitchDetection] Listener added successfully');
    } catch (listenerError: any) {
      console.error('❌ [PitchDetection] Failed to add listener:', listenerError);
      Sentry.captureException(listenerError, {
        tags: { component: 'PitchDetection', function: 'addListener' },
      });
      throw new Error('Failed to add pitch listener: ' + (listenerError?.message || listenerError));
    }
    
    // Start pitch detection (async)
    console.log('🎤 [PitchDetection] Starting microphone...');
    (async () => {
      try {
        console.log('🎤 [PitchDetection] Calling PitchDetector.start()...');
        await PitchDetector.start();
        console.log('✅ [PitchDetection] Microphone started successfully');
      } catch (startError: any) {
        console.error('❌ [PitchDetection] Start failed:', {
          message: startError?.message,
          code: startError?.code,
          name: startError?.name,
          stack: startError?.stack,
          fullError: JSON.stringify(startError, null, 2)
        });
        
        // Send to Sentry and force flush immediately
        Sentry.captureException(startError, {
          tags: {
            component: 'PitchDetection',
            function: 'start',
          },
          extra: {
            errorCode: startError?.code,
            errorName: startError?.name,
          },
        });
        
        // Try to flush Sentry events immediately
        try {
          await Sentry.flush(2000); // Wait up to 2 seconds
          console.log('📤 [PitchDetection] Sentry events flushed');
        } catch (flushError) {
          console.error('⚠️ [PitchDetection] Sentry flush error:', flushError);
        }
        
        isRunning = false;
        try {
          PitchDetector.removeListener();
        } catch (cleanupError) {
          console.error('⚠️ [PitchDetection] Cleanup error:', cleanupError);
        }
        
        const errorMessage = `Microphone failed to start.\n\nError: ${startError?.message || startError}\n\nCode: ${startError?.code || 'N/A'}`;
        onError(new Error(errorMessage));
      }
    })();
    
    return () => {
      console.log('🛑 [PitchDetection] Cleanup called');
      isRunning = false;
      PitchDetector.stop()
        .then(() => console.log('✅ [PitchDetection] Stopped successfully'))
        .catch((err: any) => console.error('⚠️ [PitchDetection] Stop error:', err));
      try {
        PitchDetector.removeListener();
        console.log('✅ [PitchDetection] Listener removed');
      } catch (err) {
        console.error('⚠️ [PitchDetection] removeListener error:', err);
      }
    };
  } catch (error: any) {
    console.error('🚨 [PitchDetection] Module load failed:', {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      isDev: __DEV__,
      fullError: JSON.stringify(error, null, 2)
    });
    
    // In dev mode, silently use mock data (native modules not available in Expo Go)
    if (__DEV__) {
      // Only log once to avoid spam
      if (!global.__pitchDetectorWarningShown) {
        console.log('📱 Expo Go detected - using mock pitch data. Build with expo-dev-client for real microphone access.');
        global.__pitchDetectorWarningShown = true;
      }
      return startMockPitchDetection(onPitchDetected, () => isRunning);
    } else {
      // Production mode: show detailed error to user for debugging
      const errorDetails = `Module failed to load in production.\n\nError: ${error?.message || 'Unknown'}\nType: ${error?.name || 'N/A'}\nCode: ${error?.code || 'N/A'}`;
      console.error('❌ [PitchDetection] PRODUCTION ERROR:', errorDetails);
      onError(new Error(errorDetails));
      return () => {};
    }
  }
};
