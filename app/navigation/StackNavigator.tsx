// app\navigation\StackNavigator.tsx

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SearchScreen from "../screens/SearchScreen/SearchScreen";
import SavedListsScreen from "../screens/SavedListsScreen/SavedListsScreen";
import ListDetailsScreen from "../screens/ListDetailsScreen/ListDetailsScreen";
import { Ionicons } from "@expo/vector-icons"; // icon library
import { TouchableOpacity } from "react-native";

import { SongDetailsScreen } from "../screens/SongDetailsScreen/SongDetailsScreen";
import { ArtistDetailsScreen } from "../screens/ArtistDetailsScreen/ArtistDetailsScreen";
import AddSongScreen from "../screens/AddSongScreen/AddSongScreen";

export type RootStackParamList = {
  Search: undefined;
  Details: { name: string; vocalRange: string; artist: string };
  ArtistDetails: { name: string };
  AddSong: undefined;
  SavedLists: undefined; // New screen
  ListDetails: { listId: number }; // New screen for a specific list
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppStack() {
  return (
    <Stack.Navigator initialRouteName="Search">
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={({ navigation }) => ({
          title: "Search Screen",
          headerShown: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("SavedLists")}
              style={{ marginRight: 10 }}
            >
              <Ionicons name="list" size={24} color="#007bff" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="Details"
        component={SongDetailsScreen}
        options={({ navigation }) => ({
          title: "Song Details",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("SavedLists")}
              style={{ marginRight: 10 }}
            >
              <Ionicons name="list" size={24} color="#007bff" />
            </TouchableOpacity>
          ),
        })}
      />
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
              <Ionicons name="list" size={24} color="#007bff" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="AddSong"
        component={AddSongScreen}
        options={({ navigation }) => ({
          title: "Add Song",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("SavedLists")}
              style={{ marginRight: 10 }}
            >
              <Ionicons name="list" size={24} color="#007bff" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="SavedLists"
        component={SavedListsScreen}
        options={{
          title: "My Saved Lists",
        }}
      />
      <Stack.Screen
        name="ListDetails"
        component={ListDetailsScreen}
        options={({ navigation }) => ({
          title: "List Details",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("SavedLists")}
              style={{ marginRight: 10 }}
            >
              <Ionicons name="list" size={24} color="#007bff" />
            </TouchableOpacity>
          ),
        })}
      />
    </Stack.Navigator>
  );
}
