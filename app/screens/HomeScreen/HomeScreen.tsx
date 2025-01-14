import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useState } from "react";
import LoginModal from "../LoginScreen/LoginModal";
import SignupModal from "../SignupScreen/SignupModal";

export default function HomeScreen() {
  const [isLoginVisible, setLoginVisible] = useState(false);
  const [isSignupVisible, setSignupVisible] = useState(false);

  return (
    <View style={styles.container}>
      {/* Logo Section */}
      <Image
        source={require("../../../assets/icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      {/* Welcome Text */}
      <Text style={styles.title}>Welcome to VoiceVault!</Text>
      <Text style={styles.subtitle}>
        Explore the world of vocal ranges and discover music like never before.
      </Text>
      {/* Login Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => setLoginVisible(true)}
      >
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>
      {/* Signup Button */}
      <TouchableOpacity
        style={[styles.button, styles.signupButton]}
        onPress={() => setSignupVisible(true)}
      >
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>
      {/* Modals */}
      <Modal visible={isLoginVisible} transparent animationType="slide">
        <LoginModal onClose={() => setLoginVisible(false)} />
      </Modal>
      <Modal visible={isSignupVisible} transparent animationType="slide">
        <SignupModal onClose={() => setSignupVisible(false)} />
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
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ff6600",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
  },
  button: {
    backgroundColor: "#ff6600",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginBottom: 10,
    width: "60%",
    alignItems: "center",
  },
  signupButton: {
    backgroundColor: "#007bff",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
