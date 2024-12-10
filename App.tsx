import React, { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "./app/screens/HomeScreen/HomeScreen";
import SearchScreen from "./app/screens/SearchScreen/SearchScreen";
import TunerScreen from "./app/screens/TunerScreen/TunerScreen";
import { Ionicons } from "@expo/vector-icons";

const Tab = createBottomTabNavigator();

// Sizes for icon and text adjustments
const iconOffset = 14; // Lower the icon
const textOffset = 20; // Lower the text
const iconSize = 30; // Icon size

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap | undefined;

            if (route.name === "Home") {
              iconName = focused ? "home" : "home-outline";
              return (
                <Ionicons
                  name={iconName}
                  size={iconSize}
                  color={color}
                  style={{ position: "relative", top: iconOffset }} // Lower Home icon
                />
              );
            } else if (route.name === "Tuner") {
              iconName = focused ? "musical-notes" : "musical-notes-outline";
              return (
                <Ionicons
                  name={iconName}
                  size={iconSize}
                  color={color}
                  style={{ position: "relative", top: iconOffset }} // Lower Tuner icon
                />
              );
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarLabelStyle: {
            position: "relative",
            top: textOffset, // Lower the text label
          },
          tabBarActiveTintColor: "tomato",
          tabBarInactiveTintColor: "gray",
          tabBarStyle: {
            height: 90, // Keep tab bar height unchanged
            paddingBottom: 10,
            paddingHorizontal: 8,
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={{
            tabBarButton: (props) => <CustomSearchButton {...props} />, // Custom button
          }}
        />
        <Tab.Screen name="Tuner" component={TunerScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// Custom Search Button
const CustomSearchButton = ({ onPress, accessibilityState }: any) => {
  const [isPressed, setIsPressed] = useState(false); // State for press feedback
  const isSelected = accessibilityState.selected;

  const backgroundColor = isPressed
    ? "gray" // Grey when pressed
    : isSelected
    ? "#ff6600" // Orange when active
    : "#ff9933"; // Lighter orange when inactive

  return (
    <Pressable
      onPressIn={() => setIsPressed(true)} // Change state when pressed
      onPressOut={() => setIsPressed(false)} // Reset state when released
      onPress={onPress}
      style={[
        styles.searchButton,
        {
          backgroundColor, // Use dynamic backgroundColor
        },
      ]}
    >
      <Ionicons name="search" size={60} color="#fff" height={82} width={58} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  searchButton: {
    width: 110,
    height: 115,
    borderTopLeftRadius: 45, // Circle on the top-left
    borderTopRightRadius: 45, // Circle on the top-right
    borderBottomLeftRadius: 10, // Square bottom corners
    borderBottomRightRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: -18, // Keep the bubble higher up
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 4,
    elevation: 5, // Shadow for Android
  },
});
