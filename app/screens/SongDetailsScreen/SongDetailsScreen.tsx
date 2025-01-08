// app/screens/SongDetailsScreen/SongDetailsScreen.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";

export const SongDetailsScreen = ({ route }: any) => {
  const { name, artist, vocalRange } = route.params;

  const { male, female, maleOutOfRange, femaleOutOfRange } =
    findClosestVocalRangeFit(vocalRange);

  const getOutOfRangeMessage = (outOfRange: string | null) => {
    if (outOfRange === "lower") {
      return "(This song is lower than the typical range for this category, it may be very difficult to sing. Consider transposing.)";
    }
    if (outOfRange === "higher") {
      return "(This song is higher than the typical range for this category. Consider transposing.)";
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.artist}>By {artist}</Text>
      <Text style={styles.vocalRange}>Vocal Range: {vocalRange}</Text>
      <View style={styles.rangeContainer}>
        <Text style={styles.rangeText}>Best fit for male: {male}</Text>
        {maleOutOfRange && (
          <Text style={styles.noteText}>
            {getOutOfRangeMessage(maleOutOfRange)}
          </Text>
        )}
        <Text style={styles.rangeText}>Best fit for female: {female}</Text>
        {femaleOutOfRange && (
          <Text style={styles.noteText}>
            {getOutOfRangeMessage(femaleOutOfRange)}
          </Text>
        )}
      </View>
    </View>
  );
};

// Helper function: Converts musical notes to numeric values for comparison
const noteToValue = (note: string): number => {
  const scale: { [key: string]: number } = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const octave = parseInt(note.slice(-1), 10);
  const key = note.slice(0, -1);

  return scale[key] + (octave + 1) * 12;
};

// Helper function: Finds the best fit and checks out-of-range scenarios
const findClosestVocalRangeFit = (
  range: string
): {
  male: string;
  female: string;
  maleOutOfRange: string | null;
  femaleOutOfRange: string | null;
} => {
  const [minRange, maxRange] = range.split(" - ").map(noteToValue);

  const vocalRanges = {
    male: [
      { category: "Tenor", min: noteToValue("C3"), max: noteToValue("A4") },
      { category: "Baritone", min: noteToValue("A2"), max: noteToValue("F4") },
      { category: "Bass", min: noteToValue("E2"), max: noteToValue("E4") },
    ],
    female: [
      { category: "Soprano", min: noteToValue("C4"), max: noteToValue("A5") },
      {
        category: "Mezzo-Soprano",
        min: noteToValue("A3"),
        max: noteToValue("F5"),
      },
      { category: "Alto", min: noteToValue("F3"), max: noteToValue("D5") },
    ],
  };

  const findBestFit = (
    ranges: { category: string; min: number; max: number }[]
  ): { category: string; outOfRange: string | null } => {
    let bestFit = null;
    let smallestDifference = Infinity;
    let outOfRange: string | null = null;

    for (const range of ranges) {
      const { category, min, max } = range;

      // Check if completely within range
      if (minRange >= min && maxRange <= max) {
        return { category, outOfRange: null };
      }

      // Calculate overlaps and determine closeness
      const difference = Math.abs(minRange - min) + Math.abs(maxRange - max);

      if (difference < smallestDifference) {
        smallestDifference = difference;
        bestFit = category;

        // Determine out-of-range direction
        if (minRange < min) outOfRange = "lower";
        if (maxRange > max) outOfRange = "higher";
      }
    }

    return { category: bestFit || "Unknown", outOfRange };
  };

  const male = findBestFit(vocalRanges.male);
  const female = findBestFit(vocalRanges.female);

  return {
    male: male.category,
    female: female.category,
    maleOutOfRange: male.outOfRange,
    femaleOutOfRange: female.outOfRange,
  };
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  artist: { fontSize: 18, color: "gray", marginBottom: 10 },
  vocalRange: { fontSize: 20, color: "tomato", marginVertical: 10 },
  rangeContainer: {
    marginTop: 20,
    padding: 20,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: "gray",
  },
  rangeText: { fontSize: 16, textAlign: "center", marginVertical: 5 },
  noteText: { fontSize: 12, textAlign: "center", color: "gray", marginTop: 5 },
});
