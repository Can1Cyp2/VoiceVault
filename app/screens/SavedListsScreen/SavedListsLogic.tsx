// File: app/screens/SavedListsScreen/SavedListsLogic.tsx

import { supabase } from "../../util/supabase";
import { Alert } from "react-native";


// Function to save a new list
export const saveNewList = async (listName: string) => {
  try {
    const session = supabase.auth.session();
    if (!session?.user) {
      Alert.alert("Error", "Please log in to create a new list.");
      return;
    }

    const { error } = await supabase.from("saved_lists").insert([
      {
        name: listName,
        user_id: session.user.id,
      },
    ]);

    if (error) throw error;

    Alert.alert("Success", `List "${listName}" created successfully.`);
  } catch (error: any) {
    Alert.alert("Error", error.message);
  }
};

// Function to delete a list
export const deleteList = async (listName: string) => {
  try {
    const session = supabase.auth.session();
    if (!session?.user) {
      Alert.alert("Error", "Please log in to delete a list.");
      return;
    }

    const userId = session.user.id;

    if (listName === "All Saved Songs") {
      Alert.alert("Error", "The default list cannot be deleted.");
      return;
    }
    // Ensure the default list "All Saved Songs" cannot be deleted^

    // Delete all songs in the list
    await deleteSongsInList(listName, userId);

    // Delete the list itself
    const { error } = await supabase
      .from("saved_lists")
      .delete()
      .eq("name", listName)
      .eq("user_id", userId);

    if (error) throw error;

    Alert.alert(
      "Success",
      `The list "${listName}" and all its songs have been deleted.`
    );
  } catch (error: any) {
    Alert.alert("Error", error.message);
  }
};

// Function to delete all songs in a specific list
const deleteSongsInList = async (listName: string, userId: string) => {
  const { error } = await supabase
    .from("saved_songs")
    .delete()
    .eq("list_name", listName)
    .eq("user_id", userId);

  if (error) throw error; // Throw the error so it can be handled by the calling function
};

// Function to fetch the user's saved lists
export const fetchUserLists = async () => {
  try {
    // Fetch the current authenticated user
    const session = supabase.auth.session();
    if (!session?.user) {
      Alert.alert("Error", "Please log in to view your lists.");
      return [];
    }

    // Query the database for the user's lists
    const { data, error } = await supabase
      .from("saved_lists")
      .select("*")
      .eq("user_id", session.user.id);

    if (error) throw error;

    // Ensure only ONE "All Saved Songs" entry exists
    const uniqueLists = Array.from(
      new Map(data.map((list) => [list.name, list])).values()
    );

    return uniqueLists;
  } catch (error: any) {
    Alert.alert("Error", error.message);
    return [];
  }
};
