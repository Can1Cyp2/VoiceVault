// app\screens\ProfileScreen\ProfileMenu.tsx

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";

export default function ProfileMenu({
  onClose,
  onLogout,
}: {
  onClose: () => void;
  onLogout: () => void;
}) {
  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <TouchableOpacity
          style={styles.option}
          onPress={() => alert("Edit Profile")}
        >
          <Text style={styles.optionText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.option}
          onPress={() => alert("Reset Password")}
        >
          <Text style={styles.optionText}>Reset Password</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={onLogout}>
          <Text style={[styles.optionText, { color: "red" }]}>Logout</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {},
  modal: {
    width: "80%",
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    alignItems: "center",
  },
  option: {
    paddingVertical: 10,
    width: "100%",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  optionText: {
    fontSize: 16,
    color: "#555",
  },
  closeText: {
    fontSize: 16,
    color: "#007bff",
    marginTop: 20,
    backgroundColor: "#d9d9d9",
    padding: 5,
    borderRadius: 5,
  },
});
