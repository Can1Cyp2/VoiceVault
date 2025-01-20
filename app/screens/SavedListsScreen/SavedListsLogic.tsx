// File: app/screens/SavedListsScreen/SavedListsLogic.tsx

import { supabase } from "../../util/supabase";
import { Alert } from "react-native";

export const saveNewList = async (listName: string) => {
  try {
    const user = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Error", "Please log in to create a new list.");
      return;
    }
    const { error } = await supabase.from("saved_lists").insert([
      {
        name: listName,
        user_id: user.data.user?.id,
      },
    ]);
    if (error) throw error;
    Alert.alert("Success", `List "${listName}" created successfully.`);
  } catch (error: any) {
    Alert.alert("Error", error.message);
  }
};

export const fetchUserLists = async () => {
  try {
    const user = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Error", "Please log in to view your lists.");
      return [];
    }
    const { data, error } = await supabase
      .from("saved_lists")
      .select("*")
      .eq("user_id", user.data.user?.id);
    if (error) throw error;
    return data;
  } catch (error: any) {
    Alert.alert("Error", error.message);
    return [];
  }
};
