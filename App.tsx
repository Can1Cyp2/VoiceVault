import { Pressable, StyleSheet, Alert, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AppStack } from "./app/navigation/StackNavigator";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "./app/util/supabase";

import HomeScreen from "./app/screens/HomeScreen/HomeScreen";
import ProfileScreen from "./app/screens/ProfileScreen/ProfileScreen";
import SavedListsScreen from "./app/screens/SavedListsScreen/SavedListsScreen";
import { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

const Tab = createBottomTabNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Debug stored session in AsyncStorage:
        const storedSession = await AsyncStorage.getItem("supabase.auth.token");
        console.log(
          "Stored session:",
          storedSession ? "✅ Exists" : "❌ Not Found"
        );

        // Fetch current session from Supabase
        const { data } = await supabase.auth.getSession();
        console.log("Session from Supabase:", data.session);

        setIsLoggedIn(!!data.session);
      } catch (error) {
        console.error("Error restoring session:", error);
      }
    };

    checkSession();

    // listener OUTSIDE checkSession to avoid multiple triggers
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("Auth State Changed:", session);
        setIsLoggedIn(!!session);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <NavigationContainer>
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
              <CustomTabButton {...props} label="Home" icon="home" />
            ),
          }}
        />
        <Tab.Screen
          name="Search"
          component={AppStack}
          options={{
            tabBarButton: (props) => <CustomSearchButton {...props} />,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarButton: (props) => (
              <CustomProfileButton {...props} isLoggedIn={isLoggedIn} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// Custom Tab Button for Home and other tabs
const CustomTabButton = ({ onPress, accessibilityState, label, icon }: any) => {
  const isSelected = accessibilityState.selected;

  return (
    <Pressable onPress={onPress} style={styles.tabButtonContainer}>
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
  onPress, // Use the onPress from tabBarButton props
  accessibilityState,
  isLoggedIn,
}: any) => {
  const isSelected = accessibilityState.selected;

  return (
    <Pressable
      onPress={() => {
        if (isLoggedIn) {
          onPress(); // Trigger the tab's built-in navigation
        } else {
          Alert.alert(
            "Access Denied",
            "You must be logged in to access the Profile screen."
          );
        }
      }}
      style={[
        styles.tabButtonContainer,
        { backgroundColor: !isLoggedIn ? "gray" : "white" },
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
        {isLoggedIn ? "Profile" : "Profile"}
      </Text>
    </Pressable>
  );
};

// Custom Search Button
const CustomSearchButton = ({ onPress, accessibilityState }: any) => {
  const [isPressed, setIsPressed] = useState(false);
  const isSelected = accessibilityState.selected;

  const backgroundColor = isPressed
    ? "#cc6600" // Darker orange when pressed
    : isSelected
    ? "#ff6600"
    : "#ff9933";

  return (
    <Pressable
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      onPress={onPress}
      style={[styles.searchButton, { backgroundColor }]}
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
});
