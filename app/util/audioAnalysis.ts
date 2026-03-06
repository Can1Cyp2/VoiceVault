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
  
  let classification = 'Unknown';

  const voiceRanges = [
    { label: 'Bass', min: NOTES.indexOf('E2'), max: NOTES.indexOf('E4') },
    { label: 'Baritone', min: NOTES.indexOf('A2'), max: NOTES.indexOf('F4') },
    { label: 'Tenor', min: NOTES.indexOf('C3'), max: NOTES.indexOf('A4') },
    { label: 'Alto', min: NOTES.indexOf('F3'), max: NOTES.indexOf('D5') },
    { label: 'Mezzo-Soprano', min: NOTES.indexOf('A3'), max: NOTES.indexOf('F5') },
    { label: 'Soprano', min: NOTES.indexOf('C4'), max: NOTES.indexOf('A5') },
  ];

  const analyzedRangeCenter = (lowIndex + highIndex) / 2;
  const scoredRanges = voiceRanges
    .filter((range) => range.min !== -1 && range.max !== -1)
    .map((range) => {
      const overlap = Math.max(0, Math.min(highIndex, range.max) - Math.max(lowIndex, range.min) + 1);
      const outsideLow = Math.max(0, range.min - lowIndex);
      const outsideHigh = Math.max(0, highIndex - range.max);
      const outside = outsideLow + outsideHigh;
      const centerDistance = Math.abs(analyzedRangeCenter - (range.min + range.max) / 2);

      const score = overlap * 3 - outside * 2 - centerDistance * 0.5;
      return { ...range, overlap, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scoredRanges.length > 0) {
    const best = scoredRanges[0];
    const second = scoredRanges[1];

    if (best.overlap === 0) {
      if (highIndex >= NOTES.indexOf('C6')) {
        classification = 'Soprano / High Voice';
      } else if (lowIndex <= NOTES.indexOf('E2')) {
        classification = 'Bass / Low Voice';
      }
    } else if (second && Math.abs(best.score - second.score) <= 2 && second.overlap > 0) {
      classification = `${best.label} / ${second.label}`;
    } else {
      classification = best.label;
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
