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
