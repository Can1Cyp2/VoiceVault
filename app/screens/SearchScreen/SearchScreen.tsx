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

import { SearchBar } from "../../components/SearchBar/SearchBar";
import { searchSongsByQuery, getArtists } from "../../util/api";
import { Ionicons } from "@expo/vector-icons";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Search">;

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const handleAddPress = () => {
    navigation.navigate("AddSong"); // This should now resolve correctly
  };

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"songs" | "artists">("songs");

  useEffect(() => {
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

  const handlePress = (item: any) => {
    if (filter === "songs") {
      navigation.navigate("Details", {
        name: item.name,
        artist: item.artist,
        vocalRange: item.vocalRange,
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
      {error && <Text style={styles.errorText}>{error}</Text>}
      {!loading && results.length === 0 && (
        <Text style={styles.noResultsText}>No results found.</Text>
      )}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handlePress(item)}>
            <View style={styles.resultItem}>
              <Text style={styles.resultText}>
                {filter === "songs"
                  ? `${item.name} by ${item.artist} - ${item.vocalRange}`
                  : `${item.name}`}
              </Text>
            </View>
          </TouchableOpacity>
        )}
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
  errorText: { textAlign: "center", marginVertical: 10, color: "red" },
  noResultsText: { textAlign: "center", color: "#555", marginVertical: 20 },
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
});
