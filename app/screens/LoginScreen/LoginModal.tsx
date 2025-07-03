// File location: app/screens/LoginScreen/LoginModal.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { supabase } from "../../util/supabase";

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Function to handle login
  const handleLogin = async () => {
    try {
      // Step 1: Attempt login
      const { error } = await supabase.auth.signIn({ email, password });

      if (error) {
        Alert.alert("Login Failed", error.message);
        return;
      }

      // Step 2: Check user metadata for "deleted" status
      // (if it does contain DELETE this means the user recently set the account to delete, and this prevents users from spamming signup/delete)
      // (the user must wait before creating a new account with the same email)
      const user = supabase.auth.user();

      if (user?.user_metadata?.deleted) {
        Alert.alert(
          "Login Failed",
          "This account has been deleted. Contact support if this is a mistake voicevaultcontact@gmail.com"
        );
        await supabase.auth.signOut(); // Log out the user immediately
        return;
      }

      Alert.alert("Success", "Logged in successfully!");
      onClose(); // Close the modal after successful login
    } catch (err) {
      console.error("Login Error:", err);
      Alert.alert("An error occurred. Please try again.");
    }
  };

  // Function to handle forgot password
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Email Required", "Please enter your email address first.");
      return;
    }

    try {
      const { error } = await supabase.auth.api.resetPasswordForEmail(email);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        Alert.alert(
          "Password Reset Email Sent",
          "Please check your inbox for password reset instructions."
        );
      }
    } catch (err) {
      console.error("Password Reset Error:", err);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>Login</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#777"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#777"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>
        {/* Forgot Password */}
        <TouchableOpacity onPress={handleForgotPassword}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modal: {
    width: "80%",
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    padding: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    marginBottom: 15,
    color: "#000",
  },
  button: {
    backgroundColor: "#ff6600",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginBottom: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  forgotPasswordText: {
    color: "#007bff",
    fontSize: 14,
    marginBottom: 10,
    textDecorationLine: "underline",
  },
  cancelText: {
    color: "#007bff",
    fontSize: 16,
    marginTop: 10,
  },
});
