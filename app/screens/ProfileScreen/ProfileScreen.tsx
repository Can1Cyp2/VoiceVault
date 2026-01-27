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
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { supabase } from "../../util/supabase";
import { fetchUserVocalRange } from "../../util/api";
import { useAdminStatus, checkAdminStatus } from "../../util/adminUtils";
import { useTheme } from "../../contexts/ThemeContext";
import VocalRangeDetectorModal from "../TunerScreen/VocalRangeDetectorModal";
import EditProfileModal from "./EditProfileModal";

export default function ProfileScreen({ navigation }: any) {
  const { colors, isDark, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isEditProfileVisible, setEditProfileVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [vocalRange, setVocalRange] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHelpVisible, setHelpVisible] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0); // Triggers refresh
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [isRangeModalVisible, setRangeModalVisible] = useState(false);

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

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  };

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

  // Function to reset the user's password
  const handleResetPassword = async () => {
    try {
      const user = supabase.auth.user();

      if (!user?.email) {
        Alert.alert("Error", "No email found for the user.");
        return;
      }

      const { error } = await supabase.auth.api.resetPasswordForEmail(user.email);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        Alert.alert(
          "Success",
          "Password reset email sent. Please check your inbox."
        );
      }
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred.");
    }
  };

  // Function to delete user account and associated data
  const handleDeleteAccount = async () => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);

              const user = supabase.auth.user();

              if (!user) {
                setIsDeleting(false);
                Alert.alert("Error", "Could not fetch user details.");
                return;
              }

              const { error: updateError } = await supabase.auth.update({
                data: { deleted: true },
              });

              if (updateError) {
                Alert.alert("Error", "Failed to mark account as deleted. Please try again shortly or contact support if the issue persists voicevaultcontact@gmail.com");
                setIsDeleting(false);
                return;
              }

              await supabase.auth.signOut();
              setIsDeleting(false);
              Alert.alert("Success", "Your account has been deleted.");
              handleLogout();
            } catch (error) {
              console.error("Unexpected error:", error);
              setIsDeleting(false);
              Alert.alert("Error", "An unexpected error occurred.");
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  async function handleAdminAccess(event: GestureResponderEvent): Promise<void> {
    // Double-check admin status before navigation
    const { isAdmin: adminVerified } = await checkAdminStatus();
    
    if (!adminVerified) {
      Alert.alert(
        "Access Denied",
        "You don't have admin privileges.",
        [{ text: "OK" }]
      );
      return;
    }
    
    navigation.navigate("Search", { screen: "AdminProfileScreen" });
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header Section */}
        <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={80} color={colors.primary} />
        </View>
        <Text style={styles.title}>
          {(username ?? "").startsWith("Edit profile")
            ? "Welcome"
            : username}
        </Text>
        {coinBalance !== null && (
          <View style={styles.coinBadge}>
            <Image 
              source={require('../../../assets/coin-icon.png')} 
              style={styles.coinIcon}
            />
            <Text style={styles.coinBalance}>{coinBalance}</Text>
          </View>
        )}
      </View>

      {/* Vocal Range Card */}
      <View style={styles.infoCard}>
        <View style={styles.cardHeader}>
          <Ionicons name="musical-notes" size={24} color={colors.primary} />
          <Text style={styles.cardTitle}>Vocal Range</Text>
        </View>
        <Text style={styles.vocalRangeText}>{vocalRange}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Set My Range Button */}
        <TouchableOpacity
          style={styles.primaryActionButton}
          onPress={() => setRangeModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.actionButtonContent}>
            <View style={styles.actionIconContainer}>
              <Ionicons name="mic" size={24} color="#FFF" />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionButtonTitle}>Set My Vocal Range</Text>
              <Text style={styles.actionButtonSubtitle}>Auto-detect your range</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
          </View>
        </TouchableOpacity>

        {/* Saved Lists Button */}
        <TouchableOpacity
          style={styles.secondaryActionButton}
          onPress={() => navigation.navigate("Search", { screen: "SavedLists" })}
          activeOpacity={0.7}
        >
          <View style={styles.actionButtonContent}>
            <View style={[styles.actionIconContainer, { backgroundColor: colors.secondary }]}>
              <Ionicons name="list" size={24} color="#FFF" />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={[styles.actionButtonTitle, { color: colors.textPrimary }]}>View Saved Lists</Text>
              <Text style={[styles.actionButtonSubtitle, { color: colors.textSecondary }]}>Your collections</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
          </View>
        </TouchableOpacity>

        {/* Profile Settings Button */}
        <TouchableOpacity
          style={styles.secondaryActionButton}
          onPress={() => setMenuVisible(!isMenuVisible)}
          activeOpacity={0.7}
        >
          <View style={styles.actionButtonContent}>
            <View style={[styles.actionIconContainer, { backgroundColor: colors.success }]}>
              <Ionicons name="settings" size={24} color="#FFF" />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={[styles.actionButtonTitle, { color: colors.textPrimary }]}>Profile Settings</Text>
              <Text style={[styles.actionButtonSubtitle, { color: colors.textSecondary }]}>Edit your profile</Text>
            </View>
            <Ionicons 
              name={isMenuVisible ? "chevron-up" : "chevron-down"} 
              size={24} 
              color={colors.textTertiary} 
            />
          </View>
        </TouchableOpacity>

        {/* Expandable Dropdown Options */}
        {isMenuVisible && (
          <View style={styles.dropdownContainer}>
            {/* Edit Profile */}
            <TouchableOpacity
              style={styles.dropdownOption}
              onPress={() => {
                setEditProfileVisible(true);
                setMenuVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.dropdownText}>Edit Profile</Text>
            </TouchableOpacity>

            {/* Reset Password */}
            <TouchableOpacity
              style={styles.dropdownOption}
              onPress={() => {
                handleResetPassword();
                setMenuVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="key-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.dropdownText}>Reset Password</Text>
            </TouchableOpacity>

            {/* Delete Account */}
            <TouchableOpacity
              style={styles.dropdownOption}
              onPress={handleDeleteAccount}
              disabled={isDeleting}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.danger} style={{ marginLeft: 12 }} />
              ) : (
                <Text style={[styles.dropdownText, { color: colors.danger }]}>Delete Account</Text>
              )}
            </TouchableOpacity>

            {/* Admin Access - Only visible to admins */}
            {!adminLoading && isAdmin && (
              <TouchableOpacity
                style={styles.dropdownOption}
                onPress={(event) => {
                  handleAdminAccess(event);
                  setMenuVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dropdownText, { color: colors.warning }]}>Admin Panel</Text>
                  {adminDetails && typeof adminDetails === 'object' && 'role' in adminDetails && (
                    <Text style={[styles.adminRoleDropdown, { color: colors.textTertiary }]}>
                      {(adminDetails as any).role.replace("_", " ").toUpperCase()}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* Logout */}
            <TouchableOpacity
              style={[styles.dropdownOption, styles.dropdownOptionLast]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <Text style={[styles.dropdownText, { color: colors.danger }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      </ScrollView>

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

      {/* Vocal Range Detector Modal */}
      <VocalRangeDetectorModal
        visible={isRangeModalVisible}
        onClose={() => setRangeModalVisible(false)}
        onSuccess={(low, high) => {
          console.log('Vocal range saved:', low, high);
          setUpdateTrigger((prev) => prev + 1); // Refresh profile data
        }}
      />

      {/* Edit Profile Modal */}
      {isEditProfileVisible && (
        <Modal visible={isEditProfileVisible} transparent animationType="slide">
          <EditProfileModal
            onClose={() => {
              setEditProfileVisible(false);
              setUpdateTrigger((prev) => prev + 1); // Refresh profile data
            }}
          />
        </Modal>
      )}
    </View>
  );
}

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for floating buttons
  },
  header: {
    backgroundColor: colors.backgroundCard,
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  coinIcon: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },
  coinBalance: {
    fontSize: 16,
    color: colors.gold,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: colors.backgroundCard,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  vocalRangeText: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  primaryActionButton: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  secondaryActionButton: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionTextContainer: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
    marginBottom: 2,
  },
  actionButtonSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  // Dropdown Styles
  dropdownContainer: {
    backgroundColor: colors.backgroundCard,
    marginHorizontal: 20,
    marginTop: -4,
    borderRadius: 16,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  dropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingLeft: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  adminRoleDropdown: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 2,
  },
  helpButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: colors.dangerDark,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  helpButtonText: {
    color: colors.buttonText,
    fontSize: 32,
    fontWeight: "bold",
  },
  themeButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: colors.backgroundCard,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
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
