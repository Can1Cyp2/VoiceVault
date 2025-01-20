// app/screens/SongDetailsScreen/SongDetailsScreen.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  fetchUserLists,
  saveNewList,
} from "../SavedListsScreen/SavedListsLogic";
import { saveToList } from "../SavedListsScreen/SavedSongLogic";
import { supabase } from "../../util/supabase";

export const SongDetailsScreen = ({ route, navigation }: any) => {
  const { name, artist, vocalRange } = route.params;

  const { male, female, maleOutOfRange, femaleOutOfRange } =
    findClosestVocalRangeFit(vocalRange);

  const [isModalVisible, setModalVisible] = useState(false); // Modal visibility
  const [customListName, setCustomListName] = useState(""); // Custom list name
  const [existingLists, setExistingLists] = useState<any[]>([]); // Holds user's saved lists
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Tracks user's login status

  // Check if the user is logged in and set header options
  useEffect(() => {
    const checkLoginStatus = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);

      supabase.auth.onAuthStateChange((_event, session) => {
        setIsLoggedIn(!!session);
      });
    };

    checkLoginStatus();
  }, []);

  // Dynamically update the header button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isLoggedIn ? (
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Ionicons
              name="add-circle-outline"
              size={24}
              color="#32CD32" // Green color for the button
              style={{ marginRight: 15 }}
            />
          </TouchableOpacity>
        ) : null, // Do not show the button if the user is not logged in
    });
  }, [isLoggedIn, navigation]);

  // Fetch the user's existing lists when the modal is opened
  useEffect(() => {
    const loadLists = async () => {
      const lists = await fetchUserLists();
      setExistingLists(lists || []);
    };

    if (isModalVisible) {
      loadLists();
    }
  }, [isModalVisible]);

  const getOutOfRangeMessage = (outOfRange: string | null) => {
    if (outOfRange === "lower") {
      return "(This song is lower than the typical range for this category, it may be very difficult to sing. Consider transposing.)";
    }
    if (outOfRange === "higher") {
      return "(This song is higher than the typical range for this category. Consider transposing.)";
    }
    return null;
  };

  const handleSaveToCustomList = async () => {
    if (customListName.trim() === "") {
      Alert.alert("Error", "Please enter a list name.");
      return;
    }
    await saveNewList(customListName); // Use saveNewList here
    setCustomListName(""); // Clear the input field
    setModalVisible(false);

    // Refresh the list after adding
    const updatedLists = await fetchUserLists();
    setExistingLists(updatedLists || []);
  };

  const handleSaveToExistingList = async (listName: string) => {
    await saveToList(name, artist, vocalRange, listName);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Modal adding custom or selecting existing list */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Add to List</Text>
          <FlatList
            data={existingLists}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listOption}
                onPress={() => handleSaveToExistingList(item.name)}
              >
                <Text style={styles.listOptionText}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.noListText}>No saved lists found.</Text>
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Custom List Name"
            value={customListName}
            onChangeText={setCustomListName}
          />
          <TouchableOpacity
            style={styles.modalOption}
            onPress={handleSaveToCustomList}
          >
            <Text style={styles.modalOptionText}>add to new list</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModalVisible(false)}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Song details */}
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
    marginTop: 30,
    padding: 30,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: "gray",
  },
  rangeText: { fontSize: 16, textAlign: "center", marginVertical: 5 },
  noteText: { fontSize: 12, textAlign: "center", color: "gray", marginTop: 5 },
  buttonText: {
    color: "#fff",
    backgroundColor: "#32CD32",
    padding: 10,
    borderRadius: 5,
    marginVertical: 10,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    marginTop: 20,
    marginBottom: 80,
    borderRadius: 80,
    paddingTop: 40,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 30,
    color: "#fff",
    marginBottom: 20,
  },
  modalOption: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
    alignItems: "center",
  },
  modalButton: {
    color: "#fff",
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  modalOptionText: {
    fontSize: 16,
    color: "#000",
  },
  modalCancelButton: {
    color: "#fff",
    backgroundColor: "#ff0000",
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  input: {
    width: "80%",
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 5,
    marginBottom: 20,
  },
  modalCancel: {
    fontSize: 16,
    color: "#fff",
    backgroundColor: "#ff0000",
    padding: 8,
    borderRadius: 5,
    marginTop: 20,
  },
  listOption: {
    backgroundColor: "#e0e0e0", // Light gray background
    padding: 12,
    borderRadius: 8,
    marginVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000", // Shadow for depth
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2, // Elevation for Android shadow
  },
  listOptionText: {
    fontSize: 16,
    color: "#333", // Dark text color for readability
    fontWeight: "500", // Medium weight for emphasis
  },
  noListText: {
    fontSize: 14,
    color: "#999", // Subtle gray color for "no lists found"
    textAlign: "center",
    marginVertical: 20, // Space around the message
  },
});
