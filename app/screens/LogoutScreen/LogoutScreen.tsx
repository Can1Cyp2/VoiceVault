// File location: app/screens/LogoutScreen/LogoutScreen.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function LogoutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>You are logged out!</Text>
      {/* Add additional logout confirmation or options here - TODO LATER */}
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ff6600",
  },
});
