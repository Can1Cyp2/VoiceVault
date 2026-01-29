import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons"; // icon library
import { TouchableOpacity } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

import { SongDetailsScreen } from "../screens/SongDetailsScreen/SongDetailsScreen";
import { ArtistDetailsScreen } from "../screens/ArtistDetailsScreen/ArtistDetailsScreen";
import AddSongScreen from "../screens/AddSongScreen/AddSongScreen";
import SearchScreen from "../screens/SearchScreen/SearchScreen";
import SavedListsScreen from "../screens/SavedListsScreen/SavedListsScreen";
import ListDetailsScreen from "../screens/ListDetailsScreen/ListDetailsScreen";
import MetronomeScreen from "../screens/MetronomeScreen/MetronomeScreen";
import TunerScreen from "../screens/TunerScreen/TunerScreen";
import AdminProfileScreen from "../screens/ProfileScreen/AdminProfileScreen";
import AdminAnalyticsScreen from "../screens/AdminAnalyticsScreen/AdminAnalyticsScreen";
import ContentModerationScreen from "../screens/ContentModerationScreen/ContentModerationScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen/ResetPasswordScreen";

// Define the types for navigation parameters
export type RootStackParamList = {
  Search: undefined;
  Details: {
    name: string;
    vocalRange: string;
    artist: string;
    username?: string;
    showAddToListModal?: boolean;
  };
  ArtistDetails: { name: string };
  AddSong: undefined;
  SavedLists: undefined; // Route for displaying all saved lists
  ListDetails: { listName: string }; // Route for showing a specific list's details
  SongDetails: { name: string; artist: string; vocalRange: string };
  Metronome: undefined;
  Tuner: undefined;
  AdminProfileScreen: undefined;
  AdminAnalyticsScreen: undefined;
  ContentModerationScreen: undefined;
  ForgotPassword: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppStack() {
  const { colors } = useTheme();
  
  return (
    <Stack.Navigator 
      initialRouteName="Search"
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.backgroundCard,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      {/* Search Screen */}
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={({ navigation }) => ({
          title: "Search Screen",
          headerShown: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("SavedLists")} // Navigate to Saved Lists
              style={{ marginRight: 10 }}
            >
              <Ionicons name="list" size={24} color={colors.secondary} />
            </TouchableOpacity>
          ),
        })}
      />

      {/* Song Details Screen */}
      <Stack.Screen
        name="Details"
        component={SongDetailsScreen}
        options={({ navigation }) => ({
          title: "Song Details",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.setParams({ showAddToListModal: true })}
              style={{ marginRight: 10 }}
            >
              <Ionicons name="add-circle-outline" size={30} color={colors.primary} />
            </TouchableOpacity>
          ),
        })}
      />

      {/* Artist Details Screen */}
      <Stack.Screen
        name="ArtistDetails"
        component={ArtistDetailsScreen}
        options={({ navigation }) => ({
          title: "Artist Details",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("SavedLists")}
              style={{ marginRight: 10 }}
            >
              <Ionicons name="list" size={24} color={colors.secondary} />
            </TouchableOpacity>
          ),
        })}
      />

      {/* Add Song Screen */}
      <Stack.Screen
        name="AddSong"
        component={AddSongScreen}
        options={{
          title: "Add Song",
          headerRight: () => null,
        }}
      />

      <Stack.Screen
        name="SavedLists"
        component={SavedListsScreen}
        // remove header:
        options={() => ({ headerShown: false })}
      />

      {/* List Details Screen */}
      <Stack.Screen
        name="ListDetails"
        component={ListDetailsScreen}
        options={({ navigation }) => ({
          title: "List Details", // Title for the list details screen
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("SavedLists")}
              style={{ marginRight: 10 }}
            >
              <Ionicons name="list" size={24} color={colors.secondary} />
            </TouchableOpacity>
          ),
        })}
      />

      {/* Metronome Screen */}
      <Stack.Screen
        name="Metronome"
        component={MetronomeScreen}
        options={{
          title: "Metronome",
        }}
      />

      {/* Tuner Screen */}
      <Stack.Screen
        name="Tuner"
        component={TunerScreen}
        options={{
          title: "Tuner",
        }}
      />

      <Stack.Screen
      name="AdminProfileScreen"
      component={AdminProfileScreen}
      options={{
        title: "Admin Profile",
        headerShown: true,
      }}
    />
      <Stack.Screen
      name="AdminAnalyticsScreen"
      component={AdminAnalyticsScreen}
      options={{
        title: "Admin Analytics",
        headerShown: true,
      }}
    />
      <Stack.Screen
      name="ContentModerationScreen"
      component={ContentModerationScreen}
      options={{
        title: "Content Moderation",
        headerShown: true,
      }}
    />
     <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          title: "Forgot Password",
        }}
      />
    </Stack.Navigator>


  );
}
