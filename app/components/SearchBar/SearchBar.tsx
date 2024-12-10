// app/components/SearchBar/SearchBar.tsx

import React from "react";
import { TextInput, StyleSheet, View } from "react-native";

export const SearchBar = ({
  onSearch,
}: {
  onSearch: (query: string) => void;
}) => {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search for an artist or song..."
        onChangeText={onSearch} // Call onSearch on every keystroke
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: "row", padding: 10 },
  input: {
    flex: 1,
    borderColor: "gray",
    borderWidth: 1,
    padding: 8,
    marginRight: 8,
  },
});
