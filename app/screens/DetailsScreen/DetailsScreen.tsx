// app\screens\DetailsScreen\DetailsScreen.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

// This screen displays the details of a selected item, such as a song or artist:
export const DetailsScreen = ({ route }: any) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
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

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: colors.background,
  },
  title: { 
    fontSize: 24, 
    fontWeight: "bold", 
    marginBottom: 10,
    color: colors.textPrimary,
  },
  subtitle: { 
    fontSize: 18, 
    color: colors.textSecondary, 
    marginBottom: 10,
  },
  vocalRange: { 
    fontSize: 20, 
    color: colors.primary,
  },
});
