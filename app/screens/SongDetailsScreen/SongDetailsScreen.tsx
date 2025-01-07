// app/screens/SongDetailsScreen/SongDetailsScreen.tsx

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

export const SongDetailsScreen = ({ route, navigation }: any) => {
  const { name, artist, vocalRange } = route.params;

  const globalAverageRange = "C3 - C6"; // Replace with real global average if available
  const isHigherThanAverage = compareRanges(vocalRange, globalAverageRange);

  const handleArtistPress = () => {
    navigation.navigate("ArtistDetails", { name: artist });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      <TouchableOpacity onPress={handleArtistPress}>
        <Text style={styles.artist}>By {artist}</Text>
      </TouchableOpacity>
      <Text style={styles.vocalRange}>Vocal Range: {vocalRange}</Text>
      <View style={styles.gaugeContainer}>
        <Text style={styles.gaugeText}>
          This song's vocal range is {isHigherThanAverage ? "higher" : "lower"}{" "}
          than the global average.
        </Text>
      </View>
    </View>
  );
};

// Helper function to compare ranges
const compareRanges = (range: string, average: string): boolean => {
  const rangeEnd = range.split(" - ")[1];
  const avgEnd = average.split(" - ")[1];
  return rangeEnd > avgEnd;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  artist: { fontSize: 18, color: "blue", textDecorationLine: "underline" },
  vocalRange: { fontSize: 20, color: "tomato", marginVertical: 10 },
  gaugeContainer: {
    marginTop: 20,
    padding: 20,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: "gray",
  },
  gaugeText: { fontSize: 16, textAlign: "center" },
});
