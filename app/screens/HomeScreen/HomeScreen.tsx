import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Alert,
} from "react-native";
import { supabase } from "../../util/supabase";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/StackNavigator";
import { Ionicons } from "@expo/vector-icons";
import LoginModal from "../LoginScreen/LoginModal";
import SignupModal from "../SignupScreen/SignupModal";

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, "Search">;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [isLoginVisible, setLoginVisible] = useState(false);
  const [isSignupVisible, setSignupVisible] = useState(false);
  const [isLoggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setLoggedIn(!!session);
    };
    checkSession();

    const { data } = supabase.auth.onAuthStateChange(
      async (event: string, session: { access_token: string } | null) => {
        setLoggedIn(!!session);
      }
    );
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={() => navigation.navigate("SavedLists")}>
            <Ionicons
              name="list-circle-outline"
              size={30}
              thickness={2}
              color="#32CD32" // Green color
              style={{ marginRight: 15 }}
            />
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({ headerRight: undefined });
    }
  }, [isLoggedIn, navigation]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Logout Failed", error.message);
    } else {
      Alert.alert("Logged Out", "You have successfully logged out.");
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo Section */}
      <Image
        source={require("../../../assets/transparent-icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Welcome to VoiceVault!</Text>
      <Text style={styles.subtitle}>
        Explore the world of vocal ranges and discover music like never before,
        with over 10,000 songs!
      </Text>
      {isLoggedIn ? (
        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={styles.button}
            onPress={() => setLoginVisible(true)}
          >
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.signupButton]}
            onPress={() => setSignupVisible(true)}
          >
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>
        </>
      )}
      <Modal visible={isLoginVisible} transparent animationType="slide">
        <LoginModal onClose={() => setLoginVisible(false)} />
      </Modal>
      <Modal visible={isSignupVisible} transparent animationType="slide">
        <SignupModal onClose={() => setSignupVisible(false)} />
      </Modal>
      <Text style={styles.versionText}>Version 1.0.9</Text>
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
  versionText: {
    fontSize: 12,
    color: "#888",
    paddingTop: 0,
    opacity: 0.5,
  },
});
