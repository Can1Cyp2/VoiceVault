// Type declarations for react-native-pitch-detector

declare module 'react-native-pitch-detector' {
  export interface PitchDetectorOptions {
    sampleRate?: number;
    bufferSize?: number;
    onPitchDetected: (frequency: number, confidence: number) => void;
    onError: (error: string) => void;
  }

  export default class PitchDetector {
    start(options: PitchDetectorOptions): void;
    stop(): void;
  }
}
