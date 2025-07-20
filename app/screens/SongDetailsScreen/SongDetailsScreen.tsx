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
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "../../styles/theme";

import {
  fetchUserLists,
  saveNewList,
} from "../SavedListsScreen/SavedListsLogic";
import { saveToList } from "../SavedListsScreen/SavedSongLogic";
import { supabase } from "../../util/supabase";
import { findClosestVocalRangeFit, noteToValue } from "./RangeBestFit";
import SongRangeRecommendation from "./SongRangeRecommendation";
import Piano from '../../components/Piano/Piano';

const { width } = Dimensions.get('window');

// SongDetailsScreen component:
// Displays details of a song, including vocal range and options to save it to a list.
export const SongDetailsScreen = ({ route, navigation }: any) => {
  const { name, artist, vocalRange } = route.params;

  const { male, female, maleOutOfRange, femaleOutOfRange } =
    findClosestVocalRangeFit(vocalRange);

  const [isModalVisible, setModalVisible] = useState(false);
  const [customListName, setCustomListName] = useState("");
  const [existingLists, setExistingLists] = useState<any[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isIssueModalVisible, setIssueModalVisible] = useState(false);
  const [issueText, setIssueText] = useState("");

  // Parse vocal range to extract lowest and highest notes
  const parseVocalRange = (range: string) => {
    if (!range) return { lowest: '', highest: '', octaveRange: '' };

    const parts = range.split(/ - | – /);
    if (parts.length === 2) {
      const lowest = parts[0].trim();
      const highest = parts[1].trim();
      
      const lowValue = noteToValue(lowest);
      const highValue = noteToValue(highest);

      if (!isNaN(lowValue) && !isNaN(highValue)) {
        const octaveDiff = Math.floor(Math.abs(highValue - lowValue) / 12);
        const noteDiff = Math.abs(highValue - lowValue) % 12;
        const octaveRange = `${octaveDiff} octave${octaveDiff !== 1 ? 's' : ''}, ${noteDiff} note${noteDiff !== 1 ? 's' : ''}`;
        return { lowest, highest, octaveRange };
      }

      return { lowest, highest, octaveRange: "Invalid range" };
    }
    return { lowest: range, highest: range, octaveRange: "1,0" };
  };

  const { lowest, highest, octaveRange } = parseVocalRange(vocalRange);

  // Check if the user is logged in and set header options
  useEffect(() => {
    const checkLoginStatus = async () => {
      const session = supabase.auth.session();
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
              color={COLORS.primary}
              style={{ marginRight: 15 }}
            />
          </TouchableOpacity>
        ) : null,
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
      await saveNewList(customListName);
      await saveToList(name, artist, vocalRange, customListName);
      setCustomListName("");
      setModalVisible(false);
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
      const session = supabase.auth.session();
      if (!session) {
        Alert.alert(
          "Sign In Required",
          "You must be signed in to report an issue."
        );
        return;
      }

      const user = supabase.auth.user();

      if (!user) {
        Alert.alert(
          "Sign In Required",
          "You must be signed in to report an issue."
        );
        return;
      }

      let username = user.user_metadata?.display_name;

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
        user_id: user.id,
        username: username,
        user_email: user.email || "No email",
        issue_text: issueText,
        status: "pending",
      };

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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Album Art Placeholder */}
      <View style={styles.albumArtContainer}>
        <View style={styles.albumArt}>
          <Text style={styles.albumArtText}>🎵</Text>
          <Text style={styles.albumTitle}>{name}</Text>
          <Text style={styles.albumArtist}>{artist?.toUpperCase() || 'UNKNOWN'}</Text>
        </View>
      </View>

      {/* Song Title */}
      <Text style={styles.songTitle}>{name}</Text>
      
      {/* Artist Name */}
      {artist && (
        <TouchableOpacity onPress={handleArtistPress}>
          <Text style={styles.artistName}>{artist}</Text>
        </TouchableOpacity>
      )}

      {/* Status Badge */}
      <View style={styles.statusBadge}>
        {route.params.username ? (
          <Text style={styles.statusText}>Uploaded by: {route.params.username}</Text>
        ) : (
          <Text style={styles.statusTextVerified}>✅ Verified Vocal Range</Text>
        )}
      </View>

      {/* Vocal Range Header */}
      {vocalRange && (
        <>
          <View style={styles.vocalRangeHeader}>
            <Text style={styles.vocalRangeIcon}>🎤</Text>
            <Text style={styles.vocalRangeTitle}>Vocal Range: {vocalRange}</Text>
          </View>

          <Piano vocalRange={vocalRange} />

          {/* Range Details */}
          <View style={styles.rangeDetails}>
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Lowest Note:</Text>
              <Text style={styles.rangeValue}>{lowest}</Text>
            </View>
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Highest Note:</Text>
              <Text style={styles.rangeValue}>{highest}</Text>
            </View>
            <View style={styles.rangeItem}>
              <Text style={styles.rangeLabel}>Octave Range:</Text>
              <Text style={styles.rangeValue}>{octaveRange}</Text>
            </View>
          </View>

          {/* Best Fit Section */}
          <View style={styles.bestFitSection}>
            <Text style={styles.bestFitTitle}>Best Fit Analysis</Text>
            <View style={styles.bestFitCard}>
              <Text style={styles.bestFitLabel}>Male Voice:</Text>
              <Text style={styles.bestFitValue}>{male}</Text>
              {maleOutOfRange && (
                <Text style={styles.outOfRangeText}>
                  {getOutOfRangeMessage(maleOutOfRange)}
                </Text>
              )}
            </View>
            <View style={styles.bestFitCard}>
              <Text style={styles.bestFitLabel}>Female Voice:</Text>
              <Text style={styles.bestFitValue}>{female}</Text>
              {femaleOutOfRange && (
                <Text style={styles.outOfRangeText}>
                  {getOutOfRangeMessage(femaleOutOfRange)}
                </Text>
              )}
            </View>
          </View>
        </>
      )}

      {/* Personalized Recommendation Component */}
      <SongRangeRecommendation songVocalRange={vocalRange} isLoggedIn={isLoggedIn} />

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {/* <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>COMPARE RANGE</Text> // MIGHT ADD THIS LATER
        </TouchableOpacity> */}
        {isLoggedIn && (
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.primaryButtonText}>ADD TO LIST</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Share Button */}
      {/* <TouchableOpacity style={styles.shareButton}>
        <Text style={styles.shareButtonText}>SHARE</Text> // MIGHT ADD THIS LATER
      </TouchableOpacity> */}

      {/* Report Issue Button */}
      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => setIssueModalVisible(true)}
      >
        <Ionicons name="alert-circle-outline" size={24} color={COLORS.primary} />
        <Text style={styles.reportButtonText}>Report Issue</Text>
      </TouchableOpacity>

      {/* Modal for adding to list */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Add to List</Text>

                <TouchableOpacity
                  style={styles.listOptionAlwaysSaved}
                  onPress={() => handleSaveToExistingList("All Saved Songs")}
                >
                  <Text style={styles.listOptionTextAlwaysSaved}>
                    📌 All Saved Songs (Auto-added)
                  </Text>
                </TouchableOpacity>

                <FlatList
                  data={existingLists.filter(
                    (list) => list.name !== "All Saved Songs"
                  )}
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
                  keyboardShouldPersistTaps="handled"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Custom List Name"
                  value={customListName}
                  onChangeText={setCustomListName}
                  placeholderTextColor={COLORS.textLight}
                />

                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleSaveToCustomList}
                >
                  <Text style={styles.modalButtonText}>Add to New List</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Issue Report Modal */}
      <Modal visible={isIssueModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Report an Issue</Text>
            <TextInput
              style={styles.issueInput}
              placeholder="Describe the issue..."
              value={issueText}
              onChangeText={setIssueText}
              multiline
              placeholderTextColor={COLORS.textLight}
            />
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={handleSubmitIssue}
            >
              <Text style={styles.modalButtonText}>Submit</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalCancelButton}
              onPress={() => setIssueModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  // Album Art
  albumArtContainer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 30,
  },
  albumArt: {
    width: 280,
    height: 280,
    backgroundColor: COLORS.textDark,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  albumArtText: {
    fontSize: 60,
    marginBottom: 20,
  },
  albumTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    fontFamily: FONTS.primary,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  albumArtist: {
    fontSize: 16,
    color: '#ccc',
    fontFamily: FONTS.primary,
    textAlign: 'center',
    letterSpacing: 2,
  },

  // Song Info
  songTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.textDark,
    fontFamily: FONTS.primary,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  artistName: {
    fontSize: 24,
    color: COLORS.textLight,
    fontFamily: FONTS.primary,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Status Badge
  statusBadge: {
    alignSelf: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 30,
  },
  statusText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontFamily: FONTS.primary,
    fontWeight: 'bold',
  },
  statusTextVerified: {
    fontSize: 12,
    color: COLORS.primary,
    fontFamily: FONTS.primary,
    fontWeight: 'bold',
  },

  // Vocal Range
  vocalRangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  vocalRangeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  vocalRangeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textDark,
    fontFamily: FONTS.primary,
  },

  

  // Range Details
  rangeDetails: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  rangeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rangeLabel: {
    fontSize: 18,
    color: COLORS.textLight,
    fontFamily: FONTS.primary,
    flex: 1,
  },
  rangeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textDark,
    fontFamily: FONTS.primary,
  },

  // Best Fit Section
  bestFitSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  bestFitTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textDark,
    fontFamily: FONTS.primary,
    marginBottom: 15,
  },
  bestFitCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bestFitLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
    fontFamily: FONTS.primary,
    marginBottom: 4,
  },
  bestFitValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    fontFamily: FONTS.primary,
  },
  outOfRangeText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontFamily: FONTS.primary,
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 15,
    marginBottom: 20,
    marginTop: 20, // Add this line
  },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: FONTS.primary,
    letterSpacing: 1,
  },

  // Share Button
  shareButton: {
    marginHorizontal: 20,
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.textLight,
    marginBottom: 20,
  },
  shareButtonText: {
    color: COLORS.textLight,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: FONTS.primary,
    letterSpacing: 1,
  },

  // Report Button
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    paddingVertical: 12,
  },
  reportButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontFamily: FONTS.primary,
    marginLeft: 8,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: FONTS.primary,
  },
  listOptionAlwaysSaved: {
    backgroundColor: COLORS.secondary,
    padding: 14,
    borderRadius: 8,
    marginVertical: 4,
    alignItems: 'center',
  },
  listOptionTextAlwaysSaved: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
    fontFamily: FONTS.primary,
  },
  listOption: {
    backgroundColor: COLORS.background,
    padding: 14,
    borderRadius: 8,
    marginVertical: 4,
    alignItems: 'center',
  },
  listOptionText: {
    fontSize: 16,
    color: COLORS.textDark,
    fontFamily: FONTS.primary,
  },
  noListText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginVertical: 20,
    fontFamily: FONTS.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
    fontSize: 16,
    fontFamily: FONTS.primary,
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: FONTS.primary,
  },
  modalCancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCancelText: {
    color: COLORS.textLight,
    fontSize: 16,
    fontFamily: FONTS.primary,
  },
  issueInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    height: 120,
    textAlignVertical: 'top',
    marginVertical: 10,
    fontSize: 16,
    fontFamily: FONTS.primary,
  },
});