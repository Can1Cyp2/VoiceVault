// import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { RootStackParamList } from "../navigation/types";
import HomeScreen from "../screens/HomeScreen/HomeScreen";
import { AppStack } from "../navigation/StackNavigator"; // Import the App Stack

const Tab = createBottomTabNavigator<RootStackParamList>();

export default function Layout() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen
          name="Search"
          component={AppStack}
          options={{ headerShown: false }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
