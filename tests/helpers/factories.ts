/**
 * Test data factories.
 *
 * Builders for the domain objects tests need most often: songs (as stored in
 * the Supabase `songs` table) and pitch samples (as produced by the pitch
 * detector at ~150ms intervals).
 */

import type { PitchResult } from "../../app/util/pitchDetection";

export interface TestSong {
  id: number;
  name: string;
  artist: string;
  vocalRange: string;
  [key: string]: any;
}

let nextSongId = 1;

/** Reset the auto-incrementing song id. Call from beforeEach. */
export const resetSongIds = (): void => {
  nextSongId = 1;
};

export const makeSong = (overrides: Partial<TestSong> = {}): TestSong => ({
  id: nextSongId++,
  name: "Untitled Song",
  artist: "Unknown Artist",
  vocalRange: "C3 - G4",
  ...overrides,
});

export const makePitchSample = (
  frequency: number,
  note: string,
  octave: number,
  overrides: Partial<PitchResult> = {}
): PitchResult => ({
  frequency,
  note,
  octave,
  confidence: 0.95,
  timestamp: Date.now(),
  ...overrides,
});

export interface SungSegment {
  note: string;
  octave: number;
  frequency: number;
  /** Number of consecutive samples (~150ms each; 13 ≈ 2s, 27 ≈ 4s). */
  count: number;
}

/**
 * Build a stream of pitch samples from consecutive sung segments, e.g.
 * `singNotes({ note: "E", octave: 2, frequency: 82.41, count: 35 })`.
 */
export const singNotes = (...segments: SungSegment[]): PitchResult[] =>
  segments.flatMap(({ note, octave, frequency, count }) =>
    Array.from({ length: count }, () => makePitchSample(frequency, note, octave))
  );
