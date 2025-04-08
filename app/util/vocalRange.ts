// File: app/util/vocalRange.ts

import { supabase } from "./supabase";

// Mapping notes to numerical values (including sharps)
const scale: { [key: string]: number } = {
    C: 0, "C#": 1, D: 2, "D#": 3, E: 4,
    F: 5, "F#": 6, G: 7, "G#": 8,
    A: 9, "A#": 10, B: 11,
};

export const noteToValue = (note: string): number => {
    const match = note.match(/^([A-G]#?)(\d+)$/);
    if (!match) {
        console.error("Invalid note format:", note);
        return NaN;
    }
    const [, key, octave] = match;
    return scale[key] + (parseInt(octave, 10) + 1) * 12;
};

const valueToNote = (value: number): string => {
    const scaleArray = [
        "C", "C#", "D", "D#", "E", "F",
        "F#", "G", "G#", "A", "A#", "B",
    ];
    const note = scaleArray[value % 12];
    const octave = Math.floor(value / 12) - 1;
    return `${note}${octave}`;
};

// Function to calculate the overall vocal range for an artist based on their songs
export const calculateOverallRange = (songs: any[]) => {
    let minValue = Infinity;
    let maxValue = -Infinity;

    songs.forEach((song) => {
        const [minNote, maxNote] = song.vocalRange.split(" - ").map(noteToValue);
        if (!isNaN(minNote) && minNote < minValue) minValue = minNote;
        if (!isNaN(maxNote) && maxNote > maxValue) maxValue = maxNote;
    });

    return {
        lowestNote: valueToNote(minValue),
        highestNote: valueToNote(maxValue),
    };
};

export const getSongsByArtist = async (artistName: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from("songs")
        .select("vocalRange")
        .eq("artist", artistName);
  
      if (error) {
        console.error("Error fetching songs for artist:", artistName, error);
        return [];
      }
  
      // Filter out songs with missing or invalid vocalRange
      return data.filter(song => song.vocalRange && typeof song.vocalRange === "string" && song.vocalRange.includes(" - "));
    } catch (err) {
      console.error("Unexpected error fetching songs for artist:", artistName, err);
      return [];
    }
  };
