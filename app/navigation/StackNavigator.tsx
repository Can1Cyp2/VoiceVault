// app/navigation/StackNavigator.tsx

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types";
import SearchScreen from "../screens/SearchScreen/SearchScreen";
import { SongDetailsScreen } from "../screens/SongDetailsScreen/SongDetailsScreen";
import { ArtistDetailsScreen } from "../screens/ArtistDetailsScreen/ArtistDetailsScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function SearchStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Details" component={SongDetailsScreen} />
      <Stack.Screen name="ArtistDetails" component={ArtistDetailsScreen} />
    </Stack.Navigator>
  );
}
