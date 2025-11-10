// app/components/SearchBar/SearchBar.tsx

import React, { useMemo } from "react";
import { TextInput, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

export const SearchBar = ({
  onSearch,
}: {
  onSearch: (query: string) => void;
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={20} color={colors.textTertiary} style={styles.searchIcon} />
      <TextInput
        style={styles.input}
        placeholder="Search for an artist or song..."
        placeholderTextColor={colors.textPlaceholder}
        onChangeText={onSearch} // Call onSearch on every keystroke
      />
    </View>
  );
};

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  container: { 
    flexDirection: "row", 
    alignItems: "center",
    backgroundColor: colors.inputBackground,
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
    color: colors.textPrimary,
  },
});
