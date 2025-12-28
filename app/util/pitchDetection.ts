// app/util/pitchDetection.ts

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
 * Start continuous pitch detection using react-native-pitch-detector
 * Returns a function to stop detection
 * 
 * Note: This is a placeholder interface. The actual implementation
 * will use the native module after EAS build.
 */
export const startPitchDetection = (
  onPitchDetected: (result: PitchResult) => void,
  onError: (error: Error) => void
): (() => void) => {
  // This will be replaced with actual native module implementation
  // For now, we'll use a mock for UI testing
  
  let isRunning = true;
  let interval: NodeJS.Timeout;

  // Check if native module is available
  try {
    // @ts-ignore - Native module not yet imported
    const PitchDetector = require('react-native-pitch-detector').default;
    
    const detector = new PitchDetector();
    
    detector.start({
      sampleRate: 22050,
      bufferSize: 2048,
      onPitchDetected: (frequency: number, confidence: number) => {
        if (!isRunning) return;
        
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
      onError: (error: any) => {
        onError(new Error(error));
      },
    });
    
    return () => {
      isRunning = false;
      detector.stop();
    };
  } catch (error) {
    // Only use mock data in development mode
    if (__DEV__) {
      console.warn('Native pitch detector not available, using mock data for testing');
      
      // Mock pitch detection - simulates realistic singing with LONG sustained notes
      // Array is structured so first recording gets LOW notes, second gets HIGH notes
      // Each 5-second recording captures ~33 samples (5000ms / 150ms)
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
      
      interval = setInterval(() => {
        if (!isRunning) return;
        
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
        isRunning = false;
        if (interval) clearInterval(interval);
      };
    } else {
      // Production mode: show proper error
      console.error('Pitch detector native module failed to load:', error);
      onError(new Error('Microphone access unavailable. Please ensure microphone permissions are granted.'));
      return () => {};
    }
  }
};
