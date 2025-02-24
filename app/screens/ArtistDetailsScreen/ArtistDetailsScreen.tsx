// app/screens/ArtistDetailsScreen/ArtistDetailsScreen.tsx

import { useNavigation, NavigationProp  } from "@react-navigation/native";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "../../util/supabase";
import { Ionicons } from "@expo/vector-icons";
import { NOTES } from "../ProfileScreen/EditProfileModal";
import { RootStackParamList } from "../../navigation/StackNavigator";

export const ArtistDetailsScreen = ({ route }: any) => {
  const { name } = route.params;
  const [songs, setSongs] = useState<any[]>([]);
  const [overallRange, setOverallRange] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRange, setUserRange] = useState<{ min_range: string; max_range: string } | null>(null);

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

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

    const fetchUserVocalRange = async () => {
      const { data: user, error } = await supabase.auth.getUser();
      if (error || !user || !user.user) return;

      const { data, error: rangeError } = await supabase
        .from("user_vocal_ranges")
        .select("min_range, max_range")
        .eq("user_id", user.user.id)
        .single();

      if (!rangeError) setUserRange(data);
    };

    checkLoginStatus();
    fetchUserVocalRange();
  }, []);

  useEffect(() => {
    const fetchSongs = async () => {
      setLoading(true);
      const { data: artistSongs, error } = await supabase
        .from("songs")
        .select("*")
        .ilike("artist", name);

      if (!error && artistSongs) {
        setSongs(artistSongs);
        const { lowestNote, highestNote } = calculateOverallRange(artistSongs);
        setOverallRange(`${lowestNote} - ${highestNote}`);
      }
      setLoading(false);
    };

    fetchSongs();
  }, [name]);

  const calculateOverallRange = (songs: any[]) => {
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
      const match = note.match(/^([A-G]#?)(\d+)$/);
      if (!match) return NaN;
      const [, key, octave] = match;
      return scale[key] + (parseInt(octave, 10) + 1) * 12;
    };

    const valueToNote = (value: number): string => {
      const scaleArray = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      const note = scaleArray[value % 12];
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

    return { lowestNote: valueToNote(minValue), highestNote: valueToNote(maxValue) };
  };
  const handleSongPress = (song: any) => {
    navigation.navigate("Details", {
        name: song.name,
        artist: song.artist,
        vocalRange: song.vocalRange,
    });
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.title}>{name}</Text>

      {overallRange && (
        <View style={styles.card}>
          <Text style={styles.overallRange}>Overall Vocal Range: {overallRange}</Text>

          {userRange && userRange.min_range !== "C0" && userRange.max_range !== "C0" && (
            <Text style={styles.personalRange}>
              Your Range: {userRange.min_range} - {userRange.max_range}
            </Text>
          )}
        </View>
      )}

      {songs.length > 0 && <Text style={styles.subtitle}>Songs:</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="tomato" />
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleSongPress(item)}>
              <View style={styles.songCard}>
                <Text style={styles.songTitle}>{item.name}</Text>
                <Text style={styles.songRange}>{item.vocalRange}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListHeaderComponent={renderHeader}
        />
      )}
    </View>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff", padding: 10 },
  headerContainer: { paddingBottom: 20 },
  title: { fontSize: 32, fontWeight: "bold", color: "#ff5722", marginBottom: 10 },
  subtitle: { fontSize: 24, color: "#000000", marginVertical: 10 },
  card: {
    backgroundColor: "#f5f5f5",
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    borderColor: "#ff5722",
    borderWidth: 1,
  },
  overallRange: { fontSize: 20, color: "#000000", marginBottom: 10 },
  personalRange: { fontSize: 18, color: "#ff5722", fontWeight: "600" },
  songCard: {
    backgroundColor: "#ffffff",
    padding: 15,
    borderRadius: 8,
    marginVertical: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderColor: "#ff5722",
    borderWidth: 1,
  },
  songTitle: { fontSize: 18, color: "#000000" },
  songRange: { fontSize: 16, color: "#555555" },
});

