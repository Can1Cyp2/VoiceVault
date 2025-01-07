import React, { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "./app/screens/HomeScreen/HomeScreen";
import { SearchStack } from "./app/navigation/StackNavigator";
import TunerScreen from "./app/screens/TunerScreen/TunerScreen";
import { Ionicons } from "@expo/vector-icons";

const Tab = createBottomTabNavigator();

const iconOffset = 14;
const textOffset = 20;
const iconSize = 30;

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
              return (
                <Ionicons
                  name={iconName}
                  size={iconSize}
                  color={color}
                  style={{ position: "relative", top: iconOffset }}
                />
              );
            } else if (route.name === "Tuner") {
              iconName = focused ? "musical-notes" : "musical-notes-outline";
              return (
                <Ionicons
                  name={iconName}
                  size={iconSize}
                  color={color}
                  style={{ position: "relative", top: iconOffset }}
                />
              );
            }

            return <Ionicons name={iconName} size={iconSize} color={color} />;
          },
          tabBarLabelStyle: {
            position: "relative",
            top: textOffset,
          },
          tabBarActiveTintColor: "tomato",
          tabBarInactiveTintColor: "gray",
          tabBarStyle: {
            height: 90,
            paddingBottom: 10,
            paddingHorizontal: 8,
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen
          name="Search"
          component={SearchStack} // Use SearchStack instead of SearchScreen
          options={{
            tabBarButton: (props) => <CustomSearchButton {...props} />,
          }}
        />
        <Tab.Screen name="Tuner" component={TunerScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

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
      onPress={onPress}
      style={[
        styles.searchButton,
        {
          backgroundColor,
        },
      ]}
    >
      <Ionicons name="search" size={60} color="#fff" />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  searchButton: {
    width: 110,
    height: 115,
    borderTopLeftRadius: 45,
    borderTopRightRadius: 45,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: -18,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 4,
    elevation: 5,
  },
});
