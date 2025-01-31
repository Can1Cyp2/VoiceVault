// File location: app/screens/SearchScreen/SearchScreen.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/StackNavigator";
import { Ionicons } from "@expo/vector-icons";

import { SearchBar } from "../../components/SearchBar/SearchBar";
import { searchSongsByQuery, getArtists } from "../../util/api";
import { checkInternetConnection } from "../../util/network";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Search">;

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const handleAddPress = () => {
    navigation.navigate("AddSong");
  };

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"songs" | "artists">("songs");
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    setResults([]); // Clear results when the filter changes
    const fetchResults = async () => {
      setLoading(true);
      setError(null);

      try {
        if (filter === "songs") {
          const songs = await searchSongsByQuery(query);
          setResults(songs);
        } else if (filter === "artists") {
          const artists = await getArtists(query);
          setResults(artists);
        }
      } catch (err) {
        setError("An error occurred while fetching data.");
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, filter]);

  // Retry fetching data:
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
        const songs = await searchSongsByQuery(query);
        setResults(songs);
      } else if (filter === "artists") {
        const artists = await getArtists(query);
        setResults(artists);
      }
    } catch (err) {
      setError("An error occurred while fetching data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setResults([]); // Clear results when the filter changes
    fetchResults();
  }, [query, filter]);

  const handleRetry = () => {
    fetchResults(); // Retry fetching data
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

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
        <SearchBar onSearch={setQuery} />
      </View>
      <View style={styles.filterContainer}>
        {/* Add Button */}
        <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
          <Ionicons name="add-circle" size={36} color="tomato" />
        </TouchableOpacity>

        {/* Filter Buttons Container */}
        <View style={styles.filterButtonsWrapper}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === "songs" && styles.activeFilter,
            ]}
            onPress={() => setFilter("songs")}
          >
            <Text style={styles.filterText}>Songs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === "artists" && styles.activeFilter,
            ]}
            onPress={() => setFilter("artists")}
          >
            <Text style={styles.filterText}>Artists</Text>
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
        data={results}
        keyExtractor={(item, index) =>
          filter === "songs"
            ? item?.id?.toString() ?? index.toString()
            : item?.name ?? index.toString()
        }
        renderItem={({ item }) => {
          if (
            filter === "songs" &&
            (!item.name || !item.artist || !item.vocalRange)
          ) {
            return null; // Skip rendering invalid song data
          }
          if (filter === "artists" && !item.name) {
            return null; // Skip rendering invalid artist data
          }
          return (
            <TouchableOpacity onPress={() => handlePress(item)}>
              <View style={styles.resultItem}>
                <Text style={styles.resultText}>
                  {filter === "songs"
                    ? `${item.name} by ${item.artist} - ${item.vocalRange}`
                    : `${item.name}`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
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
  filterText: { color: "black", fontWeight: "bold" },
  resultItem: {
    padding: 10,
    marginVertical: 5,
    marginHorizontal: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  resultText: { fontSize: 16 },
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
});
