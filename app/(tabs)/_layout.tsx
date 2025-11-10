// import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React, { useMemo } from "react";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { RootStackParamList } from "../navigation/types";
import HomeScreen from "../screens/HomeScreen/HomeScreen";
import { AppStack } from "../navigation/StackNavigator"; // Import the App Stack
import { useTheme } from "../contexts/ThemeContext";

const Tab = createBottomTabNavigator<RootStackParamList>();

export default function Layout() {
  const { colors, isDark } = useTheme();
  
  // Create custom navigation theme
  const navigationTheme = useMemo(() => ({
    dark: isDark,
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.backgroundCard,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.primary,
    },
    fonts: DefaultTheme.fonts, // Use default fonts
  }), [colors, isDark]);
  
  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: colors.backgroundCard,
            borderTopColor: colors.border,
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          headerStyle: {
            backgroundColor: colors.backgroundCard,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Tab.Screen 
          name="Home" 
          component={HomeScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Search"
          component={AppStack}
          options={{ 
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
