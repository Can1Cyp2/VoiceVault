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

/**
 * Calculate cents difference from perfect pitch
 * Returns how many cents (1/100 of a semitone) the frequency is off from the target note
 * Positive = sharp, Negative = flat
 */
export const calculateCents = (frequency: number): number => {
  if (!frequency || !isFinite(frequency) || frequency <= 0) {
    return 0;
  }

  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  const halfSteps = 12 * Math.log2(frequency / C0);
  const nearestNote = Math.round(halfSteps);
  const cents = Math.round((halfSteps - nearestNote) * 100);
  
  return cents;
};

/**
 * Get the target frequency for a given note and octave
 */
export const getNoteFrequency = (note: string, octave: number): number => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteIndex = notes.indexOf(note);
  if (noteIndex === -1) return 0;
  
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  const halfSteps = octave * 12 + noteIndex;
  
  return C0 * Math.pow(2, halfSteps / 12);
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

    // Import directly from react-native instead of using the library's wrapper
    const { NativeModules, NativeEventEmitter } = require('react-native');

    console.log('📋 [PitchDetection] Available NativeModules:', Object.keys(NativeModules || {}).join(', '));
    console.log('📋 [PitchDetection] PitchDetectorModule exists:', !!NativeModules?.PitchDetectorModule);

    const PitchDetectorModule = NativeModules.PitchDetectorModule;

    if (!PitchDetectorModule) {
      console.error('❌ [PitchDetection] PitchDetectorModule is null/undefined in NativeModules');
      throw new Error('PitchDetectorModule not found in NativeModules');
    }

    console.log('✅ [PitchDetection] Native module found, methods:', Object.keys(PitchDetectorModule));

    // Create event emitter directly
    const pitchEventEmitter = new NativeEventEmitter(PitchDetectorModule);

    console.log('✅ [PitchDetection] NativeEventEmitter created');
    console.log('🎧 [PitchDetection] Adding event listener...');

    // CRITICAL: Store the subscription to properly clean it up later
    let listenerSubscription: { remove: () => void } | null = null;
    let hasStarted = false;
    let isStarting = false;

    // Add listener for pitch detection results BEFORE starting
    try {
      listenerSubscription = pitchEventEmitter.addListener('data', (result: { frequency: number; tone: string }) => {
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
        }
      });
      console.log('✅ [PitchDetection] Listener added successfully, subscription stored');
    } catch (listenerError: any) {
      console.error('❌ [PitchDetection] Failed to add listener:', listenerError);
      Sentry.captureException(listenerError, {
        tags: { component: 'PitchDetection', function: 'addListener' },
      });
      throw new Error('Failed to add pitch listener: ' + (listenerError?.message || listenerError));
    }

    // Cleanup helper function to ensure proper resource release
    const cleanupResources = () => {
      console.log('🧹 [PitchDetection] Cleaning up resources...');

      // Remove listener using the stored subscription
      if (listenerSubscription) {
        try {
          listenerSubscription.remove();
          console.log('✅ [PitchDetection] Listener subscription removed');
        } catch (err) {
          console.error('⚠️ [PitchDetection] subscription.remove() error:', err);
        }
        listenerSubscription = null;
      }

      // Also remove all listeners as a fallback
      try {
        pitchEventEmitter.removeAllListeners('data');
        console.log('✅ [PitchDetection] All event listeners removed');
      } catch (err) {
        // This may fail if subscription.remove() already cleaned up, which is fine
        console.log('ℹ️ [PitchDetection] removeAllListeners fallback:', err);
      }
    };

    // Platform-specific config for the pitch detector
    // Using minimal config - let native modules handle defaults
    const config = Platform.OS === 'ios' 
      ? { algorithm: 'YIN', bufferSize: 1024 }
      : { algorithm: 'YIN' }; // Android will use native defaults

    // Start pitch detection (async)
    console.log(`🎤 [PitchDetection] Starting microphone on ${Platform.OS} with config:`, config);
    isStarting = true;

    (async () => {
      try {
        console.log('🎤 [PitchDetection] Calling PitchDetectorModule.start()...');
        await PitchDetectorModule.start(config);
        hasStarted = true;
        isStarting = false;
        console.log('✅ [PitchDetection] Microphone started successfully');

        // Check if cleanup was requested while starting
        if (!isRunning) {
          console.log('⚠️ [PitchDetection] Cleanup requested during start, stopping now...');
          try {
            await PitchDetectorModule.stop();
          } catch (stopErr) {
            console.error('⚠️ [PitchDetection] Stop after late cleanup error:', stopErr);
          }
          cleanupResources();
        }
      } catch (startError: any) {
        isStarting = false;
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
          await Sentry.flush(); // Flush all pending events
          console.log('📤 [PitchDetection] Sentry events flushed');
        } catch (flushError) {
          console.error('⚠️ [PitchDetection] Sentry flush error:', flushError);
        }

        isRunning = false;
        cleanupResources();

        const errorMessage = `Microphone failed to start.\n\nError: ${startError?.message || startError}\n\nCode: ${startError?.code || 'N/A'}`;
        onError(new Error(errorMessage));
      }
    })();

    return () => {
      console.log('🛑 [PitchDetection] Cleanup called, hasStarted:', hasStarted, 'isStarting:', isStarting);
      isRunning = false;

      // Only call stop() if we actually started successfully
      if (hasStarted) {
        PitchDetectorModule.stop()
          .then(() => console.log('✅ [PitchDetection] Stopped successfully'))
          .catch((err: any) => console.error('⚠️ [PitchDetection] Stop error:', err))
          .finally(() => cleanupResources());
      } else if (isStarting) {
        // Start is in progress, cleanup will happen when start completes/fails
        console.log('⏳ [PitchDetection] Start in progress, cleanup will happen after start completes');
      } else {
        // Never started, just clean up the listener
        cleanupResources();
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
      if (!(global as any).__pitchDetectorWarningShown) {
        console.log('📱 Expo Go detected - using mock pitch data. Build with expo-dev-client for real microphone access.');
        (global as any).__pitchDetectorWarningShown = true;
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
