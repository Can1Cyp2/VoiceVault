// app/screens/ArtistDetailsScreen/ArtistDetailsScreen.tsx

import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { searchSongsByQuery } from "../../util/api";

export const ArtistDetailsScreen = ({ route }: any) => {
  const { name } = route.params;
  const [songs, setSongs] = useState<any[]>([]);

  useEffect(() => {
    const fetchSongs = async () => {
      const allSongs = await searchSongsByQuery("");
      const artistSongs = allSongs.filter((song) => song.artist === name);
      setSongs(artistSongs);
    };

    fetchSongs();
  }, [name]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Text style={styles.songItem}>
            {item.name} - {item.vocalRange}
          </Text>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  songItem: { fontSize: 18, marginVertical: 5 },
});
