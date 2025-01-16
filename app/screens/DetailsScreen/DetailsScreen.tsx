// app\screens\DetailsScreen\DetailsScreen.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";

export const DetailsScreen = ({ route }: any) => {
  const { name, vocalRange, type, artist } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      {type === "songs" && artist && (
        <Text style={styles.subtitle}>By {artist}</Text>
      )}
      {vocalRange && (
        <Text style={styles.vocalRange}>Vocal Range: {vocalRange}</Text>
      )}
    </View>
  );
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
  subtitle: { fontSize: 18, color: "gray", marginBottom: 10 },
  vocalRange: { fontSize: 20, color: "tomato" },
});
