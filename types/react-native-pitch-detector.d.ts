// Type declarations for react-native-pitch-detector

declare module 'react-native-pitch-detector' {
  export interface PitchDetectorResult {
    frequency: number;
    tone: string;
  }

  export interface PitchDetectorSubscription {
    remove: () => void;
  }

  export namespace PitchDetector {
    function start(): Promise<void>;
    function stop(): Promise<void>;
    function isRecording(): Promise<boolean>;
    function addListener(callback: (result: PitchDetectorResult) => void): PitchDetectorSubscription;
    function removeListener(): void;
  }
}
