// app/screens/ArtistDetailsScreen/ArtistDetailsScreen.tsx
import { useNavigation } from "@react-navigation/native";

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { searchSongsByQuery } from "../../util/api";
import { supabase } from "../../util/supabase";
import { Ionicons } from "@expo/vector-icons";

export const ArtistDetailsScreen = ({ route }: any) => {
  const { name } = route.params;
  const [songs, setSongs] = useState<any[]>([]);
  const [overallRange, setOverallRange] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true); // loading state

  const navigation = useNavigation();

  // Check to see if the user is logged in:
  useEffect(() => {
    const checkLoginStatus = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);

      supabase.auth.onAuthStateChange((_event, session) => {
        setIsLoggedIn(!!session);
      });
    };

    checkLoginStatus();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isLoggedIn ? (
          <TouchableOpacity onPress={() => console.log("List Button Clicked")}>
            <Ionicons
              name="add-circle-outline"
              size={30}
              color="#32CD32"
              style={{ marginRight: 15 }}
            />
          </TouchableOpacity>
        ) : null, // Hide button if not logged in
    });
  }, [isLoggedIn, navigation]);

  const fetchSongs = async () => {
    setLoading(true); // Show loading indicator
    const { data: artistSongs, error } = await supabase
      .from("songs")
      .select("*")
      .ilike("artist", name);

    if (error) {
      console.error("Error fetching songs:", error);
    } else {
      console.log(`Fetched songs for artist ${name}:`, artistSongs);
      setSongs(artistSongs || []);

      if (artistSongs.length > 0) {
        const { lowestNote, highestNote } = calculateOverallRange(artistSongs);
        setOverallRange(`${lowestNote} - ${highestNote}`);
      } else {
        setOverallRange(null);
      }
    }
    setLoading(false); // Hide loading indicator
  };

  useEffect(() => {
    fetchSongs();
  }, [name]);

  const calculateOverallRange = (songs: any[]) => {
    // Mapping notes to numerical values (including sharps)
    const scale: { [key: string]: number } = {
      C: 0,
      "C#": 1,
      D: 2,
      "D#": 3,
      E: 4,
      F: 5,
      "F#": 6,
      G: 7,
      "G#": 8,
      A: 9,
      "A#": 10,
      B: 11,
    };

    const noteToValue = (note: string): number => {
      // Extract note and octave
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
      const note = scaleArray[value % 12];
      const octave = Math.floor(value / 12) - 1;
      return `${note}${octave}`;
    };

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#32CD32" style={styles.loader} />
      ) : (
        <>
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
        </>
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
  loader: {
    marginTop: 50,
    alignSelf: "center",
  },
});
