// File location: app/screens/SearchScreen/SearchScreen.tsx

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/StackNavigator";
import { Ionicons } from "@expo/vector-icons";
import { SearchBar } from "../../components/SearchBar/SearchBar";
import { searchSongsByQuery, getArtists, getRandomSongs, getRandomArtists } from "../../util/api";
import { checkInternetConnection } from "../../util/network";
import { supabase } from "../../util/supabase";
import { calculateOverallRange, noteToValue } from "../../util/vocalRange";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Search">;

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused(); // detect screen focus
  const handleAddPress = () => {
    navigation.navigate("AddSong");
  };

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"songs" | "artists">("songs");
  const [isConnected, setIsConnected] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vocalRange, setVocalRange] = useState<{ min_range: string; max_range: string } | null>(null);
  const [vocalRangeFilterActive, setVocalRangeFilterActive] = useState(false);
  const [endReachedLoading, setEndReachedLoading] = useState(false);

  useEffect(() => {
    const fetchUserVocalRange = async () => {
      try {
        const { data: user, error } = await supabase.auth.getUser();
        if (error || !user?.user) {
          setIsLoggedIn(false);
          setVocalRange(null);
          return;
        }
        setIsLoggedIn(true);
        const { data, error: rangeError } = await supabase
          .from("user_vocal_ranges")
          .select("min_range, max_range")
          .eq("user_id", user.user.id)
          .single();
        if (!rangeError) {
          setVocalRange(data);
        } else {
          setVocalRange(null); // No range set for user
        }
      } catch (err) {
        console.error("Error fetching vocal range:", err);
        setIsLoggedIn(false);
      }
    };

    fetchUserVocalRange();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        setIsLoggedIn(true);
        fetchUserVocalRange();
        fetchResults();
      } else if (event === "SIGNED_OUT") {
        setIsLoggedIn(false);
        setVocalRange(null);
        setVocalRangeFilterActive(false); // Reset filter on sign-out
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Refresh when screen regains focus
  useEffect(() => {
    if (isFocused) {
      fetchResults(); // Refresh results when returning to screen
    }
  }, [isFocused, query, filter]);

  const isSongInRange = (songRange: string) => {
    if (!vocalRange || typeof songRange !== "string") return false;
    const [songMin, songMax] = songRange.split(" - ").map(note => note.trim());
    if (!songMin || !songMax) {
      console.error("Invalid song range format:", songRange);
      return false;
    }
    const songMinIndex = noteToValue(songMin);
    const songMaxIndex = noteToValue(songMax);
    const userMinIndex = noteToValue(vocalRange.min_range);
    const userMaxIndex = noteToValue(vocalRange.max_range);
    if (isNaN(songMinIndex) || isNaN(songMaxIndex) || isNaN(userMinIndex) || isNaN(userMaxIndex)) {
      console.error("Invalid range calculation", { songMin, songMax, userMin: vocalRange.min_range, userMax: vocalRange.max_range });
      return false;
    }
    return songMinIndex >= userMinIndex && songMaxIndex <= userMaxIndex;
  };

  const isArtistInRange = (artist: { name: any; songs: { vocalRange: string }[] }) => {
    if (!vocalRange || !artist.songs || artist.songs.length === 0) return false;
    const { lowestNote, highestNote } = calculateOverallRange(artist.songs);
    const artistMinIndex = noteToValue(lowestNote);
    const artistMaxIndex = noteToValue(highestNote);
    const userMinIndex = noteToValue(vocalRange.min_range);
    const userMaxIndex = noteToValue(vocalRange.max_range);
    if (isNaN(artistMinIndex) || isNaN(artistMaxIndex) || isNaN(userMinIndex) || isNaN(userMaxIndex)) {
      console.error("Invalid range calculation", {
        artist: artist.name,
        lowestNote,
        highestNote,
        userMin: vocalRange.min_range,
        userMax: vocalRange.max_range,
      });
      return false;
    }
    return artistMinIndex >= userMinIndex && artistMaxIndex <= userMaxIndex;
  };

  // Function to fetch search results and default search screen to random results
  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    const internetAvailable = await checkInternetConnection();
    setIsConnected(internetAvailable ?? false);
    if (!internetAvailable) {
      setLoading(false);
      setError("No internet connection. Please check your network.");
      return;
    }
    try {
      if (filter === "songs") {
        if (query.trim() === "") {
          const randomSongs = await getRandomSongs(50); // Fetch 50 random songs
          setResults(randomSongs);
        } else {
          const songs = await searchSongsByQuery(query); // Fetch search results
          setResults(songs);
        }
      } else if (filter === "artists") {
        if (query.trim() === "") {
          const randomArtists = await getRandomArtists(50); // Fetch 50 random artists
          setResults(randomArtists);
        } else {
          const artists = await getArtists(query); // Fetch search results
          setResults(artists);
        }
      }
    } catch (err) {
      setError("An error occurred while fetching data.");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    fetchResults();
  };

  const handlePress = (item: any) => {
    if (filter === "songs") {
      navigation.navigate("Details", {
        name: item.name,
        artist: item.artist,
        vocalRange: item.vocalRange,
        username: item.username,
      });
    } else if (filter === "artists") {
      navigation.navigate("ArtistDetails", {
        name: item.name,
      });
    }
  };

  const handleInRangePress = () => {
    if (!isLoggedIn) {
      Alert.alert(
        "Login Required",
        "You need to log in to use the 'In Range' filter. Would you like to log in now?",
        [
          {
            text: "Yes",
            onPress: () => navigation.navigate("Home"),
          },
          { text: "No", style: "cancel" },
        ],
        { cancelable: true }
      );
    } else {
      // Toggle filter even if range isn’t set yet, but it only filters if range exists
      setVocalRangeFilterActive((prev) => !prev);
      if (!vocalRange || vocalRange.min_range === "C0" || vocalRange.max_range === "C0") {
        Alert.alert(
          "No Vocal Range Set",
          "You haven’t set your vocal range yet. Please set it in your profile to use this filter."
        );
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
        <SearchBar onSearch={setQuery} />
      </View>
      <View style={styles.filterContainer}>
        <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
          <Ionicons name="add-circle" size={36} color="tomato" />
        </TouchableOpacity>
        <View style={styles.filterButtonsWrapper}>
          <TouchableOpacity
            style={[styles.filterButton, filter === "songs" && styles.activeFilter]}
            onPress={() => setFilter("songs")}
          >
            <Text style={styles.filterText}>Songs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === "artists" && styles.activeFilter]}
            onPress={() => setFilter("artists")}
          >
            <Text style={styles.filterText}>Artists</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButtonRight}
            onPress={handleInRangePress}
          >
            <Ionicons
              name="checkmark-circle"
              size={30}
              color={
                !vocalRange || vocalRange.min_range === "C0" || vocalRange.max_range === "C0"
                  ? "gray"
                  : vocalRangeFilterActive
                    ? "tomato"
                    : "gray"
              }
              style={styles.filterIcon}
            />
            <Text
              style={[
                styles.filterText,
                {
                  fontSize: 10,
                  bottom: 3,
                  color:
                    !vocalRange || vocalRange.min_range === "C0" || vocalRange.max_range === "C0"
                      ? "gray"
                      : vocalRangeFilterActive
                        ? "tomato"
                        : "grey",
                },
              ]}
            >
              In Range
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && <ActivityIndicator size="large" color="tomato" />}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {!loading && results.length === 0 && !error && (
        <Text style={styles.noResultsText}>No results found.</Text>
      )}
      <FlatList
        data={
          vocalRangeFilterActive
            ? filter === "songs"
              ? results.filter((item) => isSongInRange(item.vocalRange))
              : results.filter((item) => isArtistInRange(item))
            : results
        }
        renderItem={({ item }) => {
          if (filter === "songs" && (!item.name || !item.artist || !item.vocalRange)) {
            return null;
          }
          if (filter === "artists" && !item.name) {
            return null;
          }
          return (
            <TouchableOpacity onPress={() => handlePress(item)}>
              <View style={styles.resultItem}>
                <Ionicons
                  name={filter === "songs" ? "musical-notes" : "person"}
                  size={30}
                  style={styles.resultIcon}
                />
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultText}>{item.name}</Text>
                  {filter === "songs" && (
                    <Text style={styles.resultSubText}>
                      {item.artist} • {item.vocalRange}
                    </Text>
                  )}
                </View>
                {vocalRange && (
                  <Ionicons
                    name={
                      filter === "songs"
                        ? isSongInRange(item.vocalRange)
                          ? "checkmark-circle"
                          : "close-circle"
                        : isArtistInRange(item)
                          ? "checkmark-circle"
                          : "close-circle"
                    }
                    size={30}
                    color={
                      filter === "songs"
                        ? isSongInRange(item.vocalRange)
                          ? "tomato"
                          : "grey"
                        : isArtistInRange(item)
                          ? "tomato"
                          : "grey"
                    }
                    style={styles.inRangeIcon}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={async () => {
              if (query.trim() === "") {
                setLoading(true);
                try {
                  if (filter === "songs") {
                    const newSongs = await getRandomSongs(50); // Fetch 50 new random songs
                    setResults(newSongs);
                  } else if (filter === "artists") {
                    const newArtists = await getRandomArtists(50); // Fetch 50 new random artists
                    setResults(newArtists);
                  }
                } catch (err) {
                  setError("An error occurred while loading new content.");
                } finally {
                  setLoading(false);
                }
              }
            }}
            colors={["tomato"]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 30 },
  searchBarContainer: {
    marginTop: 20,
    paddingHorizontal: 10,
  },
  loadingText: { textAlign: "center", marginVertical: 10, color: "gray" },
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  addButton: {
    position: "absolute",
    left: 17,
  },
  filterButtonsWrapper: {
    flexDirection: "row",
    justifyContent: "center",
    flex: 1,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginHorizontal: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f0f0f0",
  },
  activeFilter: { backgroundColor: "tomato", borderColor: "tomato" },
  resultItem: {
    padding: 15,
    marginVertical: 8,
    marginHorizontal: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  resultTextContainer: {
    flex: 1,
  },
  resultText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  resultSubText: {
    fontSize: 14,
    color: "#888",
    marginTop: 2,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: "tomato",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  noResultsText: { textAlign: "center", color: "#555", marginVertical: 20 },
  inRangeIcon: {
    marginLeft: "auto",
  },
  resultIcon: {
    marginRight: 15,
    color: "tomato",
  },
  filterButtonRight: {
    position: "absolute",
    right: 17,
    alignItems: "center",
    zIndex: 10,
  },
  filterIcon: {
    paddingLeft: 15,
    alignSelf: "center",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  loadingFooter: {
    paddingVertical: 10,
  },
  loadingHeader: {
    paddingVertical: 10,
  },
});