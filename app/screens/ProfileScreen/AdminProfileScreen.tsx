// File: app/screens/ProfileScreen/AdminScreen.tsx

import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
} from "react-native";
import { supabase } from "../../util/supabase";
import { checkAdminStatus } from "../../util/adminUtils";

// 
import Constants from "expo-constants";
import * as Updates from "expo-updates";

interface AdminScreenProps {
    navigation: any;
}

interface AdminDetails {
    id: string;
    user_id: string;
    email: string;
    role: string;
    created_at: string;
    is_active: boolean;
}

export default function AdminProfileScreen({ navigation }: AdminScreenProps) {
    const [adminDetails, setAdminDetails] = useState<AdminDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userStats, setUserStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        newUsersToday: 0,
    });

    useEffect(() => {
        fetchAdminData();
    }, []);

    const fetchAdminData = async () => {
        try {
            setIsLoading(true);

            // Use the new checkAdminStatus function that gets both status and details
            const { isAdmin, adminDetails } = await checkAdminStatus();

            if (!isAdmin) {
                Alert.alert("Access Denied", "You don't have admin privileges");
                navigation.goBack(); // or navigate to a different screen
                return;
            }

            setAdminDetails(adminDetails);

            // Fetch some basic stats
            await fetchUserStats();
        } catch (error) {
            console.error("Error fetching admin data:", error);
            Alert.alert("Error", "Failed to load admin data");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUserStats = async () => {
        try {
            // Get total users count
            const { count: totalCount, error: totalError } = await supabase
                .from("profiles")
                .select("*", { count: "exact", head: true });

            if (totalError) throw totalError;

            // Get users created today
            const today = new Date().toISOString().split("T")[0];
            const { count: todayCount, error: todayError } = await supabase
                .from("profiles")
                .select("*", { count: "exact", head: true })
                .gte("created_at", `${today}T00:00:00.000Z`)
                .lt("created_at", `${today}T23:59:59.999Z`);

            if (todayError) throw todayError;

            setUserStats({
                totalUsers: totalCount || 0,
                activeUsers: totalCount || 0, // For now, assuming all users are active
                newUsersToday: todayCount || 0,
            });
        } catch (error) {
            console.error("Error fetching user stats:", error);
        }
    };

    const handleUserManagement = () => {
        Alert.alert(
            "User Management",
            "This feature would allow you to view, edit, and manage user accounts.",
            [{ text: "OK" }]
        );
    };

    const handleContentModeration = () => {
        Alert.alert(
            "Content Moderation",
            "This feature would allow you to moderate user-generated content and reports.",
            [{ text: "OK" }]
        );
    };

    const handleAppSettings = () => {
        Alert.alert(
            "App Settings",
            "This feature would allow you to configure global app settings and features.",
            [{ text: "OK" }]
        );
    };

    const handleAnalytics = () => {
        Alert.alert(
            "Analytics",
            "This feature would show detailed app usage analytics and metrics.",
            [{ text: "OK" }]
        );
    };

    const handleSystemLogs = () => {
        Alert.alert(
            "System Logs",
            "This feature would show system logs and error reports.",
            [{ text: "OK" }]
        );
    };

    const isExpoGo = Constants.appOwnership === "expo";
    const SHOW_INSPECTOR = !isExpoGo; // show on any native build


    // >>> ADD THIS: open Ad Inspector without touching AdService
    const handleOpenAdInspector = async () => {
        if (isExpoGo) { Alert.alert("Ad Inspector", "Requires a native build."); return; }
        try {
            const { MobileAds } = await import("react-native-google-mobile-ads");
            await MobileAds().initialize();         // ensure SDK ready
            await MobileAds().openAdInspector();    // open inspector
        } catch (e: any) {
            Alert.alert("Ad Inspector", "Unavailable in this build.");
        }
    };


    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ff4757" />
                <Text style={styles.loadingText}>Loading Admin Panel...</Text>
            </View>
        );
    }

    if (!adminDetails) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Access Denied</Text>
                <Text style={styles.errorSubtext}>You don't have admin privileges.</Text>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Admin Panel</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Admin Info Card */}
            <View style={styles.adminCard}>
                <Text style={styles.adminCardTitle}>Admin Information</Text>
                <View style={styles.adminInfo}>
                    <Text style={styles.infoLabel}>Role:</Text>
                    <Text style={styles.infoValue}>
                        {adminDetails.role.replace("_", " ").toUpperCase()}
                    </Text>
                </View>
                <View style={styles.adminInfo}>
                    <Text style={styles.infoLabel}>Email:</Text>
                    <Text style={styles.infoValue}>{adminDetails.email}</Text>
                </View>
                <View style={styles.adminInfo}>
                    <Text style={styles.infoLabel}>Admin Since:</Text>
                    <Text style={styles.infoValue}>
                        {new Date(adminDetails.created_at).toLocaleDateString()}
                    </Text>
                </View>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsSection}>
                <Text style={styles.sectionTitle}>Quick Stats</Text>
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{userStats.totalUsers}</Text>
                        <Text style={styles.statLabel}>Total Users</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{userStats.activeUsers}</Text>
                        <Text style={styles.statLabel}>Active Users</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{userStats.newUsersToday}</Text>
                        <Text style={styles.statLabel}>New Today</Text>
                    </View>
                </View>
            </View>

            {/* Admin Actions */}
            <View style={styles.actionsSection}>
                <Text style={styles.sectionTitle}>Admin Actions</Text>

                {SHOW_INSPECTOR && !isExpoGo && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleOpenAdInspector}
                    >
                        <Text style={styles.actionIcon}>🧪</Text>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>Ad Inspector (Internal)</Text>
                            <Text style={styles.actionDescription}>
                                Debug ad serving & consent. Also enable Single ad source testing
                                for AdMob Network.
                            </Text>
                        </View>
                        <Text style={styles.actionArrow}>›</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleUserManagement}
                >
                    <Text style={styles.actionIcon}>👥</Text>
                    <View style={styles.actionContent}>
                        <Text style={styles.actionTitle}>User Management</Text>
                        <Text style={styles.actionDescription}>
                            View, edit, and manage user accounts
                        </Text>
                    </View>
                    <Text style={styles.actionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleContentModeration}
                >
                    <Text style={styles.actionIcon}>🛡️</Text>
                    <View style={styles.actionContent}>
                        <Text style={styles.actionTitle}>Content Moderation</Text>
                        <Text style={styles.actionDescription}>
                            Moderate content and handle reports
                        </Text>
                    </View>
                    <Text style={styles.actionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleAnalytics}
                >
                    <Text style={styles.actionIcon}>📊</Text>
                    <View style={styles.actionContent}>
                        <Text style={styles.actionTitle}>Analytics</Text>
                        <Text style={styles.actionDescription}>
                            View app usage and performance metrics
                        </Text>
                    </View>
                    <Text style={styles.actionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleAppSettings}
                >
                    <Text style={styles.actionIcon}>⚙️</Text>
                    <View style={styles.actionContent}>
                        <Text style={styles.actionTitle}>App Settings</Text>
                        <Text style={styles.actionDescription}>
                            Configure global app settings
                        </Text>
                    </View>
                    <Text style={styles.actionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleSystemLogs}
                >
                    <Text style={styles.actionIcon}>📋</Text>
                    <View style={styles.actionContent}>
                        <Text style={styles.actionTitle}>System Logs</Text>
                        <Text style={styles.actionDescription}>
                            View system logs and error reports
                        </Text>
                    </View>
                    <Text style={styles.actionArrow}>›</Text>
                </TouchableOpacity>
            </View>

            {/* Warning Section */}
            <View style={styles.warningSection}>
                <Text style={styles.warningTitle}>⚠️ Admin Responsibilities</Text>
                <Text style={styles.warningText}>
                    As an admin, you have access to sensitive user data and system controls.
                    Please use these privileges responsibly and in accordance with privacy policies.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f5f5",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f5f5f5",
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: "#666",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 20,
        backgroundColor: "white",
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
    },
    backButton: {
        padding: 10,
    },
    backButtonText: {
        fontSize: 16,
        color: "#ff4757",
        fontWeight: "600",
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
    },
    placeholder: {
        width: 50,
    },
    adminCard: {
        margin: 20,
        padding: 20,
        backgroundColor: "white",
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: "#ff4757",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    adminCardTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 15,
    },
    adminInfo: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 14,
        color: "#666",
        fontWeight: "500",
    },
    infoValue: {
        fontSize: 14,
        color: "#333",
        fontWeight: "600",
    },
    statsSection: {
        marginHorizontal: 20,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 15,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    statCard: {
        flex: 1,
        backgroundColor: "white",
        padding: 20,
        marginHorizontal: 5,
        borderRadius: 12,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#ff4757",
        marginBottom: 5,
    },
    statLabel: {
        fontSize: 12,
        color: "#666",
        textAlign: "center",
    },
    actionsSection: {
        marginHorizontal: 20,
        marginBottom: 20,
    },
    actionButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "white",
        padding: 20,
        marginBottom: 12,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    actionIcon: {
        fontSize: 24,
        marginRight: 15,
    },
    actionContent: {
        flex: 1,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
        marginBottom: 4,
    },
    actionDescription: {
        fontSize: 14,
        color: "#666",
    },
    actionArrow: {
        fontSize: 20,
        color: "#ccc",
    },
    warningSection: {
        margin: 20,
        padding: 20,
        backgroundColor: "#fff3cd",
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: "#ffc107",
    },
    warningTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#856404",
        marginBottom: 10,
    },
    warningText: {
        fontSize: 14,
        color: "#856404",
        lineHeight: 20,
    },
    errorText: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#ff4757",
        textAlign: "center",
        marginBottom: 10,
    },
    errorSubtext: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
        marginBottom: 30,
    },
});