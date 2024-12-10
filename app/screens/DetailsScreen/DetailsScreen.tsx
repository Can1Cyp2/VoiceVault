// File location: app/screens/DetailsScreen/DetailsScreen.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../../navigation/types";

type DetailsScreenRouteProp = RouteProp<RootStackParamList, "Details">;

export const DetailsScreen = ({ route }: { route: DetailsScreenRouteProp }) => {
  const { name, vocalRange } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.range}>Vocal Range: {vocalRange}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  range: { fontSize: 18 },
});
