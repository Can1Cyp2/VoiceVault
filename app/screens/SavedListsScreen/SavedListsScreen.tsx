import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  FlatList,
  StyleSheet,
  Modal,
  TextInput,
} from "react-native";
import { supabase } from "../../util/supabase";
import { Ionicons } from "@expo/vector-icons";
import { deleteList, fetchUserLists, saveNewList } from "./SavedListsLogic";

export default function SavedListsScreen({ navigation }: any) {
  const [lists, setLists] = useState<string[]>(["All Saved Songs"]); // Default list
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");

  useEffect(() => {
    const fetchSavedLists = async () => {
      try {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
          Alert.alert("Error", "Please log in to view your saved lists.");
          return;
        }

        const { data, error } = await supabase
          .from("saved_lists")
          .select("name")
          .eq("user_id", user.data.user.id);

        if (error) {
          Alert.alert("Error", error.message);
        } else {
          const fetchedLists = data.map((list: any) => list.name) || [];
          setLists(["All Saved Songs", ...fetchedLists]);
        }
      } catch (error) {
        console.error("Error fetching saved lists:", error);
      }
    };

    fetchSavedLists();
  }, []);

  // Handle adding a new list
  const handleAddNewList = async () => {
    if (!newListName.trim()) {
      Alert.alert("Error", "List name cannot be empty.");
      return;
    }

    try {
      await saveNewList(newListName.trim());
      Alert.alert("Success", `List "${newListName}" created.`);
      setNewListName("");
      setEditModalVisible(false);

      // Refresh the lists
      const updatedLists = await fetchUserLists();
      setLists(updatedLists || []);
    } catch (error) {
      console.error("Error creating new list:", error);
      Alert.alert("Error", "Could not create the new list.");
    }
  };

  const handleEditList = async () => {
    if (!newListName.trim()) {
      Alert.alert("Error", "List name cannot be empty.");
      return;
    }

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        Alert.alert("Error", "Please log in to edit a list.");
        return;
      }

      const { error } = await supabase
        .from("saved_lists")
        .update({ name: newListName.trim() })
        .eq("name", selectedList)
        .eq("user_id", user.data.user.id);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        setLists((prevLists) =>
          prevLists.map((list) =>
            list === selectedList ? newListName.trim() : list
          )
        );
        setEditModalVisible(false);
        setSelectedList(null);
        setNewListName("");
      }
    } catch (error) {
      console.error("Error editing list:", error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with back button and list icon */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={30} color="#007bff" />
        </TouchableOpacity>
        <Text style={styles.separator}>|</Text>
        <Ionicons
          name="list"
          size={28}
          color="#007bff"
          style={styles.headerIcon}
        />
        <Text style={styles.headerText}>My Saved Lists</Text>
        <TouchableOpacity onPress={() => setEditModalVisible(true)}>
          <Ionicons
            name="add-circle-outline"
            size={30}
            color="green"
            style={{ marginLeft: 50 }}
          />
        </TouchableOpacity>
      </View>

      {/* Saved Lists */}
      <FlatList
        data={lists}
        keyExtractor={(item) => item}
        renderItem={({ item, index }) => (
          <View style={styles.listItem}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("ListDetails", { listName: item })
              }
            >
              <Text style={styles.listItemText}>
                {index + 1}. {item}
              </Text>
            </TouchableOpacity>
            {item !== "All Saved Songs" && (
              <TouchableOpacity
                onPress={() => {
                  setSelectedList(item);
                  setEditModalVisible(true);
                }}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={24}
                  color="#007bff"
                />
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>You have no saved lists.</Text>
        )}
      />

      {/* Edit/Delete Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit or Delete List</Text>

            <Text style={styles.modalSubtitle}>
              Selected List: {selectedList}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter new list name"
              value={newListName}
              onChangeText={setNewListName}
            />

            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEditList}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={async () => {
                await deleteList(selectedList!); // Call the deleteList function
                setLists((prevLists) =>
                  prevLists.filter((list) => list !== selectedList)
                );
                setEditModalVisible(false);
                setSelectedList(null);
              }}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setEditModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 70,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    marginRight: 5,
  },
  separator: {
    marginHorizontal: 8,
    fontSize: 18,
    marginRight: 15,
    color: "#ccc",
  },
  headerIcon: {
    marginRight: 5,
  },
  headerText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#007bff",
    paddingBottom: 2,
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderColor: "#ccc",
  },
  listItemText: {
    fontSize: 18,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    color: "#999",
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#555",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    width: "100%",
  },
  editButton: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    width: "100%",
    alignItems: "center",
  },
  editButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: "#f44336",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    width: "100%",
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  modalCloseButton: {
    marginTop: 10,
  },
  modalCloseText: {
    color: "#007bff",
    fontSize: 16,
  },
});
