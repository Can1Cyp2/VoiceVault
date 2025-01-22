import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
} from "react-native";
import ProfileMenu from "./ProfileMenu";
import { supabase } from "../../util/supabase";

export default function ProfileScreen({ navigation }: any) {
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHelpVisible, setHelpVisible] = useState(false);

  // Fetch the user's display name
  const fetchDisplayName = async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setUsername("Edit your profile to add a username.");
      } else {
        const displayName = (user as any).user_metadata?.display_name;
        setUsername(displayName || "Edit your profile to add a username.");
      }
    } catch (err) {
      console.error("Error fetching display name:", err);
      setUsername("Edit your profile to add a username.");
    } finally {
      setIsLoading(false);
    }
  };

  // Run on component mount and listen for auth state changes
  useEffect(() => {
    fetchDisplayName();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          fetchDisplayName(); // Re-fetch username on login/logout
        } else {
          setUsername("Edit your profile to add a username.");
        }
      }
    );

    return () => {
      subscription?.subscription?.unsubscribe(); // Properly clean up the listener
    };
  }, []);

  // Handle logout and clear the username
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Logout Failed", error.message);
    } else {
      setUsername("Edit your profile to add a username.");
      Alert.alert("Logged Out", "You have successfully logged out.");
    }
    setMenuVisible(false);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
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
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("Search", { screen: "SavedLists" })}
      >
        <Text style={styles.buttonText}>View Saved Lists</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setMenuVisible(true)}
      >
        <Text style={styles.menuButtonText}>Open Profile Menu</Text>
      </TouchableOpacity>
      {isMenuVisible && (
        <ProfileMenu
          onClose={() => {
            fetchDisplayName(); // Refresh profile after closing
            setMenuVisible(false);
          }}
          onLogout={handleLogout}
        />
      )}
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

/*



























*/
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
    marginBottom: 30,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 5,
    marginBottom: 20,
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
    marginBottom: 20,
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
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 5,
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
