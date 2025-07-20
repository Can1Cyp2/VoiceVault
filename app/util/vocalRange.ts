import { supabase } from "./supabase";

export const NOTES = [
    'C0', 'C#0', 'D0', 'D#0', 'E0', 'F0', 'F#0', 'G0', 'G#0', 'A0', 'A#0', 'B0',
    'C1', 'C#1', 'D1', 'D#1', 'E1', 'F1', 'F#1', 'G1', 'G#1', 'A1', 'A#1', 'B1',
    'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
    'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
    'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
    'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5',
    'C6', 'C#6', 'D6', 'D#6', 'E6', 'F6', 'F#6', 'G6', 'G#6', 'A6', 'A#6', 'B6',
    'C7'
];

export const noteToValue = (note: string): number => {
    return NOTES.indexOf(note);
};

// Fetch all songs by a given artist
export const getSongsByArtist = async (artistName: string): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('songs')
            .select('*')
            .eq('artist', artistName);

        if (error) {
            console.error('Error fetching songs by artist:', error.message);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Unexpected error in getSongsByArtist:', err);
        return [];
    }
};

// Calculate the overall vocal range from a list of songs
export const calculateOverallRange = (songs: { vocalRange: string }[]): { lowestNote: string, highestNote: string } => {
    if (!songs || songs.length === 0) {
        return { lowestNote: 'C0', highestNote: 'C0' };
    }

    let minNoteIndex = Infinity;
    let maxNoteIndex = -Infinity;

    songs.forEach(song => {
        if (typeof song.vocalRange !== 'string') return;

        const [low, high] = song.vocalRange.split(' - ');
        if (!low || !high) return;

        const lowIndex = noteToValue(low.trim());
        const highIndex = noteToValue(high.trim());

        if (lowIndex !== -1 && lowIndex < minNoteIndex) {
            minNoteIndex = lowIndex;
        }
        if (highIndex !== -1 && highIndex > maxNoteIndex) {
            maxNoteIndex = highIndex;
        }
    });

    if (minNoteIndex === Infinity || maxNoteIndex === -1) {
        return { lowestNote: 'C0', highestNote: 'C0' };
    }

    return { lowestNote: NOTES[minNoteIndex], highestNote: NOTES[maxNoteIndex] };
};