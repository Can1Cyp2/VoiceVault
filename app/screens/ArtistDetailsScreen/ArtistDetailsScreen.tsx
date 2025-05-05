// app/screens/ArtistDetailsScreen/ArtistDetailsScreen.tsx

import { useNavigation, NavigationProp } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../../util/supabase";
import { RootStackParamList } from "../../navigation/StackNavigator";
import { noteToValue } from "../SongDetailsScreen/RangeBestFit";

export const ArtistDetailsScreen = ({ route }: any) => {
  const { name } = route.params;
  const [songs, setSongs] = useState<any[]>([]);
  const [overallRange, setOverallRange] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRange, setUserRange] = useState<{ min_range: string; max_range: string } | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const indicatorRef = useRef<View>(null);

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  // Set the header options and check login status
  useEffect(() => {
    navigation.setOptions({
      headerRight: undefined,
    });

    const checkLoginStatus = async () => {
      const session = supabase.auth.session();
      setIsLoggedIn(!!session);

      supabase.auth.onAuthStateChange((_event, session) => {
        setIsLoggedIn(!!session);
      });
    };

    // Fetch user vocal range:
    // This function fetches the user's vocal range from the database and updates the state
    const fetchUserVocalRange = async () => {
      try {
        const user = supabase.auth.user();
        if (!user) {
          setUserRange(null);
          return;
        }
        const { data, error: rangeError } = await supabase
          .from("user_vocal_ranges")
          .select("min_range, max_range")
          .eq("user_id", user.id)
          .single();
        if (!rangeError && data) {
          setUserRange(data);
        } else {
          setUserRange(null);
        }
      } catch (err) {
        console.error("Error fetching vocal range:", err);
        setUserRange(null);
      }
    };

    checkLoginStatus();
    fetchUserVocalRange();
  }, []);

  useEffect(() => {
    /**
     * Fetches songs by the given artist name from the database.
     * Updates the component state with the fetched songs and overall range.
     * If there is an error, sets songs to an empty array and overall range to null.
     * Sets loading to false when done.
     */
    const fetchSongs = async () => {
      setLoading(true);
      const { data: artistSongs, error } = await supabase
        .from("songs")
        .select("*")
        .ilike("artist", name);

      if (!error && artistSongs && artistSongs.length > 0) {
        setSongs(artistSongs);
        const { lowestNote, highestNote } = calculateOverallRange(artistSongs);
        setOverallRange(`${lowestNote} - ${highestNote}`);
      } else {
        setSongs([]);
        setOverallRange(null);
      }
      setLoading(false);
    };

    fetchSongs();
  }, [name]);

  // Function to calculate the overall vocal range of the artist based on their songs
  const calculateOverallRange = (songs: any[]) => {
    const scale: { [key: string]: number } = {
      C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
    };

    // Function to convert note to its corresponding value
    const noteToValue = (note: string): number => {
      const match = note.match(/^([A-G]#?)(\d+)$/);
      if (!match) return NaN;
      const [, key, octave] = match;
      return scale[key] + (parseInt(octave, 10) + 1) * 12;
    };

    // Function to convert value back to note:
    // converts a value back to its corresponding note and octave
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
      if (!isNaN(minNote) && minNote < minValue) minValue = minNote;
      if (!isNaN(maxNote) && maxNote > maxValue) maxValue = maxNote;
    });

    if (minValue === Infinity || maxValue === -Infinity) {
      return { lowestNote: "N/A", highestNote: "N/A" };
    }

    return { lowestNote: valueToNote(minValue), highestNote: valueToNote(maxValue) };
  };

  // Function to compare user range with overall range:
  const getRangeComparison = () => {
    if (!userRange || !overallRange || userRange.min_range === "C0" || userRange.max_range === "C0") {
      return { color: "gray", minDiff: 0, maxDiff: 0, reason: "No user range set" };
    }

    const userMin = noteToValue(userRange.min_range);
    const userMax = noteToValue(userRange.max_range);
    const [artistMin, artistMax] = overallRange.split(" - ").map(noteToValue);

    if (isNaN(userMin) || isNaN(userMax) || isNaN(artistMin) || isNaN(artistMax)) {
      return { color: "gray", minDiff: 0, maxDiff: 0, reason: "Invalid range data" };
    }

    const minDiff = artistMin - userMin;
    const maxDiff = artistMax - userMax;
    const isWithinRange = artistMin >= userMin && artistMax <= userMax;
    if (isWithinRange) {
      return { color: "green", minDiff: 0, maxDiff: 0, reason: " ~ Within your range" };
    }

    const closestDiff = Math.min(Math.abs(minDiff), Math.abs(maxDiff));
    const isClose = closestDiff <= 3;
    return { color: isClose ? "yellow" : "red", minDiff, maxDiff, reason: isClose ? " ~ Close to your range" : " ~ Outside your range" };
  };

  // Function to render tooltip:
  // displays the differences between the user's range and the artist's range
  const renderTooltip = () => {
    const { minDiff, maxDiff, reason } = getRangeComparison();
    if (!showTooltip) return null;

    const userMin = noteToValue(userRange!.min_range);
    const userMax = noteToValue(userRange!.max_range);
    const [artistMinNote, artistMaxNote] = overallRange!.split(" - ");
    const artistMin = noteToValue(artistMinNote);
    const artistMax = noteToValue(artistMaxNote);

    // Initialize tooltip text
    let lowText = "In range";
    let highText = "In range";

    if (artistMin < userMin) {
      lowText = `${minDiff} notes lower than your range`;
    } else if (artistMin > userMax) {
      lowText = `+${minDiff} notes higher than your range`;
    }

    if (artistMax > userMax) {
      highText = `+${maxDiff} notes higher than your range`;
    } else if (artistMax < userMin) {
      highText = `${maxDiff} notes lower than your range`;
    }

    return (
      <View style={[styles.tooltip, { borderColor: "#ff5722" }]}>
        <Text style={styles.tooltipText}>Low: {lowText}</Text>
        <Text style={styles.tooltipText}>High: {highText}</Text>
        <Text style={styles.tooltipText}>{reason}</Text>
        <View style={[styles.tooltipArrow, { borderTopColor: "#ff5722" }]} />
      </View>
    );
  };


  // Function to handle song press:
  // navigates to the song details screen with the selected song's details
  const handleSongPress = (song: any) => {
    navigation.navigate("Details", {
      name: song.name,
      artist: song.artist,
      vocalRange: song.vocalRange,
    });
  };

  // render the header:
  const renderHeader = () => {
    const { color } = getRangeComparison();

    return (
      <View style={styles.headerContainer}>
        <Text style={styles.title}>{name}</Text>
        {overallRange && (
          <View style={styles.card}>
            <Text style={styles.overallRange}>Overall Vocal Range: {overallRange}</Text>
            {userRange && userRange.min_range !== "C0" && userRange.max_range !== "C0" && (
              <View style={styles.rangeContainer}>
                <Text style={styles.personalRange}>
                  Your Range: {userRange.min_range} - {userRange.max_range}
                </Text>
                <TouchableOpacity
                  ref={indicatorRef}
                  style={[styles.rangeIndicator, { backgroundColor: color }]}
                  onPress={() => setShowTooltip((prev) => !prev)}
                />
                {renderTooltip()}
              </View>
            )}
          </View>
        )}
        {songs.length > 0 && <Text style={styles.subtitle}>Songs:</Text>}
      </View>
    );
  };

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
  rangeContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  rangeIndicator: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    marginLeft: 10,
  },
  tooltip: {
    position: "absolute",
    top: 20,
    right: -10,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
  },
  tooltipText: {
    fontSize: 14,
    color: "#333",
  },
  tooltipArrow: {
    position: "absolute",
    top: -6,
    right: 150,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#ff5722",
  },
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