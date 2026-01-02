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
 * 1. Filter out outliers (bottom/top 5%)
 * 2. Find most common low frequency (mode in lowest quartile)
 * 3. Find most common high frequency (mode in highest quartile)
 * 4. Convert to note names
 */
export const analyzeVocalRange = (
  pitchSamples: PitchResult[],
  type: 'lowest' | 'highest'
): { note: string; frequency: number; confidence: number } | null => {
  if (pitchSamples.length < 10) {
    return null; // Not enough data
  }

  // Sort by frequency
  const sorted = [...pitchSamples].sort((a, b) => a.frequency - b.frequency);
  
  // Remove outliers (bottom and top 10%)
  const trimCount = Math.floor(sorted.length * 0.1);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  
  if (trimmed.length < 5) {
    return null;
  }

  // Get target quartile
  const quartile = type === 'lowest' 
    ? trimmed.slice(0, Math.floor(trimmed.length * 0.25))  // Lowest 25%
    : trimmed.slice(Math.ceil(trimmed.length * 0.75));     // Highest 25%
  
  // Find most stable frequency (frequency that appears most)
  const frequencyMap = new Map<number, number>();
  
  quartile.forEach(sample => {
    // Round to nearest Hz for grouping
    const rounded = Math.round(sample.frequency);
    frequencyMap.set(rounded, (frequencyMap.get(rounded) || 0) + 1);
  });
  
  // Find frequency with highest count
  let maxCount = 0;
  let targetFrequency = 0;
  
  frequencyMap.forEach((count, freq) => {
    if (count > maxCount) {
      maxCount = count;
      targetFrequency = freq;
    }
  });
  
  // Calculate confidence based on how consistent the detection was
  const confidence = maxCount / quartile.length;
  
  // Convert to note name
  const noteData = frequencyToNote(targetFrequency);
  if (!noteData) return null;
  
  const note = formatNote(noteData.note, noteData.octave);
  
  return {
    note,
    frequency: targetFrequency,
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
