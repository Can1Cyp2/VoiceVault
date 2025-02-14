import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from "react-native";
import { supabase } from "../../util/supabase";
import { Ionicons } from "@expo/vector-icons";

export default function ListDetailsScreen({ route, navigation }: any) {
  const { listName } = route.params; // Passed from the previous screen
  const [songs, setSongs] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false); // Toggle edit mode

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        // Get the logged-in user
        const { data: user, error: userError } = await supabase.auth.getUser();
        if (userError || !user?.user?.id) {
          Alert.alert("Error", "Please log in to view this list.");
          return;
        }

        let query = supabase
          .from("saved_songs")
          .select("*")
          .eq("user_id", user.user.id); // ✅ Ensuring only user's saved songs are fetched

        if (listName !== "All Saved Songs") {
          query = query.eq("list_name", listName); // Filter specific lists
        }

        const { data, error } = await query;

        if (error) {
          Alert.alert("Error", error.message);
        } else {
          setSongs(data || []);
        }
      } catch (error) {
        console.error("Error fetching songs:", error);
        Alert.alert("Error", "An error occurred while fetching the songs.");
      }
    };

    fetchSongs();
  }, [listName]);

  // Delete an individual song from the list
  const handleDeleteSong = async (songId: number) => {
    try {
      const { error } = await supabase
        .from("saved_songs")
        .delete()
        .eq("id", songId);

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Song deleted from the list.");
      setSongs((prevSongs) => prevSongs.filter((song) => song.id !== songId));
    } catch (error: any) {
      console.error("Error deleting song:", error);
      Alert.alert("Error", "Could not delete the song.");
    }
  };

  const handleSongPress = (song: any) => {
    navigation.navigate("Details", {
      name: song.name,
      artist: song.artist,
      vocalRange: song.vocal_range,
      username: song.username,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{listName}</Text>
        <TouchableOpacity onPress={() => setIsEditing((prev) => !prev)}>
          <Ionicons
            name={isEditing ? "checkmark-circle-outline" : "create-outline"}
            size={24}
            color={isEditing ? "green" : "blue"}
            style={styles.editIcon}
          />
        </TouchableOpacity>
      </View>
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.songItem}>
            <TouchableOpacity
              style={styles.songDetails}
              onPress={() => handleSongPress(item)}
              disabled={isEditing} // Disable song navigation in edit mode
            >
              <Text style={styles.songText}>
                {item.name} - {item.artist}
              </Text>
            </TouchableOpacity>
            {isEditing && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteSong(item.id)}
              >
                <Ionicons name="trash-outline" size={20} color="red" />
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            {listName === "All Saved Songs"
              ? "No songs have been saved yet."
              : `No songs in the list "${listName}".`}
          </Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#333" },
  editIcon: { marginRight: 10 },
  songItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderColor: "#ccc",
  },
  songDetails: { flex: 1 },
  songText: { fontSize: 18, color: "#555" },
  deleteButton: {
    marginLeft: 10,
    padding: 5,
    borderRadius: 5,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    color: "#999",
    marginTop: 20,
  },
});
