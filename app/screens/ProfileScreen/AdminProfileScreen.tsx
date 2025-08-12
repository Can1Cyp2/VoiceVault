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
    Platform,
} from "react-native";
import { supabase } from "../../util/supabase";
import { checkAdminStatus } from "../../util/adminUtils";
import { adService } from "../../components/SupportModal/AdService"; // Import your ad service

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

interface AdDebugInfo {
    lastError: string | null;
    adMobInitialized: boolean;
    consentStatus: string;
    rewardedAdLoaded: boolean;
    interstitialAdLoaded: boolean;
    lastAdAttempt: string | null;
    platform: string;
    isDev: boolean;
}

export default function AdminProfileScreen({ navigation }: AdminScreenProps) {
    const [adminDetails, setAdminDetails] = useState<AdminDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userStats, setUserStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        newUsersToday: 0,
    });
    const [adDebugInfo, setAdDebugInfo] = useState<AdDebugInfo>({
        lastError: null,
        adMobInitialized: false,
        consentStatus: 'Unknown',
        rewardedAdLoaded: false,
        interstitialAdLoaded: false,
        lastAdAttempt: null,
        platform: Platform.OS,
        isDev: __DEV__
    });
    const [debugLogs, setDebugLogs] = useState<string[]>([]);

    useEffect(() => {
        fetchAdminData();
        setupAdDebugMonitoring();
    }, []);

    const addDebugLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `${timestamp}: ${message}`;
        setDebugLogs(prev => [logMessage, ...prev.slice(0, 19)]); // Keep last 20 logs
    };

    const setupAdDebugMonitoring = async () => {
        // Override console methods to capture ad-related logs
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        const originalConsoleWarn = console.warn;

        console.log = (...args) => {
            const message = args.join(' ');
            if (message.toLowerCase().includes('ad') || message.toLowerCase().includes('admob')) {
                addDebugLog(`LOG: ${message}`);
            }
            originalConsoleLog(...args);
        };

        console.error = (...args) => {
            const message = args.join(' ');
            if (message.toLowerCase().includes('ad') || message.toLowerCase().includes('admob')) {
                addDebugLog(`ERROR: ${message}`);
                setAdDebugInfo(prev => ({ ...prev, lastError: message }));
            }
            originalConsoleError(...args);
        };

        console.warn = (...args) => {
            const message = args.join(' ');
            if (message.toLowerCase().includes('ad') || message.toLowerCase().includes('admob')) {
                addDebugLog(`WARN: ${message}`);
            }
            originalConsoleWarn(...args);
        };

        // Get initial ad status
        await checkAdStatus();
    };

    const getDeviceIdForTesting = async () => {
        try {
            if (Constants.appOwnership === "expo") {
                addDebugLog("Cannot get device ID in Expo Go");
                return;
            }

            const { MobileAds, TestIds, RewardedAd, AdEventType } = await import("react-native-google-mobile-ads");

            // Initialize without test devices first
            await MobileAds().initialize();

            // Try to load a test ad to trigger the device ID log
            const testAd = RewardedAd.createForAdRequest(TestIds.REWARDED);

            // Add error listener to catch device ID
            testAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
                console.log('Ad error (look for device ID in logs):', error);
                addDebugLog(`Ad error: ${JSON.stringify(error)}`);
            });

            addDebugLog("Loading test ad to get device ID - check device logs for test device identifier");
            await testAd.load();

        } catch (error) {
            addDebugLog(`Error getting device ID: ${error}`);
        }
    };

    const checkAdStatus = async () => {
        try {
            if (Constants.appOwnership === "expo") {
                addDebugLog("Running in Expo Go - ads disabled");
                return;
            }

            const { MobileAds, AdsConsent } = await import("react-native-google-mobile-ads");

            // Check AdMob initialization
            try {
                await MobileAds().initialize();
                setAdDebugInfo(prev => ({ ...prev, adMobInitialized: true }));
                addDebugLog("AdMob SDK initialized successfully");
            } catch (error) {
                addDebugLog(`AdMob initialization failed: ${error}`);
            }

            // Check consent status
            try {
                const consentInfo = await AdsConsent.getConsentInfo();
                setAdDebugInfo(prev => ({
                    ...prev,
                    consentStatus: `Can request ads: ${consentInfo.canRequestAds}`
                }));
                addDebugLog(`Consent status: ${JSON.stringify(consentInfo)}`);
            } catch (error) {
                addDebugLog(`Consent check failed: ${error}`);
            }

        } catch (error) {
            addDebugLog(`Ad status check failed: ${error}`);
        }
    };

    const testRewardedAd = async () => {
        addDebugLog("Admin testing rewarded ad...");
        setAdDebugInfo(prev => ({ ...prev, lastAdAttempt: 'Rewarded Ad' }));

        try {
            const result = await adService.showRewardedAd();
            addDebugLog(`Rewarded ad result: ${result ? 'SUCCESS' : 'FAILED'}`);
        } catch (error) {
            addDebugLog(`Rewarded ad error: ${error}`);
        }
    };

    const testInterstitialAd = async () => {
        addDebugLog("Admin testing interstitial ad...");
        setAdDebugInfo(prev => ({ ...prev, lastAdAttempt: 'Interstitial Ad' }));

        try {
            const result = await adService.showInterstitialAd();
            addDebugLog(`Interstitial ad result: ${result ? 'SUCCESS' : 'FAILED'}`);
        } catch (error) {
            addDebugLog(`Interstitial ad error: ${error}`);
        }
    };

    const clearDebugLogs = () => {
        setDebugLogs([]);
        setAdDebugInfo(prev => ({ ...prev, lastError: null, lastAdAttempt: null }));
        addDebugLog("Debug logs cleared");
    };

    const fetchAdminData = async () => {
        try {
            setIsLoading(true);

            const { isAdmin, adminDetails } = await checkAdminStatus();

            if (!isAdmin) {
                Alert.alert("Access Denied", "You don't have admin privileges");
                navigation.goBack();
                return;
            }

            setAdminDetails(adminDetails);
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
            const { count: totalCount, error: totalError } = await supabase
                .from("profiles")
                .select("*", { count: "exact", head: true });

            if (totalError) throw totalError;

            const today = new Date().toISOString().split("T")[0];
            const { count: todayCount, error: todayError } = await supabase
                .from("profiles")
                .select("*", { count: "exact", head: true })
                .gte("created_at", `${today}T00:00:00.000Z`)
                .lt("created_at", `${today}T23:59:59.999Z`);

            if (todayError) throw todayError;

            setUserStats({
                totalUsers: totalCount || 0,
                activeUsers: totalCount || 0,
                newUsersToday: todayCount || 0,
            });
        } catch (error) {
            console.error("Error fetching user stats:", error);
        }
    };

    const handleOpenAdInspector = async () => {
        const isExpoGo = Constants.appOwnership === "expo";
        if (isExpoGo) {
            Alert.alert("Ad Inspector", "Requires a native build (not Expo Go).");
            return;
        }
        try {
            const { MobileAds } = await import("react-native-google-mobile-ads");

            if (__DEV__) {
                await MobileAds().setRequestConfiguration({
                    testDeviceIdentifiers: ['3BCF74E4-2002-4788-B97C-84D1F37DEBC7'],
                });
                addDebugLog("Test device ID set for Ad Inspector");
            }

            await MobileAds().initialize();
            await MobileAds().openAdInspector();
            addDebugLog("Ad Inspector opened");
        } catch (e: any) {
            const errorMsg = `Ad Inspector error: ${e?.code} ${e?.message}`;
            addDebugLog(errorMsg);
            Alert.alert("Ad Inspector", `Unavailable:\n${e?.code ?? ""} ${e?.message ?? "Unknown error"}`);
        }
    };

    const handleUserManagement = () => {
        Alert.alert("User Management", "This feature would allow you to view, edit, and manage user accounts.", [{ text: "OK" }]);
    };

    const handleContentModeration = () => {
        Alert.alert("Content Moderation", "This feature would allow you to moderate user-generated content and reports.", [{ text: "OK" }]);
    };

    const handleAppSettings = () => {
        Alert.alert("App Settings", "This feature would allow you to configure global app settings and features.", [{ text: "OK" }]);
    };

    const handleAnalytics = () => {
        Alert.alert("Analytics", "This feature would show detailed app usage analytics and metrics.", [{ text: "OK" }]);
    };

    const handleSystemLogs = () => {
        Alert.alert("System Logs", "This feature would show system logs and error reports.", [{ text: "OK" }]);
    };

    const isExpoGo = Constants.appOwnership === "expo";

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
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
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
                    <Text style={styles.infoValue}>{adminDetails.role.replace("_", " ").toUpperCase()}</Text>
                </View>
                <View style={styles.adminInfo}>
                    <Text style={styles.infoLabel}>Email:</Text>
                    <Text style={styles.infoValue}>{adminDetails.email}</Text>
                </View>
                <View style={styles.adminInfo}>
                    <Text style={styles.infoLabel}>Admin Since:</Text>
                    <Text style={styles.infoValue}>{new Date(adminDetails.created_at).toLocaleDateString()}</Text>
                </View>
            </View>

            {/* Ad Debug Section */}
            <View style={styles.debugSection}>
                <Text style={styles.sectionTitle}>🐛 Ad Debug Panel</Text>

                {/* Ad Status */}
                <View style={styles.debugCard}>
                    <Text style={styles.debugCardTitle}>Ad System Status</Text>
                    <View style={styles.statusItem}>
                        <Text style={styles.statusLabel}>Platform:</Text>
                        <Text style={styles.statusValue}>{adDebugInfo.platform} ({adDebugInfo.isDev ? 'DEV' : 'PROD'})</Text>
                    </View>
                    <View style={styles.statusItem}>
                        <Text style={styles.statusLabel}>AdMob Initialized:</Text>
                        <Text style={[styles.statusValue, { color: adDebugInfo.adMobInitialized ? '#4CAF50' : '#F44336' }]}>
                            {adDebugInfo.adMobInitialized ? 'YES' : 'NO'}
                        </Text>
                    </View>
                    <View style={styles.statusItem}>
                        <Text style={styles.statusLabel}>Consent Status:</Text>
                        <Text style={styles.statusValue}>{adDebugInfo.consentStatus}</Text>
                    </View>
                    {adDebugInfo.lastError && (
                        <View style={styles.statusItem}>
                            <Text style={styles.statusLabel}>Last Error:</Text>
                            <Text style={[styles.statusValue, { color: '#F44336' }]}>{adDebugInfo.lastError}</Text>
                        </View>
                    )}
                </View>

                {/* Ad Test Buttons */}
                <View style={styles.debugCard}>
                    <Text style={styles.debugCardTitle}>Test Ads</Text>
                    <TouchableOpacity style={styles.testButton} onPress={testRewardedAd}>
                        <Text style={styles.testButtonText}>🎁 Test Rewarded Ad</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.testButton} onPress={testInterstitialAd}>
                        <Text style={styles.testButtonText}>📺 Test Interstitial Ad</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.testButton} onPress={checkAdStatus}>
                        <Text style={styles.testButtonText}>🔄 Refresh Ad Status</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.testButton, { backgroundColor: '#9C27B0' }]} onPress={getDeviceIdForTesting}>
                        <Text style={styles.testButtonText}>📱 Get Device ID</Text>
                    </TouchableOpacity>
                </View>

                {/* Debug Logs */}
                <View style={styles.debugCard}>
                    <View style={styles.logsHeader}>
                        <Text style={styles.debugCardTitle}>Debug Logs</Text>
                        <TouchableOpacity style={styles.clearButton} onPress={clearDebugLogs}>
                            <Text style={styles.clearButtonText}>Clear</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.logsContainer} nestedScrollEnabled>
                        {debugLogs.length === 0 ? (
                            <Text style={styles.noLogsText}>No logs yet. Test an ad to see debug info.</Text>
                        ) : (
                            debugLogs.map((log, index) => (
                                <Text key={index} style={styles.logText}>{log}</Text>
                            ))
                        )}
                    </ScrollView>
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

                {!isExpoGo && (
                    <TouchableOpacity style={styles.actionButton} onPress={handleOpenAdInspector}>
                        <Text style={styles.actionIcon}>🧪</Text>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>Ad Inspector</Text>
                            <Text style={styles.actionDescription}>Debug ad serving & consent</Text>
                        </View>
                        <Text style={styles.actionArrow}>›</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.actionButton} onPress={handleUserManagement}>
                    <Text style={styles.actionIcon}>👥</Text>
                    <View style={styles.actionContent}>
                        <Text style={styles.actionTitle}>User Management</Text>
                        <Text style={styles.actionDescription}>View, edit, and manage user accounts</Text>
                    </View>
                    <Text style={styles.actionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleContentModeration}>
                    <Text style={styles.actionIcon}>🛡️</Text>
                    <View style={styles.actionContent}>
                        <Text style={styles.actionTitle}>Content Moderation</Text>
                        <Text style={styles.actionDescription}>Moderate content and handle reports</Text>
                    </View>
                    <Text style={styles.actionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleAnalytics}>
                    <Text style={styles.actionIcon}>📊</Text>
                    <View style={styles.actionContent}>
                        <Text style={styles.actionTitle}>Analytics</Text>
                        <Text style={styles.actionDescription}>View app usage and performance metrics</Text>
                    </View>
                    <Text style={styles.actionArrow}>›</Text>
                </TouchableOpacity>
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
    debugSection: {
        marginHorizontal: 20,
        marginBottom: 20,
    },
    debugCard: {
        backgroundColor: "white",
        padding: 20,
        marginBottom: 12,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: "#2196F3",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    debugCardTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 12,
    },
    statusItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    statusLabel: {
        fontSize: 14,
        color: "#666",
        fontWeight: "500",
    },
    statusValue: {
        fontSize: 14,
        color: "#333",
        fontWeight: "600",
        flex: 1,
        textAlign: "right",
    },
    testButton: {
        backgroundColor: "#2196F3",
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        alignItems: "center",
    },
    testButtonText: {
        color: "white",
        fontWeight: "600",
        fontSize: 14,
    },
    logsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    clearButton: {
        backgroundColor: "#FF9800",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    clearButtonText: {
        color: "white",
        fontSize: 12,
        fontWeight: "600",
    },
    logsContainer: {
        maxHeight: 200,
        backgroundColor: "#f8f8f8",
        borderRadius: 8,
        padding: 12,
    },
    noLogsText: {
        color: "#999",
        fontStyle: "italic",
        textAlign: "center",
        padding: 20,
    },
    logText: {
        fontSize: 12,
        color: "#333",
        marginBottom: 4,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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