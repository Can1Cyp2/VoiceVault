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
import { searchSongsByQuery, getArtists, getRandomSongs, getRandomArtists } from "../../util/api";
import { checkInternetConnection } from "../../util/network";
import { supabase } from "../../util/supabase";
import { calculateOverallRange, noteToValue } from "../../util/vocalRange";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Search">;

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const handleAddPress = () => {
    navigation.navigate("AddSong");
  };

  const [results, setResults] = useState<any[]>([]);
  const [songsLoading, setSongsLoading] = useState(true);
  const [artistsLoading, setArtistsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"songs" | "artists">("songs");
  const [isConnected, setIsConnected] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vocalRange, setVocalRange] = useState<{ min_range: string; max_range: string } | null>(null);
  const [vocalRangeFilterActive, setVocalRangeFilterActive] = useState(false);
  const [endReachedLoading, setEndReachedLoading] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false); // Track if initial fetch is done
  const [songsPage, setSongsPage] = useState(1); // Track current page for songs pagination
  const [artistsPage, setArtistsPage] = useState(1); // Track current page for artists pagination
  const [hasMoreSongs, setHasMoreSongs] = useState(true); // Track if more songs are available
  const [hasMoreArtists, setHasMoreArtists] = useState(true); // Track if more artists

  // State vars for random data to display when no search query is entered
  const [randomSongs, setRandomSongs] = useState<any[]>([]); // Initial random songs
  const [randomArtists, setRandomArtists] = useState<any[]>([]); // Initial random artists
  const [allSongs, setAllSongs] = useState<any[]>([]); // All loaded songs 
  const [allArtists, setAllArtists] = useState<any[]>([]); // All loaded artists

  

  // Fetch Random Data on Mount
  useEffect(() => {
    const fetchInitialData = async () => {
      const connected = await checkInternetConnection();
      setIsConnected(connected ?? false);
      if (!connected) {
        setError("No internet connection. Please check your network and try again.");
        setSongsLoading(false);
        setArtistsLoading(false);
        setInitialFetchDone(true);
        return;
      }
  
      setSongsLoading(true);
      let songs: any[] = [];
      try {
        songs = await getRandomSongs(25);
        setRandomSongs(songs);
        setAllSongs(songs);
        setResults(songs);
        setError(null);
        console.log("Fetched", songs.length, "songs for initial load");
      } catch (err) {
        console.error("Error fetching random songs:", err);
        setError("Failed to load songs: " + (err instanceof Error ? err.message : "Unknown error"));
        setSongsLoading(false);
        setArtistsLoading(false);
        setInitialFetchDone(true);
        return;
      } finally {
        setSongsLoading(false);
      }
  
      setArtistsLoading(true);
      try {
        // Derive artists from the loaded songs
        const artists = deriveArtistsFromSongs(randomSongs, 12);
        setRandomArtists(artists);
        setAllArtists(artists);
        setError(null);
        console.log("Derived", artists.length, "artists for initial load");
      } catch (err) {
        console.error("Error deriving artists:", err);
        setError("Failed to load artists: " + (err instanceof Error ? err.message : "Unknown error"));
      } finally {
        setArtistsLoading(false);
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

  const isArtistInRange = (artist: { name: any; songs: { vocalRange: string }[] }) => {
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
    return artistMinIndex >= userMinIndex && artistMaxIndex <= userMaxIndex;
  };

  const deriveArtistsFromSongs = (songs: any[], limit: number = 12): any[] => {
    if (!songs || songs.length === 0) {
      console.log("No songs provided to derive artists");
      return [];
    }

    const artistMap = new Map<string, { name: string; songs: { vocalRange: string }[] }>();
    songs.forEach((song) => {
      if (!song.artist || !song.vocalRange) {
        console.warn("Skipping song with missing artist or vocalRange:", song);
        return;
      }
      if (!artistMap.has(song.artist)) {
        artistMap.set(song.artist, { name: song.artist, songs: [] });
      }
      artistMap.get(song.artist)!.songs.push({ vocalRange: song.vocalRange });
    });

    const artists = Array.from(artistMap.values()).map((artist) => ({
      name: artist.name,
      songs: artist.songs,
      vocalRange: calculateOverallRange(artist.songs),
    }));

    return artists
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
  };

  const fetchResults = async (pageNum = 1, append = false) => {
    if ((songsLoading || artistsLoading) && pageNum === 1) return;
    if (endReachedLoading) return;
    if (filter === "songs") setSongsLoading(pageNum === 1);
    if (filter === "artists") setArtistsLoading(pageNum === 1);
    if (pageNum > 1) setEndReachedLoading(true);
    setError(null);

    const connected = await checkInternetConnection();
    setIsConnected(connected ?? false);
    if (!connected) {
      setError("No internet connection. Please check your network and try again.");
      if (filter === "songs") setSongsLoading(false);
      if (filter === "artists") setArtistsLoading(false);
      if (pageNum > 1) setEndReachedLoading(false);
      return;
    }

    try {
      if (filter === "songs") {
        if (query.trim() === "") {
          if (!append && allSongs.length > 0) {
            setResults(allSongs);
            console.log("Using cached songs:", allSongs.length);
            return;
          }
          const newSongs = await getRandomSongs(25);
          console.log("Fetched songs for page", pageNum, ":", newSongs.length);
          if (newSongs.length < 25) setHasMoreSongs(false);
          if (append) {
            const uniqueSongs = newSongs.filter((song) => !allSongs.some((s) => s.id === song.id));
            setResults((prev) => [...prev, ...uniqueSongs]);
            setAllSongs((prev) => [...prev, ...uniqueSongs]);
          } else {
            setResults(newSongs);
            setAllSongs(newSongs);
          }
        } else {
          const newSongs = await searchSongsByQuery(query);
          console.log("Search results for songs query", query, ":", newSongs.length);
          if (append) {
            const uniqueSongs = newSongs.filter((song) => !results.some((s) => s.id === song.id));
            setResults((prev) => [...prev, ...uniqueSongs]);
          } else {
            setResults(newSongs);
          }
          setHasMoreSongs(false);
        }
      } else {
        if (query.trim() === "") {
          if (!append && allArtists.length > 0) {
            setResults(allArtists);
            console.log("Using cached artists:", allArtists.length);
            return;
          }
          const newArtists = await getRandomArtists(12);
          console.log("Fetched artists for page", pageNum, ":", newArtists.length);
          if (newArtists.length < 12) setHasMoreArtists(false);
          if (append) {
            const uniqueArtists = newArtists.filter((artist) => !allArtists.some((a) => a.name === artist.name));
            setResults((prev) => [...prev, ...uniqueArtists]);
            setAllArtists((prev) => [...prev, ...uniqueArtists]);
          } else {
            setResults(newArtists);
            setAllArtists(newArtists);
          }
        } else {
          console.log("Searching artists with query:", query);
          const artists = await getArtists(query);
          console.log("Search results for artists query", query, ":", artists.length);
          if (append) {
            const uniqueArtists = artists.filter((artist) => !results.some((a) => a.name === artist.name));
            setResults((prev) => [...prev, ...uniqueArtists]);
          } else {
            setResults(artists);
          }
          setHasMoreArtists(false);
        }
      }
      setError(null);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(`Unable to load ${filter}. Please try again later.`);
    } finally {
      if (filter === "songs") setSongsLoading(false);
      if (filter === "artists") setArtistsLoading(false);
      if (pageNum > 1) setEndReachedLoading(false);
    }
  };

  useEffect(() => {
    setSongsPage(1);
    setArtistsPage(1);
    setHasMoreSongs(true);
    setHasMoreArtists(true);
    fetchResults(1, false);
  }, [query, filter]);

  const handleRetry = () => {
    setError(null);
    setResults([]);
    if (filter === "songs") {
      setSongsPage(1);
      setHasMoreSongs(true);
    } else {
      setArtistsPage(1);
      setHasMoreArtists(true);
    }
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
                if (artistsLoading) {
                  setError("Artists are still loading, please wait...");
                  setResults([]);
                  console.log("Cleared results due to artistsLoading");
                } else {
                  setResults([]);
                  setError(null);
                  console.log("Cleared results before switching to artists");
                  setTimeout(() => setFilter("artists"), 0);
                }
              }}
              disabled={artistsLoading}
            >
              <Text style={styles.filterText}>
                Artists{artistsLoading ? " (Loading...)" : ""}
              </Text>
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
        {!songsLoading && !artistsLoading && initialFetchDone && results.length === 0 && !error && (
          <Text style={styles.noResultsText}>No results found.</Text>
        )}
        {filter === "artists" &&
          vocalRangeFilterActive &&
          vocalRange &&
          vocalRange.min_range !== "C0" &&
          vocalRange.max_range !== "C0" && (
            <View style={styles.inRangeExplanationContainer}>
              <Text style={styles.inRangeExplanationText}>
                Now filtering by artists who are within your range...
                Continue refreshing to see more artists by swiping down.
              </Text>
            </View>
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
          ListFooterComponent={
            endReachedLoading ? (
              <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color="tomato" />
                <Text style={styles.loadingText}>
                  {filter === "songs" ? "Loading more songs..." : "Loading more artists..."}
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
            } else if (filter === "artists" && hasMoreArtists && !endReachedLoading) {
              setArtistsPage((prev) => {
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
                if (query.trim() === "") {
                  setSongsLoading(filter === "songs");
                  setArtistsLoading(filter === "artists");
                  setError(null);
                  try {
                    if (filter === "songs") {
                      const newSongs = await getRandomSongs(25);
                      setResults(newSongs);
                      setRandomSongs(newSongs);
                      setAllSongs(newSongs);
                      setSongsPage(1);
                      setHasMoreSongs(true);
                    } else {
                      const newArtists = await getRandomArtists(12);
                      setResults(newArtists);
                      setRandomArtists(newArtists);
                      setAllArtists(newArtists);
                      setArtistsPage(1);
                      setHasMoreArtists(true);
                    }
                  } catch (err) {
                    console.error("Error refreshing data:", err);
                    setError("An error occurred while loading new content: " + (err instanceof Error ? err.message : "Unknown error"));
                  } finally {
                    setSongsLoading(false);
                    setArtistsLoading(false);
                  }
                }
              }}
              colors={["tomato"]}
            />
          }
        />
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
  loadingHeader: {
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