// app\navigation\StackNavigator.tsx

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SearchScreen from "../screens/SearchScreen/SearchScreen";
import { SongDetailsScreen } from "../screens/SongDetailsScreen/SongDetailsScreen";
import { ArtistDetailsScreen } from "../screens/ArtistDetailsScreen/ArtistDetailsScreen";
import AddSongScreen from "../screens/AddSongScreen/AddSongScreen";

export type RootStackParamList = {
  Search: undefined;
  Details: { name: string; vocalRange: string; artist: string };
  ArtistDetails: { name: string };
  AddSong: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppStack() {
  return (
    <Stack.Navigator initialRouteName="Search">
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: "Search Screen", headerShown: false }}
      />
      <Stack.Screen
        name="Details"
        component={SongDetailsScreen}
        options={{ title: "Song Details" }}
      />
      <Stack.Screen
        name="ArtistDetails"
        component={ArtistDetailsScreen}
        options={{ title: "Artist Details" }}
      />
      <Stack.Screen
        name="AddSong"
        component={AddSongScreen}
        options={{ title: "Add Song" }}
      />
    </Stack.Navigator>
  );
}
