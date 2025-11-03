// app/components/SearchBar/SearchBar.tsx

import React from "react";
import { TextInput, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const SearchBar = ({
  onSearch,
}: {
  onSearch: (query: string) => void;
}) => {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
      <TextInput
        style={styles.input}
        placeholder="Search for an artist or song..."
        placeholderTextColor="#999"
        onChangeText={onSearch} // Call onSearch on every keystroke
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flexDirection: "row", 
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
});
