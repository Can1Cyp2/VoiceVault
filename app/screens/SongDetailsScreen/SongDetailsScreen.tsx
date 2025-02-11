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
import { findClosestVocalRangeFit } from "./RangeBestFit";

export const SongDetailsScreen = ({ route, navigation }: any) => {
  const { name, artist, vocalRange } = route.params;

  const { male, female, maleOutOfRange, femaleOutOfRange } =
    findClosestVocalRangeFit(vocalRange);

  const [isModalVisible, setModalVisible] = useState(false); // Modal visibility
  const [customListName, setCustomListName] = useState(""); // Custom list name
  const [existingLists, setExistingLists] = useState<any[]>([]); // Holds user's saved lists
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Tracks user's login status
  const [isIssueModalVisible, setIssueModalVisible] = useState(false);
  const [issueText, setIssueText] = useState("");

  // Check if the user is logged in and set header options
  useEffect(() => {
    const checkLoginStatus = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);

      supabase.auth.onAuthStateChange(
        (_event: string, session: { user: any } | null) => {
          setIsLoggedIn(!!session);
        }
      );
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
              size={30}
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

  // Check if the modal should open based on route params:
  useEffect(() => {
    if (route.params?.showAddToListModal) {
      setModalVisible(true);
      // Reset the param to avoid reopening the modal unintentionally
      navigation.setParams({ showAddToListModal: false });
    }
  }, [route.params?.showAddToListModal]);

  // Helper function to get out-of-range message
  const getOutOfRangeMessage = (outOfRange: string | null) => {
    if (outOfRange === "lower") {
      return "(This song is lower than the typical range for this category, it may be very difficult to sing. Consider transposing.)";
    }
    if (outOfRange === "higher") {
      return "(This song is higher than the typical range for this category. Consider transposing.)";
    }
    return null;
  };

  // Function to handle saving to a custom list
  const handleSaveToCustomList = async () => {
    if (customListName.trim() === "") {
      Alert.alert("Error", "Please enter a list name.");
      return;
    }

    try {
      // Create the new list
      await saveNewList(customListName);

      // Save the song to the newly created list
      await saveToList(name, artist, vocalRange, customListName);

      // Clear the input field and close the modal
      setCustomListName("");
      setModalVisible(false);

      // Refresh the list after adding
      const updatedLists = await fetchUserLists();
      setExistingLists(updatedLists || []);

      Alert.alert("Success", `Added "${name}" to "${customListName}"`);
    } catch (error) {
      console.error("Error saving to custom list:", error);
      Alert.alert("Error", "Could not save the song to the new list.");
    }
  };

  const handleSaveToExistingList = async (listName: string) => {
    await saveToList(name, artist, vocalRange, listName);
    setModalVisible(false);
  };

  // Function to handle artist, sends user to artist page
  const handleArtistPress = () => {
    navigation.navigate("ArtistDetails", {
      name: artist,
    });
  };

  // Submit the issue report to Supabase
  const handleSubmitIssue = async () => {
    if (!issueText.trim()) {
      Alert.alert("Error", "Please enter an issue description.");
      return;
    }

    try {
      // Check if the user is logged in
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session) {
        Alert.alert(
          "Sign In Required",
          "You must be signed in to report an issue."
        );
        return;
      }

      const { data: user } = await supabase.auth.getUser();

      if (!user?.user) {
        Alert.alert(
          "Sign In Required",
          "You must be signed in to report an issue."
        );
        return;
      }

      console.log("User data from Supabase:", user);

      // Fetch username the same way as ProfileScreen
      let username = user.user.user_metadata?.display_name;

      console.log("Extracted username:", username);

      // If username is missing, show alert and ask user to set it
      if (!username || username.trim() === "") {
        Alert.alert(
          "Set Username",
          "Your username is missing. Please go to profile settings and set a display name."
        );
        return;
      }

      const issuePayload = {
        song_id: route.params.song_id || null,
        song_name: name,
        vocal_range: vocalRange,
        user_id: user.user.id,
        username: username,
        user_email: user.user.email || "No email",
        issue_text: issueText,
        status: "pending",
      };

      console.log("Submitting issue with payload:", issuePayload);

      // Try inserting into Supabase
      const { error } = await supabase.from("issues").insert([issuePayload]);

      if (error) {
        console.error("Supabase Insert Error:", error);
        Alert.alert("Error", `Failed to submit issue: ${error.message}`);
        return;
      }

      Alert.alert("Success", "Issue reported successfully.");
      setIssueText("");
      setIssueModalVisible(false);
    } catch (error) {
      console.error("Unexpected Error submitting issue:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
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
      <Text style={styles.artist}>
        By{" "}
        <Text onPress={handleArtistPress} style={styles.artistLink}>
          {artist}
        </Text>
      </Text>
      <Text style={styles.vocalRange}>Vocal Range: {vocalRange}</Text>
      <View style={styles.details}>
        {route.params.username ? (
          <Text style={styles.uploadedBy}>
            Uploaded by: {route.params.username}
          </Text>
        ) : (
          <Text style={styles.verifiedCheck}>✅ Verified Vocal Range</Text>
        )}
      </View>
      <View style={styles.rangeContainer}>
        <Text style={styles.rangeText}>Best fit for male: {male}</Text>
        {maleOutOfRange && (
          <Text style={styles.noteText}>
            {getOutOfRangeMessage(maleOutOfRange)}
          </Text>
        )}
        <Text style={styles.divider}>- - -</Text>
        <Text style={styles.rangeText}>Best fit for female: {female}</Text>
        {femaleOutOfRange && (
          <Text style={styles.noteText}>
            {getOutOfRangeMessage(femaleOutOfRange)}
          </Text>
        )}
      </View>
      {/* Report Issue Button */}
      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => setIssueModalVisible(true)}
      >
        <Ionicons name="alert-circle-outline" size={28} color="red" />
      </TouchableOpacity>

      {/* Issue Report Modal */}
      <Modal visible={isIssueModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Report an Issue</Text>
          <TextInput
            style={styles.issueText}
            placeholder="Describe the issue..."
            value={issueText}
            onChangeText={setIssueText}
            multiline
          />
          <TouchableOpacity onPress={handleSubmitIssue}>
            <Text style={styles.buttonText}>Submit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIssueModalVisible(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
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
  divider: {
    fontSize: 16,
    textAlign: "center",
    color: "gray",
    margin: 5,
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  artist: { fontSize: 18, color: "gray", marginBottom: 10 },
  artistLink: {
    color: "#007bff", // Makes it look like a link
    textDecorationLine: "underline",
  },

  vocalRange: { fontSize: 20, color: "tomato", marginVertical: 10 },
  rangeContainer: {
    marginTop: 30,
    padding: 30,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: "gray",
  },
  rangeText: { fontSize: 16, textAlign: "center", marginVertical: 0 },
  noteText: {
    fontSize: 12,
    textAlign: "center",
    color: "gray",
  },
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
  // uploaded by user styles:
  details: {
    marginTop: 3,
    padding: 1,
    paddingRight: 5,
    paddingLeft: 5,
    borderWidth: 1,
    borderRadius: 50,
    borderColor: "gray",
    opacity: 0.8, // opacity of the content in border
  },
  uploadedBy: {
    fontSize: 10,
    color: "gray",
    marginTop: 5,
    fontWeight: "bold",
    marginBottom: 4,
  },
  verifiedCheck: {
    fontSize: 10,
    color: "tomato",
    marginTop: 5,
    fontWeight: "bold",
    marginBottom: 4,
  },
  reportButton: { marginTop: 20 },
  cancelText: { fontSize: 16, color: "#fff", marginTop: 10 },
  issueText: {
    width: "80%",
    height: "40%",
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 5,
    marginBottom: 20,
    textAlignVertical: "top",
  },
});
