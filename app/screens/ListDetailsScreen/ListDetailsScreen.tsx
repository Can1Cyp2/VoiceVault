// file location: app/screens/ListDetailsScreen/ListDetailsScreen.tsx

import React, { useEffect, useState } from "react";
import { View, FlatList, Text, StyleSheet, Alert } from "react-native";
import { supabase } from "../../util/supabase";

export default function ListDetailsScreen({ route }: any) {
  const { listName } = route.params;
  const [songs, setSongs] = useState<any[]>([]);

  useEffect(() => {
    const fetchSongs = async () => {
      const { data, error } = await supabase
        .from("saved_songs")
        .select("*")
        .eq("list", listName);
      if (error) {
        Alert.alert("Error", error.message);
      } else {
        setSongs(data || []);
      }
    };
    fetchSongs();
  }, [listName]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{listName}</Text>
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.songItem}>
            <Text style={styles.songText}>
              {item.name} - {item.artist}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  songItem: { padding: 10, borderBottomWidth: 1, borderColor: "#ccc" },
  songText: { fontSize: 18 },
});
