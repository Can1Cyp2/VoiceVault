import { Pressable, StyleSheet, Alert, Text, View, Platform } from "react-native";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AppStack } from "./app/navigation/StackNavigator";
import { Ionicons } from "@expo/vector-icons";
import { getSession, supabase } from "./app/util/supabase";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "./app/contexts/ThemeContext";
import * as Sentry from "@sentry/react-native";

import HomeScreen from "./app/screens/HomeScreen/HomeScreen";
import ProfileScreen from "./app/screens/ProfileScreen/ProfileScreen";
import AdminProfileScreen from "./app/screens/ProfileScreen/AdminProfileScreen";
import { useEffect, useState } from "react";
import React from "react";
import Toast from "react-native-toast-message";
import { useAdminStatus } from "./app/util/adminUtils";
import { setLoginGlow } from "./app/util/loginPrompt";
import { adService } from "./app/components/SupportModal/AdService";

// Initialize Sentry for production error tracking
try {
  Sentry.init({
    dsn: "https://a69ef4d26f73704eba5b08ad7d71d267@o4510615733796864.ingest.de.sentry.io/4510615748280400",
    // Always enabled to catch all errors
    enabled: true,
    // Capture 100% of errors
    tracesSampleRate: 1.0,
    // Debug mode
    debug: true,
  });
  console.log('✅ Sentry initialized successfully');
} catch (error) {
  console.error('🚨 Failed to initialize Sentry:', error);
}

// Request ATT permission IMMEDIATELY on iOS before any other initialization
// For iPadOS 26.0.1+ compatibility
const requestATTPermission = async () => {
  if (Platform.OS !== 'ios') {
    console.log('🔒 Not iOS, skipping ATT');
    return false;
  }
  
  try {
    console.log('🔒 Importing expo-tracking-transparency...');
    const TrackingTransparency = await import('expo-tracking-transparency');
    console.log('🔒 Module imported successfully');
    
    // First check current status
    console.log('🔒 Checking current ATT status...');
    const { status: currentStatus } = await TrackingTransparency.getTrackingPermissionsAsync();
    console.log('🔒 Current ATT Status:', currentStatus);
    console.log('🔒 Status type:', typeof currentStatus);
    console.log('🔒 Status value (string):', String(currentStatus));
    
    // Check if permission was already granted
    if (currentStatus === 'granted') {
      console.log('🔒 ATT already granted');
      return true;
    }
    
    // Check if permission was already denied
    if (currentStatus === 'denied') {
      console.log('🔒 ATT already denied');
      return false;
    }
    
    // Status is undetermined - request permission
    console.log('🔒 ATT Status is undetermined, requesting permission NOW...');
    console.log('🔒 About to show system ATT dialog...');
    
    const { status: newStatus } = await TrackingTransparency.requestTrackingPermissionsAsync();
    
    console.log('🔒 ATT Permission Response:', newStatus);
    console.log('🔒 Response type:', typeof newStatus);
    console.log('🔒 Response value (string):', String(newStatus));
    
    const granted = newStatus === 'granted';
    console.log('🔒 Permission granted?', granted);
    return granted;
  } catch (error: any) {
    console.error('❌ ATT request error:', error);
    console.error('❌ Error message:', error?.message);
    console.error('❌ Error stack:', error?.stack);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    // Send to Sentry
    Sentry.captureException(error, {
      tags: { location: 'requestATTPermission' },
      extra: { 
        message: error?.message,
        stack: error?.stack 
      }
    });
    return false;
  }
};

// Define the types for the tab navigator
export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator();

// Create a wrapper component that decides which profile screen to show
const ProfileScreenWrapper = () => {
  const { isAdmin, loading } = useAdminStatus();

  if (loading) {
    return <ProfileScreen />;
  }

  return isAdmin ? <AdminProfileScreen navigation={undefined} /> : <ProfileScreen />;
};

function AppContent() {
  const { colors } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState("Home"); // Track current screen
  const [attRequested, setAttRequested] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    // CRITICAL: Request ATT permission FIRST, before any SDK initialization
    // iOS 18+ requires ATT to be called immediately without delays
    const initializeApp = async () => {
      try {
        console.log('📱 App initializing...');
        console.log('📱 Platform:', Platform.OS);
        console.log('📱 ATT already requested:', attRequested);
        
        if (Platform.OS === 'ios' && !attRequested) {
          console.log('🔒 Starting ATT permission flow...');
          
          // NO DELAY - iOS 18+ requires immediate request
          const granted = await requestATTPermission();
          console.log('🔒 ATT Permission Result:', granted ? 'GRANTED' : 'DENIED/RESTRICTED');
          setAttRequested(true);
          console.log('✅ ATT request flow completed');
        }
        
        // Now initialize AdMob SDK after ATT prompt
        console.log('📱 Initializing AdMob SDK...');
        adService.initialize().catch(console.error);
      } catch (error: any) {
        console.error('🚨 CRITICAL: App initialization failed:', error);
        Sentry.captureException(error, {
          tags: { location: 'initializeApp', critical: true },
          extra: { message: error?.message, stack: error?.stack }
        });
      }
    };

    initializeApp();

    const checkSession = async () => {
      try {
        const sessionResult = await getSession();
        console.log("Session from Supabase in App:", sessionResult);

        // Check if sessionResult has a session property, otherwise treat as direct session
        const actualSession = sessionResult?.session !== undefined
          ? sessionResult.session
          : sessionResult;

        setIsLoggedIn(!!actualSession);
      } catch (error) {
        console.error("Error checking session:", error);
        setIsLoggedIn(false);
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("Auth State Changed in App:", session);
        setIsLoggedIn(!!session);
      }
    );

    return () => {
      // authListener.data is the subscription object
      if (authListener) {
        authListener.unsubscribe();
      }
    };
  }, []);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <NavigationContainer
        onStateChange={(state) => {
          // Track current screen for tab indication:
          const currentRoute = state?.routes[state.index];
          if (currentRoute) {
            setCurrentScreen(currentRoute.name);
          }
        }}
      >
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              height: 90,
              paddingBottom: 10,
              backgroundColor: colors.background,  // Add theme background color
              borderTopColor: colors.border,        // Add theme border color
              borderTopWidth: 1,
            },
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              tabBarButton: (props) => (
                <CustomTabButton
                  {...props}
                  label="Home"
                  icon="home"
                  isCurrentScreen={currentScreen === "Home"}
                />
              ),
            }}
          />
          <Tab.Screen
            name="Search"
            component={AppStack}
            options={{
              tabBarButton: (props) => (
                <CustomSearchButton
                  {...props}
                  isCurrentScreen={currentScreen === "Search"}
                />
              ),
            }}
          />
          <Tab.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              tabBarButton: (props) => (
                <CustomProfileButton
                  {...props}
                  isLoggedIn={isLoggedIn}
                  isCurrentScreen={currentScreen === "Profile"}
                />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
      <Toast />
    </>
  );
}

