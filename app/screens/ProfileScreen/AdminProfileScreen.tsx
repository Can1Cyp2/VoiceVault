// File: app/screens/ProfileScreen/AdminScreen.tsx

/**
 * ADMIN SECURITY IMPLEMENTATION
 * 
 * This screen implements multiple layers of security to prevent unauthorized access:
 * 
 * 1. DATABASE LEVEL (Supabase):
 *    - RLS (Row Level Security) policies on admin tables
 *    - Server-side RPC function 'check_user_admin_status' verifies admin status
 *    - Admin table only accessible to authenticated admins
 * 
 * 2. UI LEVEL (ProfileScreen):
 *    - Admin button only visible when useAdminStatus() returns isAdmin=true
 *    - Double-verification before navigation via checkAdminStatus()
 *    - Alert shown if verification fails
 * 
 * 3. COMPONENT LEVEL (this screen):
 *    - Initial verification on mount via checkAdminStatus()
 *    - Periodic re-verification every 30 seconds
 *    - Auth state monitoring - kicks user out on sign-out or privilege revocation
 *    - isVerified flag blocks rendering until admin status confirmed
 *    - Early return with "Access Denied" if adminDetails is null
 *    - Navigation uses replace() to prevent back-button bypass
 * 
 * 4. SESSION LEVEL:
 *    - Monitors auth state changes (sign out, token refresh)
 *    - Re-verifies admin status on token refresh
 *    - Automatically redirects non-admins away from screen
 * 
 * An attacker would need to:
 *    - Bypass database RLS policies (requires database exploit)
 *    - Mock the RPC function response (requires server compromise)
 *    - Defeat multiple client-side checks (all referencing server truth)
 *    - Maintain admin flag during periodic re-verification
 * 
 * This defense-in-depth approach ensures only legitimate admins can access this panel.
 */

import React, { useState, useEffect, useMemo } from "react";
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
import { useTheme } from "../../contexts/ThemeContext";

import Constants from "expo-constants";
import * as Updates from "expo-updates";
import AdminQuickStats from './AdminQuickStats';

// Parse Supabase/Postgres timestamp strings like "2025-06-28 02:54:57.472176+00"
// into a JS Date reliably across platforms.
function parseSupabaseTimestamp(ts?: string | null): Date | null {
    if (!ts) return null;
    try {
        // Trim whitespace
        let s = ts.trim();

        // Replace the first space between date and time with a 'T' to make it ISO-like
        s = s.replace(' ', 'T');

        // If there are more than 3 fractional second digits (microseconds), truncate to milliseconds
        // e.g. .472176 -> .472
        s = s.replace(/\.(\d{3})\d+/, '.$1');

        // Normalize timezone formats: convert trailing +00 or +0000 to Z, and ensure offsets have a colon
        // Examples: +00 -> Z, +0000 -> +00:00, +01 -> +01:00
        // If it already ends with Z or +hh:mm, leave as-is
        if (/Z$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) {
            // ok
        } else if (/[+-]\d{2}$/.test(s)) {
            s = s.replace(/([+-]\d{2})$/, '$1:00');
        } else if (/[+-]\d{4}$/.test(s)) {
            s = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
        } else if (/[+-]0{2}(:?0{2})?$/.test(s)) {
            s = s.replace(/\+00(:?00)?$/, 'Z');
            s = s.replace(/-00(:?00)?$/, 'Z');
        }

        const d = new Date(s);
        if (!isNaN(d.getTime())) return d;

        // Fallback: parse manually with regex to handle microseconds and various offset formats
        const re = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:([+-])(\d{2}):?(\d{2})?)?$/;
        const m = s.match(re);
        if (!m) return null;

        const year = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        const day = parseInt(m[3], 10);
        const hour = parseInt(m[4], 10);
        const minute = parseInt(m[5], 10);
        const second = parseInt(m[6], 10);
        const frac = m[7] ? m[7].slice(0, 3).padEnd(3, '0') : '000'; // milliseconds
        const ms = parseInt(frac, 10);

        // timezone offset
        let offsetMinutes = 0;
        if (m[8]) {
            const sign = m[8] === '+' ? 1 : -1;
            const offH = parseInt(m[9] || '0', 10);
            const offM = parseInt(m[10] || '0', 10);
            offsetMinutes = sign * (offH * 60 + offM);
        }

        // Build UTC milliseconds by treating components as local to the given offset,
        // then subtract offset to get true UTC timestamp.
        const utcMs = Date.UTC(year, month, day, hour, minute, second, ms) - offsetMinutes * 60 * 1000;
        const out = new Date(utcMs);
        if (isNaN(out.getTime())) return null;
        return out;
    } catch (e) {
        console.error('parseSupabaseTimestamp error', e, ts);
        return null;
    }
}

