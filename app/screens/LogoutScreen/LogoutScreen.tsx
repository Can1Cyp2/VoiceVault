// File location: app/screens/LogoutScreen/LogoutScreen.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

export default function LogoutScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>You are logged out!</Text>
      {/* TODO: Add additional logout confirmation by email or something here*/}
    </View>
  );
}

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.primary,
  },
});
