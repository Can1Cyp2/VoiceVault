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
    // Native module not available - use mock for testing UI
    console.warn('Native pitch detector not available, using mock data for testing');
    
    // Mock pitch detection for UI testing
    const mockFrequencies = [
      82.41, 87.31, 92.50, 98.00, 103.83, 110.00, // E2 - A2
      220.00, 246.94, 261.63, 293.66, 329.63, 349.23, // A3 - F4
      440.00, 493.88, 523.25, 587.33, 659.25, 698.46, // A4 - F5
    ];
    
    let index = 0;
    interval = setInterval(() => {
      if (!isRunning) return;
      
      const frequency = mockFrequencies[index % mockFrequencies.length];
      const noteData = frequencyToNote(frequency);
      
      if (noteData) {
        onPitchDetected({
          frequency,
          note: noteData.note,
          octave: noteData.octave,
          confidence: 0.9 + Math.random() * 0.1,
          timestamp: Date.now(),
        });
      }
      
      index++;
    }, 200); // Update every 200ms
    
    return () => {
      isRunning = false;
      if (interval) clearInterval(interval);
    };
  }
};