function formatSupabaseDate(ts?: string | null) {
    const d = parseSupabaseTimestamp(ts);
    if (!d) return 'Invalid date';
    return d.toLocaleDateString();
}

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
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    
    const [adminDetails, setAdminDetails] = useState<AdminDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isVerified, setIsVerified] = useState(false);
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

    // Security: Verify admin status on mount and periodically
    useEffect(() => {
        let verificationInterval: NodeJS.Timeout;
        
        const verifyAdminAccess = async () => {
            const { isAdmin } = await checkAdminStatus();
            if (!isAdmin) {
                Alert.alert(
                    "Access Denied",
                    "You don't have admin privileges or your session has expired.",
                    [{ text: "OK", onPress: () => navigation.replace('Profile') }]
                );
                setIsVerified(false);
                return false;
            }
            setIsVerified(true);
            return true;
        };

        // Initial verification
        verifyAdminAccess().then(verified => {
            if (verified) {
                fetchAdminData();
                setupAdDebugMonitoring();
                
                // Re-verify every 30 seconds to ensure continued admin access
                verificationInterval = setInterval(async () => {
                    const stillAdmin = await verifyAdminAccess();
                    if (!stillAdmin) {
                        clearInterval(verificationInterval);
                    }
                }, 30000);
            }
        });

        return () => {
            if (verificationInterval) {
                clearInterval(verificationInterval);
            }
        };
    }, []);

    useEffect(() => {
        // Additional auth state monitoring
        const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                Alert.alert(
                    "Session Expired",
                    "You have been signed out.",
                    [{ text: "OK", onPress: () => navigation.replace('Home') }]
                );
            } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
                // Re-verify admin status on token refresh
                const { isAdmin } = await checkAdminStatus();
                if (!isAdmin) {
                    Alert.alert(
                        "Access Denied",
                        "Admin privileges have been revoked.",
                        [{ text: "OK", onPress: () => navigation.replace('Profile') }]
                    );
                }
            }
        });

        return () => subscription?.unsubscribe();
    }, []);

    // userStats are now provided by a dedicated component (AdminQuickStats)

    const addDebugLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `${timestamp}: ${message}`;
        setDebugLogs(prev => [logMessage, ...prev.slice(0, 19)]); // Keep last 20 logs
    };

    // Call the DB RPC to get canonical profile info (email, created_at, is_admin, role)
    const fetchAdminProfileRPC = async (uid: string) => {
        try {
            const { data, error } = await supabase.rpc('get_admin_profile', { p_uid: uid });
            if (error) {
                const errMsg = error && (error as any).message ? (error as any).message : JSON.stringify(error);
                addDebugLog(`get_admin_profile RPC error: ${errMsg}`);
                console.error('get_admin_profile RPC error', error);
                return null;
            }
            const row = Array.isArray(data) && data.length ? data[0] : data ?? null;
            addDebugLog(`get_admin_profile RPC success: ${JSON.stringify(row)}`);
            return row as any;
        } catch (e) {
            addDebugLog(`get_admin_profile exception: ${String(e)}`);
            console.error('get_admin_profile exception', e);
            return null;
        }
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

            // Try to enrich adminDetails with canonical profile info via RPC
            const currentUser = supabase.auth.user();
            addDebugLog(`checkAdminStatus returned adminDetails: ${JSON.stringify(adminDetails)}`);
            addDebugLog(`authenticated user id: ${currentUser?.id}`);
            const uidToUse = (adminDetails && (adminDetails.user_id || adminDetails.id)) || currentUser?.id || null;
            const rpcRow = uidToUse ? await fetchAdminProfileRPC(uidToUse) : null;
            const merged = { ...adminDetails } as any;
            if (rpcRow) {
                // rpcRow may have email, created_at, is_admin, role
                if (rpcRow.email) merged.email = rpcRow.email;
                if (rpcRow.created_at) merged.created_at = rpcRow.created_at;
                if (rpcRow.role) merged.role = rpcRow.role;
            }

            setAdminDetails(merged as AdminDetails);
            // stats handled by AdminQuickStats component
        } catch (error) {
            console.error("Error fetching admin data:", error);
            Alert.alert("Error", "Failed to load admin data");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUserStats = async () => {
        try {
            // Prefer a server-side RPC that can bypass RLS for admin stats if available
            try {
                const { data: rpcData, error: rpcError } = await supabase.rpc('admin_get_stats');
                if (!rpcError && rpcData) {
                    // expected shape: { total_users: number, new_today: number } or [ { ... } ]
                    const payload = Array.isArray(rpcData) ? rpcData[0] : rpcData;
                    const totalUsersRpc = payload?.total_users ?? payload?.totalUsers ?? 0;
                    const newTodayRpc = payload?.new_today ?? payload?.newToday ?? 0;
                    setUserStats({
                        totalUsers: totalUsersRpc,
                        activeUsers: totalUsersRpc,
                        newUsersToday: newTodayRpc,
                    });
                    return;
                }
            } catch (rpcEx) {
                // ignore and fall back to client queries
                addDebugLog(`RPC admin_get_stats not available or failed: ${JSON.stringify(rpcEx)}`);
            }
            // Use a minimal select('id') with head:true when only counts are needed.
            const { count: totalCount, error: totalError } = await supabase
                .from("profiles")
                .select("id", { count: "exact", head: true });

            if (totalError) {
                addDebugLog(`Error fetching total users: ${JSON.stringify(totalError)}`);
                throw totalError;
            }

            const today = new Date().toISOString().split("T")[0];
            const { count: todayCount, error: todayError } = await supabase
                .from("profiles")
                .select("id", { count: "exact", head: true })
                .gte("created_at", `${today}T00:00:00.000Z`)
                .lt("created_at", `${today}T23:59:59.999Z`);

            if (todayError) {
                addDebugLog(`Error fetching today's users: ${JSON.stringify(todayError)}`);
                throw todayError;
            }

            setUserStats({
                totalUsers: totalCount || 0,
                activeUsers: totalCount || 0,
                newUsersToday: todayCount || 0,
            });
        } catch (error) {
            console.error("Error fetching user stats:", error);
            const errMsg = error && (error as any).message ? (error as any).message : JSON.stringify(error);
            addDebugLog(`Error fetching user stats: ${errMsg}`);
            // If this is an RLS/permission issue, the error message will indicate so.
            const userMessage = /permission/i.test(errMsg) ?
                "Permission denied when reading profiles. Consider adding an admin RPC or adjusting RLS policies." :
                `Failed to fetch user stats: ${errMsg}`;
            Alert.alert("Stats Error", userMessage);
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
        navigation.navigate('ContentModerationScreen');
    };

    const handleAppSettings = () => {
        Alert.alert("App Settings", "This feature would allow you to configure global app settings and features.", [{ text: "OK" }]);
    };

    const handleAnalytics = () => {
        navigation.navigate('AdminAnalyticsScreen');
    };

    const handleSystemLogs = () => {
        Alert.alert("System Logs", "This feature would show system logs and error reports.", [{ text: "OK" }]);
    };

    const isExpoGo = Constants.appOwnership === "expo";

    // Security: Block rendering until verified
    if (isLoading || !isVerified) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ff4757" />
                <Text style={styles.loadingText}>
                    {isLoading ? "Loading Admin Panel..." : "Verifying Access..."}
                </Text>
            </View>
        );
    }

    if (!adminDetails) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Access Denied</Text>
                <Text style={styles.errorSubtext}>You don't have admin privileges.</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.replace('Profile')}>
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
                    <Text style={styles.infoValue}>{formatSupabaseDate(adminDetails.created_at)}</Text>
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
                <AdminQuickStats />
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

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: colors.textSecondary,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 20,
        backgroundColor: colors.backgroundCard,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: 10,
    },
    backButtonText: {
        fontSize: 16,
        color: colors.primary,
        fontWeight: "600",
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: colors.textPrimary,
    },
    placeholder: {
        width: 50,
    },
    adminCard: {
        margin: 20,
        padding: 20,
        backgroundColor: colors.backgroundCard,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    adminCardTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.textPrimary,
        marginBottom: 15,
    },
    adminInfo: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: "500",
    },
    infoValue: {
        fontSize: 14,
        color: colors.textPrimary,
        fontWeight: "600",
    },
    debugSection: {
        marginHorizontal: 20,
        marginBottom: 20,
    },
    debugCard: {
        backgroundColor: colors.backgroundCard,
        padding: 20,
        marginBottom: 12,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: colors.secondary,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    debugCardTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.textPrimary,
        marginBottom: 12,
    },
    statusItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    statusLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: "500",
    },
    statusValue: {
        fontSize: 14,
        color: colors.textPrimary,
        fontWeight: "600",
        flex: 1,
        textAlign: "right",
    },
    testButton: {
        backgroundColor: colors.secondary,
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        alignItems: "center",
    },
    testButtonText: {
        color: colors.buttonText,
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
        backgroundColor: colors.warning,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    clearButtonText: {
        color: colors.buttonText,
        fontSize: 12,
        fontWeight: "600",
    },
    logsContainer: {
        maxHeight: 200,
        backgroundColor: colors.backgroundTertiary,
        borderRadius: 8,
        padding: 12,
    },
    noLogsText: {
        color: colors.textTertiary,
        fontStyle: "italic",
        textAlign: "center",
        padding: 20,
    },
    logText: {
        fontSize: 12,
        color: colors.textPrimary,
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
        color: colors.textPrimary,
        marginBottom: 15,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.backgroundCard,
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
        color: colors.primary,
        marginBottom: 5,
    },
    statLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: "center",
    },
    actionsSection: {
        marginHorizontal: 20,
        marginBottom: 20,
    },
    actionButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.backgroundCard,
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
        color: colors.textPrimary,
        marginBottom: 4,
    },
    actionDescription: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    actionArrow: {
        fontSize: 20,
        color: colors.border,
    },
    errorText: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.danger,
        textAlign: "center",
        marginBottom: 10,
    },
    errorSubtext: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: 30,
    },
});