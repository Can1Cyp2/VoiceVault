// import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { RootStackParamList } from "../navigation/types";
import HomeScreen from "../screens/HomeScreen/HomeScreen";
import { SearchStack } from "../navigation/StackNavigator"; // Import the Search Stack

const Tab = createBottomTabNavigator<RootStackParamList>();

export default function Layout() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen
          name="Search"
          component={SearchStack}
          options={{ headerShown: false }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
