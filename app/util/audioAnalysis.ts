// app/util/audioAnalysis.ts

import { PitchResult, frequencyToNote, formatNote } from './pitchDetection';
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
 * 1. Find all occurrences of each note
 * 2. For each occurrence, it must be at least 2 seconds consecutive to count
 * 3. Sum up all valid occurrences - need at least 4 seconds total
 * 4. For low note: pick the lowest note with 4+ total seconds
 * 5. For high note: pick the highest note with 4+ total seconds
 */
export const analyzeVocalRange = (
  pitchSamples: PitchResult[],
  type: 'lowest' | 'highest'
): { note: string; frequency: number; confidence: number } | null => {
  if (pitchSamples.length < 10) {
    return null; // Not enough data
  }

  // Samples come in at ~150ms intervals
  // 2 seconds = ~13 samples (minimum consecutive)
  // 4 seconds total = ~27 samples (minimum total)
  const MIN_CONSECUTIVE_SAMPLES = 13;
  const MIN_TOTAL_SAMPLES = 27;
  
  // Track all occurrences of each note
  interface NoteOccurrence {
    count: number;
    frequencies: number[];
  }
  
  interface ConsecutiveGroup {
    note: string;
    octave: number;
    count: number;
    frequencies: number[];
  }
  
  // First pass: find all consecutive groups
  const consecutiveGroups: ConsecutiveGroup[] = [];
  let currentGroup: ConsecutiveGroup | null = null;
  
  pitchSamples.forEach((sample, index) => {
    const sampleNote = `${sample.note}${sample.octave}`;
    
    if (currentGroup && `${currentGroup.note}${currentGroup.octave}` === sampleNote) {
      // Continue the current group
      currentGroup.count++;
      currentGroup.frequencies.push(sample.frequency);
    } else {
      // Save previous group if it exists
      if (currentGroup) {
        consecutiveGroups.push(currentGroup);
      }
      
      // Start a new group
      currentGroup = {
        note: sample.note,
        octave: sample.octave,
        count: 1,
        frequencies: [sample.frequency],
      };
    }
  });
  
  // Don't forget the last group
  if (currentGroup) {
    consecutiveGroups.push(currentGroup);
  }
  
  // Second pass: aggregate by note, only counting groups >= 2 seconds
  const noteMap = new Map<string, NoteOccurrence>();
  
  consecutiveGroups.forEach(group => {
    if (group.count >= MIN_CONSECUTIVE_SAMPLES) {
      const noteKey = `${group.note}${group.octave}`;
      const existing = noteMap.get(noteKey);
      
      if (existing) {
        existing.count += group.count;
        existing.frequencies.push(...group.frequencies);
      } else {
        noteMap.set(noteKey, {
          count: group.count,
          frequencies: [...group.frequencies],
        });
      }
    }
  });
  
  // Third pass: find notes with at least 4 seconds total
  const validNotes: { note: string; avgFrequency: number; totalCount: number }[] = [];
  
  noteMap.forEach((occurrence, noteKey) => {
    if (occurrence.count >= MIN_TOTAL_SAMPLES) {
      const avgFrequency = occurrence.frequencies.reduce((sum, f) => sum + f, 0) / occurrence.frequencies.length;
      validNotes.push({
        note: noteKey,
        avgFrequency,
        totalCount: occurrence.count,
      });
    }
  });
  
  if (validNotes.length === 0) {
    return null; // No notes sustained long enough
  }
  
  // Pick the appropriate note based on type
  const targetNote = type === 'lowest'
    ? validNotes.reduce((lowest, note) => 
        note.avgFrequency < lowest.avgFrequency ? note : lowest
      )
    : validNotes.reduce((highest, note) => 
        note.avgFrequency > highest.avgFrequency ? note : highest
      );
  
  // Calculate confidence based on total duration
  const confidence = Math.min(targetNote.totalCount / 50, 1.0); // Max confidence at ~7.5 seconds
  
  return {
    note: targetNote.note,
    frequency: targetNote.avgFrequency,
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
  
  // Classify vocal type based on actual vocal ranges
  // Extract octave numbers from notes (e.g., "C2" -> 2, "C#3" -> 3)
  const getOctave = (note: string): number => {
    const match = note.match(/\d+$/);
    return match ? parseInt(match[0]) : 0;
  };
  
  const lowOctave = getOctave(lowestNote);
  const highOctave = getOctave(highestNote);
  
  let classification = 'Unknown';
  
  // Bass: typically E2-E4 (low notes, ending around 4th octave)
  if (lowOctave <= 2 && highOctave <= 4) {
    classification = 'Bass';
  }
  // Baritone: typically A2-A4 (mid-low notes, can reach 4th-5th octave)
  else if (lowOctave <= 2 && highOctave >= 4 && highOctave <= 5) {
    classification = 'Baritone';
  }
  // Tenor: typically C3-C5 (higher male voice, reaching 5th octave)
  else if (lowOctave >= 2 && lowOctave <= 3 && highOctave >= 5 && highOctave <= 6) {
    classification = 'Tenor';
  }
  // Alto: typically F3-F5 (lower female voice)
  else if (lowOctave >= 3 && highOctave >= 5 && highOctave <= 6) {
    classification = 'Alto';
  }
  // Mezzo-Soprano: typically A3-A5 (mid female voice)
  else if (lowOctave >= 3 && highOctave >= 5) {
    classification = 'Mezzo-Soprano';
  }
  // Soprano: typically C4-C6 or higher (highest female voice)
  else if (lowOctave >= 4 && highOctave >= 6) {
    classification = 'Soprano';
  }
  // Countertenor: male voice singing in alto/soprano range (C3-C5 or higher)
  else if (lowOctave >= 3 && highOctave >= 5) {
    classification = 'Countertenor / Alto';
  }
  // Broad ranges that could be multiple types
  else if (lowOctave <= 2 && highOctave >= 5) {
    classification = 'Baritone / Tenor';
  }
  // Very high voices
  else if (highOctave >= 6) {
    classification = 'Soprano / High Voice';
  }
  // Very low voices
  else if (lowOctave <= 2) {
    classification = 'Bass / Low Voice';
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
