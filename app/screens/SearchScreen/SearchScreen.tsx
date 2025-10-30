// File location: app/screens/SearchScreen/SearchScreen.tsx
import React, { useState } from "react";
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
import { supabase } from "../../util/supabase";
import { useSearch } from "../../util/useSearch";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Search">;

// This component renders a search screen with a search bar, filter buttons, and a list of results (songs or artists):
export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"songs" | "artists">("songs");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vocalRange, setVocalRange] = useState<{ min_range: string; max_range: string } | null>(null);
  const [vocalRangeFilterActive, setVocalRangeFilterActive] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);


  const {
    results,
    songsLoading,
    artistsLoading,
    error,
    endReachedLoading,
    hasMoreArtists,
    isSongInRange,
    isArtistInRange,
    handleRefresh,
    handleLoadMore,
    handleRetry,
  } = useSearch({
    query,
    filter,
    vocalRange,
    initialFetchDone,
    setInitialFetchDone,
  });

  // Fetch the user's vocal range when the component mounts
  React.useEffect(() => {
    const fetchUserVocalRange = async () => {
      try {
        const user = supabase.auth.user();
        if (!user) {
          setIsLoggedIn(false);
          setVocalRange(null);
          return;
        }
        setIsLoggedIn(true);
        const { data, error: rangeError } = await supabase
          .from("user_vocal_ranges")
          .select("min_range, max_range")
          .eq("user_id", user.id) 
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

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        setIsLoggedIn(true);
        fetchUserVocalRange();
      } else if (event === "SIGNED_OUT") {
        setIsLoggedIn(false);
        setVocalRange(null);
        setVocalRangeFilterActive(false);
      }
    });
    
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Function to handle adding a new song
  const handleAddPress = () => {
    navigation.navigate("AddSong");
  };

  // Function to handle pressing on a song or artist:
  // navigates to the details screen for the selected song or artist
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

  // Function to handle pressing the "In Range" button:
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
              setQuery("");
              setFilter("songs");
            }}
          >
            <Text style={[styles.filterText, filter === "songs" && { color: "#fff" }]}>Songs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === "artists" && styles.activeFilter]}
            onPress={() => {
              setQuery("");
              setFilter("artists");
            }}
          >
            <Text style={[styles.filterText, filter === "artists" && { color: "#fff" }]}>Artists</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButtonRight} onPress={handleInRangePress}>
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
          style={{ minHeight: '88%' }}
          contentContainerStyle={{
            paddingBottom: 90
          }}

          data={
            vocalRangeFilterActive
              ? filter === "songs"
                ? results.filter((item) => isSongInRange(item.vocalRange))
                : results.filter((item) => isArtistInRange(item))
              : results
          }
          renderItem={({ item }) => {
            if (filter === "songs" && (!item.name || !item.artist || !item.vocalRange)) return null;
            if (filter === "artists" && !item.name) return null;
            return (
              <TouchableOpacity onPress={() => handlePress(item)}>
                <View style={styles.resultItem}>
                  <View style={styles.resultIcon}>
                    <Ionicons
                      name={filter === "songs" ? "musical-notes" : "person"}
                      size={25}
                      color="#FF6347"
                    />
                  </View>
                  <View style={styles.resultTextContainer}>
                    <Text style={styles.resultText}>{item.name}</Text>
                    {filter === "songs" && (
                      <Text style={styles.resultSubText}>
                        {item.artist} • {item.vocalRange}
                      </Text>
                    )}
                  </View>
                  {isLoggedIn && vocalRange && (
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
                      size={31}
                      color={
                        filter === "songs"
                          ? isSongInRange(item.vocalRange)
                            ? "#FF6347"
                            : "#CCC"
                          : isArtistInRange(item)
                            ? "#FF6347"
                            : "#CCC"
                      }
                      style={styles.inRangeIcon}
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            filter === "songs" && endReachedLoading ? (
              <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color="tomato" />
                <Text style={styles.loadingText}>Loading more...</Text>
              </View>
            ) : filter === "artists" && query.length === 0 ? (
              <View style={styles.swipeMessageContainer}>
                <Text style={styles.swipeMessageText}>
                  Swipe down from top to cycle artists:
                </Text>
              </View>
            ) : null
          }
          onEndReached={filter === "songs" ? handleLoadMore : null} // Disable onEndReached for artists
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={filter === "songs" ? songsLoading : artistsLoading}
              onRefresh={handleRefresh}
              colors={["tomato"]}
            />
          }
          overScrollMode="always" // Enable overscroll on Android
          bounces={true} // overscroll on ios
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5", paddingTop: 30 },
  searchBarContainer: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  loadingText: { textAlign: "center", marginVertical: 10, color: "gray" },
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 15,
    paddingHorizontal: 16,
  },
  addButton: {
    position: "absolute",
    left: 17,
    zIndex: 10,
  },
  filterButtonsWrapper: {
    flexDirection: "row",
    justifyContent: "center",
    flex: 1,
  },
  filterButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginHorizontal: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  activeFilter: { 
    backgroundColor: "#FF6347", 
    borderColor: "#FF6347",
  },
  resultItem: {
    padding: 17,
    marginVertical: 6,
    marginHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultText: {
    fontSize: 17.5,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  resultSubText: {
    fontSize: 13.5,
    color: "#666",
    marginTop: 3,
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
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "#FFF0ED",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
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
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    color: "#1A1A1A",
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
  swipeMessageContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#f0f0f0",
    marginBottom: 5,
  },
  swipeMessageText: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
  },
});