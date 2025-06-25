import { Pressable, StyleSheet, Alert, Text, View } from "react-native";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AppStack } from "./app/navigation/StackNavigator";
import { Ionicons } from "@expo/vector-icons";
import { getSession, supabase } from "./app/util/supabase";

import HomeScreen from "./app/screens/HomeScreen/HomeScreen";
import ProfileScreen from "./app/screens/ProfileScreen/ProfileScreen";
import { useEffect, useState } from "react";
import React from "react";

// Define the types for the tab navigator
export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState("Home"); // Track current screen

  useEffect(() => {
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
  );
}

// Custom Tab Button for Home and other tabs
const CustomTabButton = ({ onPress, accessibilityState, label, icon, isCurrentScreen }: any) => {
  // Use isCurrentScreen prop instead of accessibilityState for more reliable indication
  const isSelected = isCurrentScreen ?? (accessibilityState?.selected ?? false);
  
  return (
    <Pressable 
      onPress={onPress} 
      style={[
        styles.tabButtonContainer,
        isSelected && styles.selectedTabContainer // Add selected style
      ]}
    >
      <Ionicons
        name={
          isSelected
            ? (icon as keyof typeof Ionicons.glyphMap)
            : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)
        }
        size={30}
        color={isSelected ? "tomato" : "darkgray"}
      />
      <Text
        style={[
          styles.tabButtonText,
          { color: isSelected ? "tomato" : "darkgray" },
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
        { backgroundColor: !isLoggedIn ? "gray" : "white" },
        isSelected && !isLoggedIn && styles.selectedDisabledTab, // Special style for selected disabled tab
        isSelected && isLoggedIn && styles.selectedTabContainer, // Selected enabled tab
      ]}
    >
      <Ionicons
        name={isSelected ? "person" : "person-outline"}
        size={28}
        color={!isLoggedIn ? "white" : isSelected ? "tomato" : "darkgray"}
      />
      <Text
        style={[
          styles.tabButtonText,
          {
            color: !isLoggedIn ? "white" : isSelected ? "tomato" : "darkgray",
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
    backgroundColor: "white", // Default background for all tabs
  },
  selectedTabContainer: {
    backgroundColor: "#fff5f5", // Light red/pink background for selected tabs
    borderTopWidth: 3,
    borderTopColor: "tomato",
  },
  selectedDisabledTab: {
    backgroundColor: "#555", // Darker gray for selected disabled tab
    borderTopWidth: 3,
    borderTopColor: "#777",
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