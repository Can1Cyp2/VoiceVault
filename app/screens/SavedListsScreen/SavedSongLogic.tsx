// File: app/screens/SavedSongLogic/SavedSongLogic.tsx

import { supabase } from "../../util/supabase";
import { Alert } from "react-native";

/// Function to save a song to a list
export const saveToList = async (
  name: string,
  artist: string,
  vocalRange: string,
  listName: string
) => {
  try {
    // Get the current authenticated user
    const session = supabase.auth.session();
    if (!session?.user) {
      Alert.alert("Error", "Please log in to save songs to a list.");
      return;
    }

    const userId = session.user.id;

    // Ensure "All Saved Songs" is not reinserted manually
    if (listName === "All Saved Songs") {
      const { data: existingList } = await supabase
        .from("saved_lists")
        .select("id")
        .eq("name", "All Saved Songs")
        .eq("user_id", userId)
        .single();

      if (!existingList) {
        // Create "All Saved Songs" list ONLY IF it doesn't exist
        await supabase
          .from("saved_lists")
          .insert([{ name: "All Saved Songs", user_id: userId }]);
      }
    } else {
      // If it's a custom list, check if it exists; otherwise, create it
      let { data: listData, error: listError } = await supabase
        .from("saved_lists")
        .select("id")
        .eq("name", listName)
        .eq("user_id", userId)
        .single();

      if (listError) {
        const { data: newList, error: createListError } = await supabase
          .from("saved_lists")
          .insert([{ name: listName, user_id: userId }])
          .select()
          .single();

        if (createListError) throw createListError;

        listData = newList;
      }
    }

    // Check if the song already exists in the list
    const { data: existingSong } = await supabase
      .from("saved_songs")
      .select("id")
      .eq("name", name)
      .eq("artist", artist)
      .eq("list_name", listName)
      .eq("user_id", userId)
      .single();

    if (existingSong) {
      Alert.alert(
        "Duplicate",
        `The song "${name}" is already in the list "${listName}".`
      );
      return;
    }

    // Insert the song into the saved_songs table
    const { error: saveError } = await supabase.from("saved_songs").insert([
      {
        name,
        artist,
        vocal_range: vocalRange,
        list_name: listName,
        user_id: userId,
      },
    ]);

    if (saveError) throw saveError;

    Alert.alert("Success", `Song "${name}" saved to list: "${listName}".`);
  } catch (error: any) {
    Alert.alert("Error", error.message);
  }
};

// Function to fetch all saved songs for a user
export const fetchUserSongs = async () => {
  try {
    // Get the current authenticated user
    const session = supabase.auth.session();
    if (!session?.user) {
      Alert.alert("Error", "Please log in to view your saved songs.");
      return [];
    }

    // Ensure only fetching songs belonging to the signed-in user
    const { data, error } = await supabase
      .from("saved_songs")
      .select("*")
      .eq("user_id", session.user.id); // Filter by user_id

    if (error) throw error;

    return data; // Return only the user's songs
  } catch (error: any) {
    Alert.alert("Error", error.message);
    return [];
  }
};

// Function to fetch songs in a specific list
export const fetchSongsInList = async (listName: string) => {
  try {
    // Get the current authenticated user
    const session = supabase.auth.session();
    if (!session?.user) {
      Alert.alert("Error", "Please log in to view songs in this list.");
      return [];
    }

    // Fetch the songs in the specified list for the user
    const { data, error } = await supabase
      .from("saved_songs")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("list_name", listName);

    if (error) throw error;

    return data;
  } catch (error: any) {
    Alert.alert("Error", error.message);
    return [];
  }
};

// Function to delete a song from a specific list
export const deleteSongFromList = async (songId: number) => {
  try {
    // Delete the song by its ID
    const { error } = await supabase
      .from("saved_songs")
      .delete()
      .eq("id", songId);

    if (error) throw error;

    Alert.alert("Success", "Song removed from the list.");
  } catch (error: any) {
    Alert.alert("Error", error.message);
  }
};
