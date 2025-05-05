// File: app/screens/ProfileScreen/ProfileScreen.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from "react-native";
import ProfileMenu from "./ProfileMenu";
import { supabase } from "../../util/supabase";
import { fetchUserVocalRange } from "../../util/api";

export default function ProfileScreen({ navigation }: any) {
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [vocalRange, setVocalRange] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHelpVisible, setHelpVisible] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0); // Triggers refresh

  // Fetch user data (display name + vocal range)
  const fetchUserData = async () => {
    try {
      setIsLoading(true);

      const user = supabase.auth.user();

      if (!user) {
        setUsername("Edit your profile to add a username.");
        setVocalRange("Edit your profile to set a vocal range.");
      } else {
        const displayName = user.user_metadata?.display_name || "";
        setUsername(displayName || "Edit your profile to add a username.");
      }

      // Fetch vocal range
      const rangeData = await fetchUserVocalRange();
      if (rangeData) {
        const { min_range, max_range } = rangeData;
        setVocalRange(
          min_range === "C0" || max_range === "C0"
            ? "Edit your profile to set a vocal range."
            : `${min_range} - ${max_range}`
        );
      } else {
        setVocalRange("Edit your profile to set a vocal range.");
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Run on mount and listen for updates
  useEffect(() => {
    fetchUserData();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          fetchUserData();
        } else {
          setUsername("Edit your profile to add a username.");
          setVocalRange("Edit your profile to set a vocal range.");
        }
      }
    );
    
    return () => {
      subscription?.unsubscribe();
    };
  }, [updateTrigger]); // Refresh on updates

  // Handle logout
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Logout Failed", error.message);
    } else {
      setUsername("Edit your profile to add a username.");
      setVocalRange("Edit your profile to set a vocal range.");
      Alert.alert("Logged Out", "You have successfully logged out.");
    }
    setMenuVisible(false);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.username}>
        {(username ?? "").startsWith("Edit profile")
          ? username
          : `Username: ${username}`}
      </Text>
      {/* Display Vocal Range */}
      <Text style={styles.vocalRange}>{vocalRange}</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("Search", { screen: "SavedLists" })}
      >
        <Text style={styles.buttonText}>View Saved Lists</Text>
      </TouchableOpacity>

      {/* Profile Menu */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setMenuVisible(true)}
      >
        <Text style={styles.menuButtonText}>Open Profile Menu</Text>
      </TouchableOpacity>
      {isMenuVisible && (
        <ProfileMenu
          onClose={() => {
            setUpdateTrigger((prev) => prev + 1); // Triggers refresh
            setMenuVisible(false);
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Help Modal */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => setHelpVisible(true)}
      >
        <Text style={styles.helpButtonText}>!</Text>
      </TouchableOpacity>
      <Modal
        visible={isHelpVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHelpVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Need Help?</Text>
            <Text style={styles.modalText}>
              Please contact voicevaultcontact@gmail.com for any issues or
              inquiries.
            </Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setHelpVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  username: {
    fontSize: 18,
    color: "#555",
    marginBottom: 10,
    textAlign: "center",
  },
  vocalRange: {
    fontSize: 16,
    color: "#888",
    fontStyle: "italic",
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
    width: "80%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
  menuButton: {
    backgroundColor: "#4caf50",
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
    width: "80%",
    alignItems: "center",
  },
  menuButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  helpButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#f44336",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  helpButtonText: {
    color: "#fff",
    fontSize: 35,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 15,
  },
  modalText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginBottom: 20,
  },
  modalCloseButton: {
    backgroundColor: "#007bff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  modalCloseText: {
    color: "#fff",
    fontSize: 16,
  },
  loadingText: {
    fontSize: 18,
    color: "#555",
    textAlign: "center",
  },
});
