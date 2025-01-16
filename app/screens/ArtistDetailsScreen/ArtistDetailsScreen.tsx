// app/screens/ArtistDetailsScreen/ArtistDetailsScreen.tsx

import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { searchSongsByQuery } from "../../util/api";

export const ArtistDetailsScreen = ({ route }: any) => {
  const { name } = route.params;
  const [songs, setSongs] = useState<any[]>([]);
  const [overallRange, setOverallRange] = useState<string | null>(null);

  useEffect(() => {
    const fetchSongs = async () => {
      const allSongs = await searchSongsByQuery("");
      const artistSongs = allSongs.filter((song) => song.artist === name);

      setSongs(artistSongs);

      if (artistSongs.length > 0) {
        const { lowestNote, highestNote } = calculateOverallRange(artistSongs);
        setOverallRange(`${lowestNote} - ${highestNote}`);
      } else {
        setOverallRange(null);
      }
    };

    fetchSongs();
  }, [name]);

  const calculateOverallRange = (songs: any[]) => {
    const noteToValue = (note: string): number => {
      const scale: { [key: string]: number } = {
        C: 0,
        D: 2,
        E: 4,
        F: 5,
        G: 7,
        A: 9,
        B: 11,
      };
      const octave = parseInt(note.slice(-1), 10);
      const key = note.slice(0, -1);
      return scale[key] + (octave + 1) * 12;
    };

    const valueToNote = (value: number): string => {
      const scale = [
        "C",
        "C#",
        "D",
        "D#",
        "E",
        "F",
        "F#",
        "G",
        "G#",
        "A",
        "A#",
        "B",
      ];
      const note = scale[value % 12];
      const octave = Math.floor(value / 12) - 1;
      return `${note}${octave}`;
    };

    let minValue = Infinity;
    let maxValue = -Infinity;

    songs.forEach((song) => {
      const [minNote, maxNote] = song.vocalRange.split(" - ").map(noteToValue);
      if (minNote < minValue) minValue = minNote;
      if (maxNote > maxValue) maxValue = maxNote;
    });

    return {
      lowestNote: valueToNote(minValue),
      highestNote: valueToNote(maxValue),
    };
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      {overallRange && (
        <Text style={styles.overallRange}>
          Overall Vocal Range: {overallRange}
        </Text>
      )}

      {songs.length > 0 && <Text style={styles.title}>Songs:</Text>}

      <FlatList
        data={songs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Text style={styles.songItem}>
            {item.name} - {item.vocalRange}
          </Text>
        )}
      />
      {!songs.length && (
        <Text style={styles.noSongsText}>
          No songs available for this artist.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  overallRange: { fontSize: 18, color: "blue", marginBottom: 20 },
  songItem: { fontSize: 18, marginVertical: 5 },
  noSongsText: {
    fontSize: 16,
    color: "gray",
    marginTop: 20,
    textAlign: "center",
  },
});