// Main App export with ThemeProvider - wrapped with Sentry
export default Sentry.wrap(function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
});

// Custom Tab Button for Home and other tabs
const CustomTabButton = ({ onPress, accessibilityState, label, icon, isCurrentScreen }: any) => {
  const { colors } = useTheme();
  // Use isCurrentScreen prop instead of accessibilityState for more reliable indication
  const isSelected = isCurrentScreen ?? (accessibilityState?.selected ?? false);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabButtonContainer,
        { backgroundColor: colors.background }, // Use theme background
        isSelected && {
          backgroundColor: colors.backgroundTertiary, // Slightly lighter for selected
          borderTopWidth: 3,
          borderTopColor: colors.primary,
        }
      ]}
    >
      <Ionicons
        name={
          isSelected
            ? (icon as keyof typeof Ionicons.glyphMap)
            : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)
        }
        size={30}
        color={isSelected ? colors.primary : colors.textSecondary}
      />
      <Text
        style={[
          styles.tabButtonText,
          { color: isSelected ? colors.primary : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

// Custom Profile Button
const CustomProfileButton = ({
  onPress,
  accessibilityState,
  isLoggedIn,
  isCurrentScreen,
}: any) => {
  const { colors } = useTheme();
  // Use isCurrentScreen prop for more reliable indication
  const isSelected = isCurrentScreen ?? (accessibilityState?.selected ?? false);
  const navigation = useNavigation();

  return (
    <Pressable
      onPress={() => {
        if (isLoggedIn) {
          onPress(); // Trigger the tab's built-in navigation to Profile screen
        } else {
          Alert.alert(
            "Login Required",
            "You need to log in to access the Profile screen. Would you like to log in now?",
            [
              {
                text: "Yes",
                onPress: () => {
                  setLoginGlow(true); // Set the flag
                  navigation.navigate("Home"); // Navigate to the Home screen
                },
              },
              { text: "No", style: "cancel" },
            ],
            { cancelable: true }
          );
        }
      }}
      style={[
        styles.tabButtonContainer,
        { backgroundColor: !isLoggedIn ? colors.disabled : colors.background },
        isSelected && !isLoggedIn && {
          backgroundColor: colors.disabled,
          borderTopWidth: 3,
          borderTopColor: colors.tabBorder,
        },
        isSelected && isLoggedIn && {
          backgroundColor: colors.backgroundTertiary,
          borderTopWidth: 3,
          borderTopColor: colors.primary,
        }
      ]}
    >
      <Ionicons
        name={isSelected ? "person" : "person-outline"}
        size={28}
        color={!isLoggedIn ? colors.buttonText : isSelected ? colors.primary : colors.textSecondary}
      />
      <Text
        style={[
          styles.tabButtonText,
          {
            color: !isLoggedIn ? colors.buttonText : isSelected ? colors.primary : colors.textSecondary,
          },
        ]}
      >
        Profile
      </Text>
    </Pressable>
  );
};

// Custom Search Button
const CustomSearchButton = ({ onPress, accessibilityState, isCurrentScreen }: any) => {
  const [isPressed, setIsPressed] = useState(false);
  // Use isCurrentScreen prop for more reliable indication
  const isSelected = isCurrentScreen ?? (accessibilityState?.selected ?? false);

  const backgroundColor = isPressed
    ? "#cc6600" // Darker orange when pressed
    : isSelected
      ? "#ff6600" // Bright orange when selected
      : "#ff9933"; // Default orange

  return (
    <Pressable
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      onPress={onPress}
      style={[
        styles.searchButton,
        { backgroundColor },
        isSelected && styles.selectedSearchButton // Add selected search button style
      ]}
    >
      <Ionicons
        name="search"
        size={72}
        color="#fff"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
          elevation: 10, // For Android
          bottom: 2,
          left: 1.5,
        }}
      />
    </Pressable>
  );
};

// Styles
const styles = StyleSheet.create({
  tabButtonContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: -5,
    // backgroundColor removed - now using theme colors inline
  },
  selectedTabContainer: {
    // Deprecated - now using inline theme colors
  },
  selectedDisabledTab: {
    // Deprecated - now using inline theme colors
  },
  tabButtonText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "bold",
  },
  searchButton: {
    width: 115,
    height: 100,
    borderRadius: 50, // Smooth circular edges
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: -5,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 5,
    elevation: 10,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.6)", // Soft white border
  },
  selectedSearchButton: {
    shadowOpacity: 0.5, // Stronger shadow when selected
    shadowRadius: 8,
    elevation: 15,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.9)", // Brighter border when selected
  },
});