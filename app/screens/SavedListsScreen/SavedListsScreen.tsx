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
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { supabase } from "../../util/supabase";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "../../styles/theme";
import { deleteList, fetchUserLists, saveNewList } from "./SavedListsLogic";

export default function SavedListsScreen({ navigation }: any) {
  const [lists, setLists] = useState<string[]>(["All Saved Songs"]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  useEffect(() => {
    const fetchSavedLists = async () => {
      try {
        const session = supabase.auth.session();
        if (!session?.user) {
          Alert.alert("Error", "Please log in to view your saved lists.");
          return;
        }

        const { data, error } = await supabase
          .from("saved_lists")
          .select("name")
          .eq("user_id", session.user.id);

        if (error) {
          Alert.alert("Error", error.message);
        } else {
          const fetchedLists = data.map((list: any) => list.name) || [];
          const filteredLists = fetchedLists.filter(
            (list) => list !== "All Saved Songs"
          );
          setLists(["All Saved Songs", ...filteredLists]);
        }
      } catch (error) {
        console.error("Error fetching saved lists:", error);
      }
    };

    fetchSavedLists();
  }, []);

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
      setIsCreatingNew(false);

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
      const session = supabase.auth.session();
      if (!session?.user) {
        Alert.alert("Error", "Please log in to edit a list.");
        return;
      }

      const { error } = await supabase
        .from("saved_lists")
        .update({ name: newListName.trim() })
        .eq("name", selectedList)
        .eq("user_id", session.user.id);

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

  const openEditModal = (listName: string) => {
    setSelectedList(listName);
    setNewListName(listName);
    setIsCreatingNew(false);
    setEditModalVisible(true);
  };

  const openCreateModal = () => {
    setSelectedList(null);
    setNewListName("");
    setIsCreatingNew(true);
    setEditModalVisible(true);
  };

  const handleDeleteList = async () => {
    if (!selectedList) return;
    
    Alert.alert(
      "Delete List",
      `Are you sure you want to delete "${selectedList}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteList(selectedList);
              setLists((prevLists) =>
                prevLists.filter((list) => list !== selectedList)
              );
              setEditModalVisible(false);
              setSelectedList(null);
              Alert.alert("Success", "List deleted successfully.");
            } catch (error) {
              Alert.alert("Error", "Could not delete the list.");
            }
          },
        },
      ]
    );
  };

  const renderListItem = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.listItemContainer}>
      <TouchableOpacity
        style={[
          styles.listItem,
          item === "All Saved Songs" && styles.defaultListItem
        ]}
        onPress={() => navigation.navigate("ListDetails", { listName: item })}
      >
        <View style={styles.listItemContent}>
          <View style={styles.listIcon}>
            <Ionicons 
              name={item === "All Saved Songs" ? "bookmark" : "list"} 
              size={24} 
              color={item === "All Saved Songs" ? COLORS.secondary : COLORS.primary} 
            />
          </View>
          <View style={styles.listTextContainer}>
            <Text style={[
              styles.listItemText,
              item === "All Saved Songs" && styles.defaultListText
            ]}>
              {item}
            </Text>
            {item === "All Saved Songs" && (
              <Text style={styles.listItemSubtext}>Default collection</Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
      </TouchableOpacity>
      
      {item !== "All Saved Songs" && (
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textLight} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Lists</Text>
          <Text style={styles.headerSubtitle}>Organize your saved songs</Text>
        </View>

        <TouchableOpacity 
          style={styles.addButton}
          onPress={openCreateModal}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Lists */}
      <FlatList
        data={lists}
        keyExtractor={(item) => item}
        renderItem={renderListItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="list-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No Lists Yet</Text>
            <Text style={styles.emptyText}>
              Create your first list to organize your saved songs
            </Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={openCreateModal}
            >
              <Text style={styles.emptyButtonText}>Create List</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Edit/Create Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {isCreatingNew ? "Create New List" : "Edit List"}
                </Text>

                {!isCreatingNew && (
                  <Text style={styles.modalSubtitle}>
                    Current: {selectedList}
                  </Text>
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Enter list name"
                  value={newListName}
                  onChangeText={setNewListName}
                  placeholderTextColor={COLORS.textLight}
                  autoFocus
                />

                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={isCreatingNew ? handleAddNewList : handleEditList}
                >
                  <Text style={styles.modalButtonText}>
                    {isCreatingNew ? "Create List" : "Save Changes"}
                  </Text>
                </TouchableOpacity>

                {!isCreatingNew && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDeleteList}
                  >
                    <Text style={styles.deleteButtonText}>Delete List</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    marginRight: 15,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textDark,
    fontFamily: FONTS.primary,
  },
  headerSubtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    fontFamily: FONTS.primary,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // List Container
  listContainer: {
    padding: 20,
    paddingTop: 10,
  },

  // List Items
  listItemContainer: {
    marginBottom: 12,
  },
  listItem: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  defaultListItem: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  listTextContainer: {
    flex: 1,
  },
  listItemText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textDark,
    fontFamily: FONTS.primary,
  },
  defaultListText: {
    color: 'white',
  },
  listItemSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: FONTS.primary,
    marginTop: 2,
  },
  editButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textDark,
    fontFamily: FONTS.primary,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    fontFamily: FONTS.primary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.primary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: FONTS.primary,
  },
  modalSubtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: FONTS.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    fontSize: 16,
    fontFamily: FONTS.primary,
    backgroundColor: COLORS.background,
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.primary,
  },
  deleteButton: {
    backgroundColor: '#ff4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.primary,
  },
  modalCancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: COLORS.textLight,
    fontSize: 16,
    fontFamily: FONTS.primary,
  },
});