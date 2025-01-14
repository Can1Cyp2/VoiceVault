// File location: app/navigation/StackNavigator.tsx

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen/HomeScreen";
import LoginScreen from "../screens/LoginScreen/LoginScreen";
import LogoutScreen from "../screens/LogoutScreen/LogoutScreen";
import SearchScreen from "../screens/SearchScreen/SearchScreen";
import { SongDetailsScreen } from "../screens/SongDetailsScreen/SongDetailsScreen";
import { ArtistDetailsScreen } from "../screens/ArtistDetailsScreen/ArtistDetailsScreen";

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Logout: undefined;
  Search: undefined;
  Details: { name: string; vocalRange: string; artist: string };
  ArtistDetails: { name: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppStack() {
  return (
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: "Login" }}
      />
      <Stack.Screen
        name="Logout"
        component={LogoutScreen}
        options={{ title: "Logout" }}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ headerShown: false }}
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
    </Stack.Navigator>
  );
}
