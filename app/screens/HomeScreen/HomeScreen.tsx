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
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { TabParamList } from "../../../App";

// Combined navigation props for tab and stack navigators
type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Home">,
  NativeStackScreenProps<RootStackParamList>
>;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [isLoginVisible, setLoginVisible] = useState(false);
  const [isSignupVisible, setSignupVisible] = useState(false);
  const [isLoggedIn, setLoggedIn] = useState(false);

  // Check if user is logged in when the component mounts
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

  // Set the header options
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

  // Handle logout
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Logout Failed", error.message);
    } else {
      Alert.alert("Logged Out", "You have successfully logged out.");
    }
  };

  // Handle login and signup button presses
  return (
    <View style={styles.container}>
      {/* Tools Button in Top Left */}
      <TouchableOpacity
        style={styles.toolsButton}
        onPress={() => navigation.navigate("Search", { screen: "Metronome" })}
      >
        <Ionicons name="cog-outline" size={30} color="#ff6600" />
        <Text style={styles.toolsText}>Tools</Text>
      </TouchableOpacity>

      {/* Logo Section */}
      <Image
        source={require("../../../assets/transparent-icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Welcome to VoiceVault!</Text>
      <Text style={styles.subtitle}>
        Explore the world of vocal ranges and discover music like never before,
        with over 25,000 songs!
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
      <Text style={styles.versionText}>Version 1.2.2</Text>
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
  toolsButton: {
    position: "absolute",
    top: 60,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  toolsText: {
    fontSize: 16,
    color: "#ff6600",
    marginLeft: 5,
    fontWeight: "bold",
  },
});
