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

const Tab = createBottomTabNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);

      supabase.auth.onAuthStateChange((_event, session) => {
        setIsLoggedIn(!!session);
      });
    };

    checkSession();
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
  onPress,
  accessibilityState,
  isLoggedIn,
}: any) => {
  const isSelected = accessibilityState.selected;

  return (
    <Pressable
      onPress={() => {
        if (isLoggedIn) {
          onPress();
        } else {
          Alert.alert(
            "Access Denied",
            "You must be logged in to access the Profile screen. If you need help please contact voicevaultcontact@gmail.com"
          );
        }
      }}
      style={[
        styles.tabButtonContainer,
        { backgroundColor: !isLoggedIn ? "gray" : "white" },
      ]}
    >
      <Ionicons
        name={
          isSelected
            ? ("person" as keyof typeof Ionicons.glyphMap)
            : ("person-outline" as keyof typeof Ionicons.glyphMap)
        }
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
        {isLoggedIn ? "Profile" : "Log In"}
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
        size={55}
        color="#fff"
        style={{ alignSelf: "center", position: "relative", top: -4 }}
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
    width: 100,
    height: 95,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: -5,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 4,
    elevation: 5,
  },
});
