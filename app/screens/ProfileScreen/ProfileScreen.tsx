// File: app/screens/ProfileScreen/ProfileScreen.tsx

import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  ActivityIndicator,
  GestureResponderEvent,
  Image,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import ProfileMenu from "./ProfileMenu";
import { supabase } from "../../util/supabase";
import { fetchUserVocalRange } from "../../util/api";
import { useAdminStatus } from "../../util/adminUtils";
import { useTheme } from "../../contexts/ThemeContext";

export default function ProfileScreen({ navigation }: any) {
  const { colors, isDark, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [vocalRange, setVocalRange] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHelpVisible, setHelpVisible] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0); // Triggers refresh
  const [coinBalance, setCoinBalance] = useState<number | null>(null);

  // Admin status hook
  const { isAdmin, loading: adminLoading, adminDetails } = useAdminStatus();

  // Fetch user data (display name + vocal range)
  const fetchUserData = async () => {
    try {
      setIsLoading(true);

      const user = supabase.auth.user();

      if (!user) {
        setUsername("Edit your profile to add a username.");
        setVocalRange("Edit your profile to set a vocal range.");
      }

      if (user) {
        const displayName = user.user_metadata?.display_name || "";
        setUsername(displayName || "Edit your profile to add a username.");

        // Fetch coin balance
        const { data: coinData, error } = await supabase
          .from("user_coins")
          .select("coins")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error fetching coins:", error.message);
          setCoinBalance(null);
        } else {
          setCoinBalance(coinData?.coins || 0);
        }
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
      navigation.navigate("Home"),
        setUsername("Edit your profile to add a username.");
      setVocalRange("Edit your profile to set a vocal range.");
      Alert.alert("Logged Out", "You have successfully logged out.");
    }
    setMenuVisible(false);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  function handleAdminAccess(event: GestureResponderEvent): void {
    navigation.navigate("Search", { screen: "AdminProfileScreen" });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.username}>
        {(username ?? "").startsWith("Edit profile")
          ? username
          : `Username: ${username}`}
      </Text>
      {coinBalance !== null && (
        <View style={styles.coinBalanceContainer}>
          <Text style={styles.coinBalance}>Coins: </Text>
          <Image 
            source={require('../../../assets/coin-icon.png')} 
            style={styles.coinIcon}
          />
          <Text style={styles.coinBalance}> {coinBalance}</Text>
        </View>
      )}

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

      {/* Admin Access Button - Only visible to admins */}
      {!adminLoading && isAdmin && (
        <View style={styles.adminSection}>
          <Text style={styles.adminLabel}>🔒 Admin Access</Text>
          <TouchableOpacity
            style={styles.adminButton}
            onPress={handleAdminAccess}
          >
            <Text style={styles.adminButtonText}>Open Admin Panel</Text>
          </TouchableOpacity>
          {adminDetails && typeof adminDetails === 'object' && 'role' in adminDetails && (
            <Text style={styles.adminRole}>
              Role: {(adminDetails as any).role.replace("_", " ").toUpperCase()}
            </Text>
          )}
        </View>
      )}

      {/* Help Modal */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => setHelpVisible(true)}
      >
        <Text style={styles.helpButtonText}>!</Text>
      </TouchableOpacity>

      {/* Theme Toggle Button */}
      <TouchableOpacity
        style={styles.themeButton}
        onPress={() => setMode(isDark ? 'light' : 'dark')}
      >
        <Ionicons 
          name={isDark ? "moon" : "sunny"} 
          size={28} 
          color={isDark ? "#fbbf24" : "#f59e0b"} 
        />
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

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: colors.textPrimary,
  },
  username: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 10,
    textAlign: "center",
  },
  vocalRange: {
    fontSize: 16,
    color: colors.textTertiary,
    fontStyle: "italic",
    marginBottom: 20,
    textAlign: "center",
  },
  coinBalanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  coinBalance: {
    fontSize: 16,
    color: colors.gold,
    fontWeight: "600",
  },
  coinIcon: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },
  button: {
    backgroundColor: colors.secondary,
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
    width: "80%",
    alignItems: "center",
  },
  buttonText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: "600",
  },
  menuButton: {
    backgroundColor: colors.green,
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
    width: "80%",
    alignItems: "center",
  },
  menuButtonText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: "600",
  },
  // Admin Section Styles - Enhanced contrast
  adminSection: {
    marginTop: 20,
    padding: 20,
    backgroundColor: colors.highlightAlt,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    width: "80%",
    alignItems: "center",
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  adminLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.danger,
    marginBottom: 12,
    textAlign: "center",
  },
  adminButton: {
    backgroundColor: colors.danger,
    padding: 15,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    marginBottom: 8,
  },
  adminButtonText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: "600",
  },
  adminRole: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
  },
  helpButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: colors.dangerDark,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  helpButtonText: {
    color: colors.buttonText,
    fontSize: 35,
    fontWeight: "bold",
  },
  themeButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: colors.backgroundCard,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.overlay,
  },
  modalContent: {
    width: "80%",
    padding: 20,
    backgroundColor: colors.backgroundCard,
    borderRadius: 10,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 15,
    color: colors.textPrimary,
  },
  modalText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  modalCloseButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  modalCloseText: {
    color: colors.buttonText,
    fontSize: 16,
    fontWeight: "600",
  },
  loadingText: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 10,
  },
});
