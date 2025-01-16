// File location: App.tsx

import React, { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "./app/screens/HomeScreen/HomeScreen";
import { AppStack } from "./app/navigation/StackNavigator";
import TunerScreen from "./app/screens/TunerScreen/TunerScreen";
import { Ionicons } from "@expo/vector-icons";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color }) => {
            let iconName: keyof typeof Ionicons.glyphMap | undefined;

            if (route.name === "Home") {
              iconName = focused ? "home" : "home-outline";
            } else if (route.name === "Tuner") {
              iconName = focused ? "musical-notes" : "musical-notes-outline";
            }

            return (
              <Ionicons
                name={iconName}
                size={30}
                color={color}
                style={{ position: "relative", top: 5 }} // Moves icons slightly up
              />
            );
          },
          tabBarLabelStyle: {
            position: "relative",
            top: 10, // Moves text up slightly more than the icons
          },
          tabBarActiveTintColor: "tomato",
          tabBarInactiveTintColor: "gray",
          tabBarStyle: { height: 70 },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen
          name="Search"
          component={AppStack} // Routes to the AppStack for Search
          options={{
            tabBarButton: (props) => <CustomSearchButton {...props} />,
          }}
        />
        <Tab.Screen name="Tuner" component={TunerScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// Custom Search Button
const CustomSearchButton = ({ onPress, accessibilityState }: any) => {
  const [isPressed, setIsPressed] = useState(false);
  const isSelected = accessibilityState.selected;

  const backgroundColor = isPressed
    ? "gray"
    : isSelected
    ? "#ff6600"
    : "#ff9933";

  return (
    <Pressable
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      onPress={onPress} // Use the default navigation passed through props
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
  searchButton: {
    width: 100,
    height: 95,
    borderTopLeftRadius: 45,
    borderTopRightRadius: 45,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: -5, // Adjusted position to keep the search button centered
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 4,
    elevation: 5,
  },
});
