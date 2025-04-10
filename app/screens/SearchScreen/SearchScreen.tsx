import React, { useState, useEffect } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/StackNavigator";
import { Ionicons } from "@expo/vector-icons";
import { SearchBar } from "../../components/SearchBar/SearchBar";
import { searchSongsByQuery, searchArtistsByQuery, getRandomSongs } from "../../util/api";
import { checkInternetConnection } from "../../util/network";
import { supabase } from "../../util/supabase";
import { calculateOverallRange, getSongsByArtist, noteToValue } from "../../util/vocalRange";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Search">;

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const handleAddPress = () => {
    navigation.navigate("AddSong");
  };

  const [results, setResults] = useState<any[]>([]);
  const [songsLoading, setSongsLoading] = useState(true);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"songs" | "artists">("songs");
  const [isConnected, setIsConnected] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vocalRange, setVocalRange] = useState<{ min_range: string; max_range: string } | null>(null);
  const [vocalRangeFilterActive, setVocalRangeFilterActive] = useState(false);
  const [endReachedLoading, setEndReachedLoading] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [songsPage, setSongsPage] = useState(1);
  const [hasMoreSongs, setHasMoreSongs] = useState(true);

  const [randomSongs, setRandomSongs] = useState<any[]>([]); // Holds the initial random songs
  const [allSongs, setAllSongs] = useState<any[]>([]); // Holds the current list of songs (random or search results)
  const [allArtists, setAllArtists] = useState<any[]>([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const connected = await checkInternetConnection();
      setIsConnected(connected ?? false);
      if (!connected) {
        setError("No internet connection. Please check your network and try again.");
        setSongsLoading(false);
        setInitialFetchDone(true);
        return;
      }

      setSongsLoading(true);
      try {
        const songs = await getRandomSongs(25);
        setRandomSongs(songs); // Store the initial random songs
        setAllSongs(songs);
        setResults(songs);
        setError(null);
        console.log("Fetched", songs.length, "songs for initial load");

        const artists = await deriveArtistsFromSongs(songs, 20, query);
        setAllArtists(artists);
        console.log("Derived", artists.length, "artists for initial load");
      } catch (err) {
        console.error("Error fetching random songs:", err);
        setError("Failed to load songs: " + (err instanceof Error ? err.message : "Unknown error"));
      } finally {
        setSongsLoading(false);
        setInitialFetchDone(true);
      }
    };
    fetchInitialData();
  }, []);

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
          setVocalRange(null);
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
        setVocalRangeFilterActive(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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

  const isArtistInRange = (artist: { name: string; songs: { vocalRange: string }[] }) => {
    if (!vocalRange || !artist.songs || artist.songs.length === 0) {
      console.log(`No vocal range or songs for artist: ${artist.name}`);
      return false;
    }

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

    const inRange = artistMinIndex >= userMinIndex && artistMaxIndex <= userMaxIndex;
    console.log(`Artist: ${artist.name}, Range: ${lowestNote} - ${highestNote}, User: ${vocalRange.min_range} - ${vocalRange.max_range}, In Range: ${inRange}`);
    return inRange;
  };

  const deriveArtistsFromSongs = async (songs: any[], limit: number = 20, query: string = ""): Promise<any[]> => {
    if (!songs || songs.length === 0) {
      console.log("No songs provided to derive artists");
      return [];
    }

    const artistMap = new Map<string, { name: string; songCount: number }>();
    songs.forEach((song) => {
      if (!song.artist) {
        console.warn("Skipping song with missing artist:", song);
        return;
      }
      const current = artistMap.get(song.artist) || { name: song.artist, songCount: 0 };
      artistMap.set(song.artist, { ...current, songCount: current.songCount + 1 });
    });

    const artists = Array.from(artistMap.values());
    const artistDetails = await Promise.all(
      artists.map(async (artist) => {
        const songs = await getSongsByArtist(artist.name);
        return {
          name: artist.name,
          songs: songs.map(song => ({ vocalRange: song.vocalRange })),
          songCount: artist.songCount,
        };
      })
    );

    // Filter and sort artists
    return artistDetails
      .filter(artist => artist.songs.length > 0)
      .sort((a, b) => {
        // If there's a query, prioritize artists whose names match the query
        if (query) {
          const aMatch = a.name.toLowerCase().includes(query.toLowerCase());
          const bMatch = b.name.toLowerCase().includes(query.toLowerCase());
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
        }
        // Otherwise, sort by song count (descending) and then alphabetically
        return b.songCount - a.songCount || a.name.localeCompare(b.name);
      })
      .slice(0, limit);
  };

  const fetchResults = async (pageNum = 1, append = false) => {
    if (endReachedLoading) return;

    // Set loading states based on the current filter
    if (filter === "songs") {
      setSongsLoading(pageNum === 1);
      setArtistsLoading(false); // Ensure artists loading is off
    } else {
      setArtistsLoading(true);
      setSongsLoading(false); // Ensure songs loading is off
    }
    if (pageNum > 1) setEndReachedLoading(true);
    setError(null);

    const connected = await checkInternetConnection();
    setIsConnected(connected ?? false);
    if (!connected) {
      setError("No internet connection. Please check your network and try again.");
      setSongsLoading(false);
      setArtistsLoading(false);
      if (pageNum > 1) setEndReachedLoading(false);
      return;
    }

    try {
      if (filter === "songs") {
        let newSongs: any[] = [];
        if (query.trim() === "") {
          if (!append) {
            // When query is cleared, restore the initial random songs
            setAllSongs(randomSongs);
            setResults(randomSongs);
            console.log("Restored initial random songs:", randomSongs.length);
            setSongsLoading(false);
            if (pageNum > 1) setEndReachedLoading(false);
            return;
          }
          newSongs = await getRandomSongs(25);
          console.log("Fetched songs for page", pageNum, ":", newSongs.length);
          if (newSongs.length < 25) setHasMoreSongs(false);
        } else {
          newSongs = await searchSongsByQuery(query);
          console.log("Search results for songs query", query, ":", newSongs.length);
          setHasMoreSongs(false);
        }

        if (append) {
          const uniqueSongs = newSongs.filter((song) => !allSongs.some((s) => s.id === song.id));
          setAllSongs((prev) => [...prev, ...uniqueSongs]);
          setResults((prev) => [...prev, ...uniqueSongs]);
        } else {
          setAllSongs(newSongs);
          setResults(newSongs);
        }

        const artists = await deriveArtistsFromSongs(newSongs, 20, query);
        setAllArtists(artists);
        console.log("Derived", artists.length, "artists from songs");
      } else {
        let artists: any[] = [];
        if (query.trim() === "") {
          // When query is empty, always derive artists from randomSongs
          artists = await deriveArtistsFromSongs(randomSongs, 20);
        } else {
          // If there's a query, search artists directly
          artists = await searchArtistsByQuery(query, 20);
        }
        setResults(artists);
        setAllArtists(artists);
        console.log("Fetched", artists.length, "artists for display");
      }
      setError(null);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(`Unable to load ${filter}. Please try again later.`);
    } finally {
      setSongsLoading(false);
      setArtistsLoading(false);
      if (pageNum > 1) setEndReachedLoading(false);
    }
  };

  useEffect(() => {
    console.log("Query or filter changed:", { query, filter });
    // Reset loading states when query or filter changes to ensure a fresh fetch
    setSongsLoading(false);
    setArtistsLoading(false);
    setEndReachedLoading(false);
    setSongsPage(1);
    setHasMoreSongs(true);
    setResults([]); // Clear results to ensure a fresh fetch
    fetchResults(1, false);
  }, [query, filter]);

  const handleRetry = () => {
    setError(null);
    setResults([]);
    setSongsPage(1);
    setHasMoreSongs(true);
    fetchResults(1, false);
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
      <>
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
              onPress={() => {
                setResults([]);
                setError(null);
                setTimeout(() => setFilter("songs"), 0);
              }}
            >
              <Text style={styles.filterText}>Songs</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === "artists" && styles.activeFilter]}
              onPress={() => {
                setResults([]);
                setError(null);
                setTimeout(() => setFilter("artists"), 0);
              }}
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

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        {(songsLoading || (filter === "artists" && artistsLoading)) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="tomato" />
            <Text style={styles.loadingText}>
              {filter === "songs" ? "Loading songs..." : "Loading artists..."}
            </Text>
          </View>
        )}
        {!songsLoading && !artistsLoading && initialFetchDone && results.length === 0 && !error && (
          <Text style={styles.noResultsText}>No results found.</Text>
        )}
        {filter === "artists" &&
          !artistsLoading &&
          vocalRangeFilterActive &&
          vocalRange &&
          vocalRange.min_range !== "C0" &&
          vocalRange.max_range !== "C0" && (
            <View style={styles.inRangeExplanationContainer}>
              <Text style={styles.inRangeExplanationText}>
                You may not have artists in your range. Keep refreshing to load more artists.
              </Text>
            </View>
          )}
        {!songsLoading && !artistsLoading && results.length > 0 && (
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
            ListFooterComponent={
              endReachedLoading ? (
                <View style={styles.loadingFooter}>
                  <ActivityIndicator size="small" color="tomato" />
                  <Text style={styles.loadingText}>
                    Loading more songs...
                  </Text>
                </View>
              ) : null
            }
            onEndReached={() => {
              if (filter === "songs" && hasMoreSongs && !endReachedLoading) {
                setSongsPage((prev) => {
                  const nextPage = prev + 1;
                  fetchResults(nextPage, true);
                  return nextPage;
                });
              }
            }}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={filter === "songs" ? songsLoading : artistsLoading}
                onRefresh={async () => {
                  setSongsLoading(filter === "songs");
                  setArtistsLoading(filter === "artists");
                  setError(null);
                  try {
                    if (filter === "songs") {
                      let newSongs: any[] = [];
                      if (query.trim() === "") {
                        newSongs = await getRandomSongs(25);
                        setHasMoreSongs(newSongs.length >= 25);
                        setRandomSongs(newSongs); // Update randomSongs on refresh
                      } else {
                        newSongs = await searchSongsByQuery(query);
                        setHasMoreSongs(false);
                      }
                      setAllSongs(newSongs);
                      setResults(newSongs);

                      const artists = await deriveArtistsFromSongs(newSongs, 20, query);
                      setAllArtists(artists);
                    } else {
                      let artists: any[] = [];
                      if (query.trim() === "") {
                        // Fetch new random songs to derive new artists
                        const newRandomSongs = await getRandomSongs(25);
                        setRandomSongs(newRandomSongs); // Update randomSongs with new songs
                        artists = await deriveArtistsFromSongs(newRandomSongs, 20);
                      } else {
                        artists = await searchArtistsByQuery(query, 20);
                      }
                      setResults(artists);
                      setAllArtists(artists);
                    }
                  } catch (err) {
                    console.error("Error refreshing data:", err);
                    setError("An error occurred while loading new content: " + (err instanceof Error ? err.message : "Unknown error"));
                  } finally {
                    setSongsLoading(false);
                    setArtistsLoading(false);
                  }
                }}
                colors={["tomato"]}
              />
            }
          />
        )}
      </>
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
  inRangeExplanationContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#f0f0f0",
    marginBottom: 5,
  },
  inRangeExplanationText: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});