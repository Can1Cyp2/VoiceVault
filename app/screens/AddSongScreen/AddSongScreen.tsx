// File location: app/screens/AddSongScreen/AddSongScreen.tsx

import React, { useState } from "react";
import {
  View,
  TextInput,
  Button,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { addSong } from "../../util/api";
import { supabase } from "../../util/supabase";

// Define all notes on a piano (sharps, no flats):
const NOTES = [
  "A0",
  "A#0",
  "B0",
  "C1",
  "C#1",
  "D1",
  "D#1",
  "E1",
  "F1",
  "F#1",
  "G1",
  "G#1",
  "A1",
  "A#1",
  "B1",
  "C2",
  "C#2",
  "D2",
  "D#2",
  "E2",
  "F2",
  "F#2",
  "G2",
  "G#2",
  "A2",
  "A#2",
  "B2",
  "C3",
  "C#3",
  "D3",
  "D#3",
  "E3",
  "F3",
  "F#3",
  "G3",
  "G#3",
  "A3",
  "A#3",
  "B3",
  "C4",
  "C#4",
  "D4",
  "D#4",
  "E4",
  "F4",
  "F#4",
  "G4",
  "G#4",
  "A4",
  "A#4",
  "B4",
  "C5",
  "C#5",
  "D5",
  "D#5",
  "E5",
  "F5",
  "F#5",
  "G5",
  "G#5",
  "A5",
  "A#5",
  "B5",
  "C6",
  "C#6",
  "D6",
  "D#6",
  "E6",
  "F6",
  "F#6",
  "G6",
  "G#6",
  "A6",
  "A#6",
  "B6",
  "C7",
  "C#7",
  "D7",
  "D#7",
  "E7",
  "F7",
  "F#7",
  "G7",
  "G#7",
  "A7",
  "A#7",
  "B7",
  "C8",
];

export default function AddSongScreen({ navigation }: any) {
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");
  const [startNote, setStartNote] = useState<string>("C4");
  const [endNote, setEndNote] = useState<string>("C5");
  const [error, setError] = useState("");
  const [showWarning, setShowWarning] = useState(false); // State for showing the warning modal
  const [similarSong, setSimilarSong] = useState<{ name: string; artist: string } | null>(null); // Store the similar song found

  // Function to check for similar songs in the database
  const checkForSimilarSong = async (songName: string, artistName: string) => {
    try {
      // Query the songs table for similar artist and song name (case-insensitive)
      const { data, error } = await supabase
        .from("songs")
        .select("name, artist")
        .ilike("artist", `%${artistName}%`) // Case-insensitive search for artist
        .ilike("name", `%${songName}%`); // Case-insensitive search for song name

      if (error) {
        console.error("Error checking for similar songs:", error);
        return null;
      }

      if (data && data.length > 0) {
        // Return the first similar song found
        return data[0];
      }
      return null;
    } catch (err) {
      console.error("Unexpected error checking for similar songs:", err);
      return null;
    }
  };

  const handleAddSong = async (bypassWarning = false) => {
    try {
      // Clear any previous errors
      setError("");

      // Validate required fields
      if (!name || !artist) {
        setError("Please fill out all fields.");
        return;
      }

      // Validate vocal range
      const vocalRange = `${startNote} - ${endNote}`;
      const startIndex = NOTES.indexOf(startNote);
      const endIndex = NOTES.indexOf(endNote);

      if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
        setError(
          "Invalid vocal range. Ensure the start note is lower than the end note."
        );
        return;
      }

      // Fetch the current user and username
      const user = await supabase.auth.getUser();
      const username = user.data.user?.user_metadata?.display_name;

      if (!username) {
        setError(
          "Please ensure you are logged in and update your profile to add a username before adding songs."
        );
        return;
      }

      // Check for similar songs unless bypassing the warning
      if (!bypassWarning) {
        const similar = await checkForSimilarSong(name, artist);
        if (similar) {
          setSimilarSong(similar);
          setShowWarning(true); // Show the warning modal
          return;
        }
      }

      // If no similar song or user chose to add anyway, proceed to add the song
      await addSong({ name, vocalRange, artist, username });
      navigation.goBack(); // Navigate back to the previous screen
    } catch (error) {
      console.error(error);
      setError("Failed to add song. Please try again later.");
    }
  };

  // Handle the "Add Anyway" action
  const handleAddAnyway = () => {
    setShowWarning(false);
    setSimilarSong(null);
    handleAddSong(true); // Bypass the warning check
  };

  // Handle the "Cancel" action
  const handleCancel = () => {
    setShowWarning(false);
    setSimilarSong(null);
    // User stays on the AddSongScreen to edit the form
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Add New Song</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <TextInput
          style={styles.input}
          placeholder="Song Name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Artist Name"
          value={artist}
          onChangeText={setArtist}
        />
        <View style={styles.rangeContainer}>
          <Text style={styles.rangeLabel}>Low Note:</Text>
          <Picker
            selectedValue={startNote}
            style={styles.picker}
            onValueChange={(value) => setStartNote(value)}
          >
            {NOTES.map((note) => (
              <Picker.Item key={note} label={note} value={note} />
            ))}
          </Picker>
        </View>
        <View style={styles.rangeContainer}>
          <Text style={styles.rangeLabel}>High Note:</Text>
          <Picker
            selectedValue={endNote}
            style={styles.picker}
            onValueChange={(value) => setEndNote(value)}
          >
            {NOTES.map((note) => (
              <Picker.Item key={note} label={note} value={note} />
            ))}
          </Picker>
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: "tomato",
            padding: 15,
            borderRadius: 10,
            alignItems: "center",
            marginVertical: 20,
          }}
          onPress={() => handleAddSong()}
        >
          <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
            Add Song
          </Text>
        </TouchableOpacity>

        {/* Warning Modal for Similar Song */}
        <Modal
          visible={showWarning}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCancel}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Warning: Similar Song Found</Text>
              <Text style={styles.modalText}>
                A song with a similar title and artist already exists:
              </Text>
              <Text style={styles.modalText}>
                "{similarSong?.name}" by {similarSong?.artist}
              </Text>
              <Text style={styles.modalText}>
                Do you want to add this song anyway?
              </Text>
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: "tomato" }]}
                  onPress={handleAddAnyway}
                >
                  <Text style={styles.modalButtonText}>Add Anyway</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: "#ccc" }]}
                  onPress={handleCancel}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 20,
    backgroundColor: "#fff",
    paddingBottom: 100, // Extra padding at the bottom to allow scrolling past the screen
  },
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginVertical: 10,
    borderRadius: 5,
  },
  errorText: { color: "red", marginBottom: 10 },
  rangeContainer: {
    marginVertical: 10,
  },
  rangeLabel: {
    fontSize: 16,
    marginBottom: 5,
  },
  picker: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    backgroundColor: "#f9f9f9",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: "center",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});