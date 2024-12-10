// app/screens/SearchScreen/SearchScreen.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SearchBar } from "../../components/SearchBar/SearchBar";
import { searchArtistsOrSongs } from "../../util/api";

export default function SearchScreen() {
  interface SearchResult {
    id: number;
    name: string;
    vocalRange: string;
    type: "artist" | "song";
  }

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(""); // Current search query
  const [filter, setFilter] = useState<"artists" | "songs">("artists"); // Filter selection

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await searchArtistsOrSongs(query, filter); // Pass filter to API call
        setResults(data);
      } catch (err) {
        setError("An error occurred while searching.");
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, filter]); // Re-fetch results when query or filter changes

  return (
    <View style={(styles.container, { marginTop: 60 })}>
      <SearchBar onSearch={setQuery} />
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === "artists" && styles.activeFilter,
          ]}
          onPress={() => setFilter("artists")}
        >
          <Text style={styles.filterText}>Artists</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === "songs" && styles.activeFilter,
          ]}
          onPress={() => setFilter("songs")}
        >
          <Text style={styles.filterText}>Songs</Text>
        </TouchableOpacity>
      </View>
      {loading && <Text style={styles.loadingText}>Loading...</Text>}
      {error && <Text style={styles.errorText}>{error}</Text>}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.resultItem}>
            <Text style={styles.resultText}>
              {item.name} - {item.vocalRange}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingText: { textAlign: "center", marginVertical: 10, color: "gray" },
  errorText: { textAlign: "center", marginVertical: 10, color: "red" },
  filterContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 10,
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
  activeFilter: {
    backgroundColor: "tomato",
    borderColor: "tomato",
  },
  filterText: {
    color: "black",
    fontWeight: "bold",
  },
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
