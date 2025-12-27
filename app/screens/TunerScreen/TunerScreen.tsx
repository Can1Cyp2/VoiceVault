// app/screens/TunerScreen/TunerScreen.tsx

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import VocalRangeDetectorModal from "./VocalRangeDetectorModal";

export default function TunerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [modalVisible, setModalVisible] = useState(false);
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Tune your instruments here!</Text>
      
      <TouchableOpacity
        style={styles.button}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.buttonText}>🎤 Find My Vocal Range</Text>
      </TouchableOpacity>

      <VocalRangeDetectorModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={(low, high) => {
          console.log('Vocal range saved:', low, high);
        }}
      />
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
  text: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 30,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
