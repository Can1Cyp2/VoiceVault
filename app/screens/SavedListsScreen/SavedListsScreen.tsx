import React, { useState, useEffect } from "react";
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import { supabase } from "../../util/supabase";

export default function SavedListsScreen({ navigation }: any) {
  const [lists, setLists] = useState<string[]>(["All Saved Songs"]);
  const [newListName, setNewListName] = useState("");

  // Fetch user's saved lists on load
  useEffect(() => {
    const fetchLists = async () => {
      try {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
          Alert.alert("Error", "Please log in to view your lists.");
          return;
        }

        const { data, error } = await supabase
          .from("saved_lists")
          .select("name")
          .eq("user_id", user.data.user.id);

        if (error) {
          Alert.alert("Error", error.message);
        } else {
          setLists(["All Saved Songs", ...data.map((list: any) => list.name)]);
        }
      } catch (error: any) {
        Alert.alert("Error", error.message);
      }
    };

    fetchLists();
  }, []);

  const addList = async () => {
    if (!newListName.trim()) {
      Alert.alert("Error", "List name cannot be empty");
      return;
    }

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        Alert.alert("Error", "Please log in to create a new list.");
        return;
      }

      const { error } = await supabase
        .from("saved_lists")
        .insert([{ name: newListName.trim(), user_id: user.data.user.id }]);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        setLists((prev) => [...prev, newListName.trim()]);
        setNewListName("");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const deleteList = async (listName: string) => {
    if (listName === "All Saved Songs") {
      Alert.alert("Error", "Cannot delete the default list.");
      return;
    }

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        Alert.alert("Error", "Please log in to delete lists.");
        return;
      }

      const { error } = await supabase
        .from("saved_lists")
        .delete()
        .eq("name", listName)
        .eq("user_id", user.data.user.id);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        setLists((prev) => prev.filter((name) => name !== listName));
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Saved Lists</Text>
      <FlatList
        data={lists}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("ListDetails", { listName: item })
              }
            >
              <Text style={styles.listText}>{item}</Text>
            </TouchableOpacity>
            {item !== "All Saved Songs" && (
              <TouchableOpacity onPress={() => deleteList(item)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
      <TextInput
        style={styles.input}
        placeholder="New List Name"
        value={newListName}
        onChangeText={setNewListName}
      />
      <TouchableOpacity style={styles.addButton} onPress={addList}>
        <Text style={styles.addButtonText}>Add List</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
    borderBottomWidth: 1,
    borderColor: "#ccc",
  },
  listText: { fontSize: 18 },
  deleteText: { color: "red", fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginVertical: 10,
  },
  addButton: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
  },
  addButtonText: { color: "#fff", textAlign: "center" },
});
