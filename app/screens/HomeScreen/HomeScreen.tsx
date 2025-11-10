import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Alert,
  Animated,
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
import { useTheme } from "../../contexts/ThemeContext";

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

  // Theme hook
  const { colors, isDark, setMode } = useTheme();

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
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      {/* Top Button Row */}
      <View style={styles.topButtonRow}>
        {/* Tools Button in Top Left */}
        <View style={styles.leftSection}>
          <TouchableOpacity
            style={styles.toolsButton}
            onPress={() => {
              // @ts-ignore - Navigate to nested screen
              navigation.navigate("Search", { 
                screen: "Metronome",
                initial: false 
              });
            }}
          >
            <Ionicons name="cog-outline" size={30} color={colors.primaryDark} />
            <Text style={[styles.toolsText, { color: colors.primaryDark }]}>Tools</Text>
          </TouchableOpacity>
        </View>

        {/* Support Button in Top Right */}
        <View style={styles.rightSection}>
          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => setSupportVisible(true)}
          >
            <Ionicons name="heart-outline" size={30} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Theme Toggle Button - Absolutely Centered */}
      <View style={styles.centerButtonContainer}>
        <TouchableOpacity
          style={styles.themeButton}
          onPress={() => setMode(isDark ? 'light' : 'dark')}
        >
          <Ionicons 
            name={isDark ? "moon" : "sunny"} 
            size={32} 
            color={isDark ? "#fbbf24" : "#f59e0b"} 
          />
        </TouchableOpacity>
      </View>

      {/* Logo Section */}
      <Image
        source={
          isDark
            ? require("../../../assets/transparent-icon-dark.png")
            : require("../../../assets/transparent-icon.png")
        }
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome to VoiceVault!</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Explore the world of vocal ranges and discover music like never before,
        with over 30,000 songs!
      </Text>
      {isLoggedIn ? (
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.link }]} onPress={handleLogout}>
          <Text style={[styles.buttonText, { color: colors.buttonText }]}>Logout</Text>
        </TouchableOpacity>
      ) : (
        <>
          <Animated.View
            style={[
              styles.button,
              { backgroundColor: colors.primaryDark },
              shouldGlow && styles.glowButton,
              shouldGlow && { opacity: blinkAnimation } // Add animated opacity
            ]}
          >
            <TouchableOpacity
              style={styles.buttonInner}
              onPress={() => setLoginVisible(true)}
            >
              <Text style={[styles.buttonText, { color: colors.buttonText }]}>Login</Text>
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity
            style={[styles.button, styles.signupButton, { backgroundColor: colors.link }]}
            onPress={() => setSignupVisible(true)}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>Sign Up</Text>
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
    padding: 20,
  },
  topButtonRow: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 10,
  },
  leftSection: {
    width: 100,
    alignItems: "flex-start",
  },
  centerButtonContainer: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 11, // Above the top button row
    pointerEvents: "box-none", // Allow clicks to pass through the container
  },
  rightSection: {
    width: 100,
    alignItems: "flex-end",
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginBottom: 10,
    width: "60%",
    alignItems: "center",
  },
  signupButton: {
    // backgroundColor will be set inline with theme
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  versionText: {
    fontSize: 12,
    paddingTop: 0,
    opacity: 0.5,
  },
  toolsButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  toolsText: {
    fontSize: 16,
    marginLeft: 5,
    fontWeight: "bold",
  },
  themeButton: {
    padding: 8,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "auto", // Ensure the button itself is clickable
  },
  supportButton: {
    flexDirection: "row",
    alignItems: "center",
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
