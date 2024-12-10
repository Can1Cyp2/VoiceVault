// app/screens/TunerScreen/TunerScreen.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function TunerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Tune your instruments here!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  text: {
    fontSize: 20,
    fontWeight: "bold",
  },
});
