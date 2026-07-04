import { CommonActions } from "@react-navigation/native";
import { RootStackParamList } from "./StackNavigator";

type SearchStackRouteName = keyof RootStackParamList;

type NavigationWithDispatch = {
  dispatch: (action: any) => void;
};

export const resetToSearchStackScreen = <RouteName extends SearchStackRouteName>(
  navigation: NavigationWithDispatch,
  screen: RouteName,
  params?: RootStackParamList[RouteName]
) => {
  const nestedRoutes =
    screen === "Search"
      ? [{ name: "Search" }]
      : [{ name: "Search" }, { name: screen, params }];

  navigation.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [
        { name: "Home" },
        {
          name: "Search",
          state: {
            index: nestedRoutes.length - 1,
            routes: nestedRoutes,
          },
        },
        { name: "Profile" },
      ],
    })
  );
};
