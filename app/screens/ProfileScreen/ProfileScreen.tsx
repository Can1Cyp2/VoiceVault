// File location: app/screens/ProfileScreen/ProfileScreen.tsx

import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import ProfileMenu from "./ProfileMenu";
import { supabase } from "../../util/supabase";

export default function ProfileScreen({ navigation }: any) {
  const [isMenuVisible, setMenuVisible] = useState(false); // State for showing the ProfileMenu
  const userEmail = "user@example.com"; // Replace with Supabase logic to fetch user email

  const handleNeedHelp = () => {
    Alert.alert(
      "Need Help?",
      "Please contact voicevaultcontact@gmail.com for any issues or inquiries"
    );
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Logout Failed", error.message);
    } else {
      Alert.alert("Logged Out", "You have successfully logged out.");
    }
    setMenuVisible(false); // Close the menu after logging out
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.email}>Email: {userEmail}</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("SavedListsScreen")}
      >
        <Text style={styles.buttonText}>View Saved Lists</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setMenuVisible(true)}
      >
        <Text style={styles.menuButtonText}>Open Profile Menu</Text>
      </TouchableOpacity>

      {/* ProfileMenu Modal */}
      {isMenuVisible && (
        <ProfileMenu
          onClose={() => setMenuVisible(false)}
          onLogout={handleLogout}
        />
      )}

      <TouchableOpacity style={styles.helpButton} onPress={handleNeedHelp}>
        <Text style={styles.helpButtonText}>Need Help?</Text>
      </TouchableOpacity>
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
  email: {
    fontSize: 18,
    color: "#555",
    marginBottom: 30,
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
    padding: 10,
    backgroundColor: "#f44336",
    borderRadius: 5,
    width: "80%",
    alignItems: "center",
  },
  helpButtonText: {
    color: "#fff",
    fontSize: 16,
  },
});
