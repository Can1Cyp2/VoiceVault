// app/screens/TunerScreen/TunerScreen.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

export default function TunerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Tune your instruments here!</Text>
    </View>
  );
}

const createStyles = (colors: typeof import('../../styles/theme').LightColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.backgroundPrimary,
    },
    text: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
  });
