import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Alert,
  Animated,
  Platform,
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
import { SupportModal } from "../../components/SupportModal/SupportModal";
import { getLoginGlow, setLoginGlow } from "../../util/loginPrompt";

// Combined navigation props for tab and stack navigators
type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Home">,
  NativeStackScreenProps<RootStackParamList>
>;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [isLoginVisible, setLoginVisible] = useState(false);
  const [isSignupVisible, setSignupVisible] = useState(false);
  const [isLoggedIn, setLoggedIn] = useState(false);
  const [isSupportVisible, setSupportVisible] = useState(false);

  // State for login glow for users not logged in and clicking on the profile screen, and then choosing to log in
  const [shouldGlow, setShouldGlow] = useState(false);
  const [blinkAnimation] = useState(new Animated.Value(1));

  // Check if user is logged in when the component mounts
  useEffect(() => {
    const checkSession = async () => {
      const session = supabase.auth.session();
      setLoggedIn(!!session);
    };
    checkSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setLoggedIn(!!session);
      }
    );
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Set the header options
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          style={{ marginLeft: 15, flexDirection: 'row', alignItems: 'center' }}
          onPress={() => {
            // @ts-ignore - Navigate to nested screen
            navigation.navigate("Search", { 
              screen: "Metronome",
              initial: false 
            });
          }}
        >
          <Ionicons name="cog-outline" size={26} color="#ff6600" />
          <Text style={{ fontSize: 16, color: "#ff6600", marginLeft: 5, fontWeight: "bold" }}>
            Tools
          </Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ marginRight: 15 }}
            onPress={() => setSupportVisible(true)}
          >
            <Ionicons name="heart-outline" size={26} color="#e91e63" />
          </TouchableOpacity>
          {isLoggedIn && (
            <TouchableOpacity 
              style={{ marginRight: 15 }}
              onPress={() => navigation.navigate("SavedLists")}
            >
              <Ionicons
                name="list-circle-outline"
                size={26}
                color="#32CD32"
              />
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [isLoggedIn, navigation]);

  // Check for login glow flag
  useEffect(() => {
    const checkLoginGlow = () => {
      if (getLoginGlow()) {
        setShouldGlow(true);
        setLoginGlow(false); // Clear the flag

        // Start blinking animation
        const blink = Animated.loop(
          Animated.sequence([
            Animated.timing(blinkAnimation, {
              toValue: 0.3,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(blinkAnimation, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        );
        blink.start();

        // Remove glow and stop blinking after 5 seconds
        setTimeout(() => {
          setShouldGlow(false);
          blink.stop();
          blinkAnimation.setValue(1); // Reset to full opacity
        }, 5000);
      }
    };

    // Check immediately
    checkLoginGlow();

    // Check every 500ms for the flag
    const interval = setInterval(checkLoginGlow, 500);

    return () => clearInterval(interval);
  }, [blinkAnimation]);

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
      {/* Logo Section */}
      <Image
        source={require("../../../assets/transparent-icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Welcome to VoiceVault!</Text>
      <Text style={styles.subtitle}>
        Explore the world of vocal ranges and discover music like never before,
        with over 30,000 songs!
      </Text>
      {isLoggedIn ? (
        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      ) : (
        <>
          <Animated.View
            style={[
              styles.button,
              shouldGlow && styles.glowButton,
              shouldGlow && { opacity: blinkAnimation } // Add animated opacity
            ]}
          >
            <TouchableOpacity
              style={styles.buttonInner}
              onPress={() => setLoginVisible(true)}
            >
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>
          </Animated.View>
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

      <SupportModal visible={isSupportVisible} onClose={() => setSupportVisible(false)} />
      <Text style={styles.versionText}>Version 1.2.9</Text>
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
  glowButton: {
    shadowColor: "#ff6600",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 20, // For Android
    borderWidth: 2,
    borderColor: "rgba(255, 102, 0, 0.5)",
  },
  buttonInner: {
    width: "100%",
    alignItems: "center",
  },
});
