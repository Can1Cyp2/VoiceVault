// app/navigation/StackNavigator.tsx

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types";
import SearchScreen from "../screens/SearchScreen/SearchScreen";
import { DetailsScreen } from "../screens/DetailsScreen/DetailsScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function SearchStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Details" component={DetailsScreen} />
    </Stack.Navigator>
  );
}
