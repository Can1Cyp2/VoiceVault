import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from "react-native";
import { supabase } from "../../util/supabase";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "../../styles/theme";
import { updateListIcon } from "../SavedListsScreen/SavedListsLogic";

export default function ListDetailsScreen({ route, navigation }: any) {
  const { listName } = route.params;
  const [songs, setSongs] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [listIcon, setListIcon] = useState<string>("list");
  const [iconModalVisible, setIconModalVisible] = useState(false);
  const [availableIcons, setAvailableIcons] = useState<any[]>([]);

  const fetchAvailableIcons = async () => {
    try {
      const { data } = await supabase
        .from('list_icons')
        .select('name, label, category, sort_order')
        .order('category')
        .order('sort_order');
      if (data) setAvailableIcons(data || []);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const session = supabase.auth.session();
        if (!session?.user) {
          Alert.alert("Error", "Please log in to view this list.");
          return;
        }

        let query = supabase
          .from("saved_songs")
          .select("*")
          .eq("user_id", session.user.id);

        if (listName !== "All Saved Songs") {
          query = query.eq("list_name", listName);
        }

        const { data, error } = await query;

        if (error) {
          Alert.alert("Error", error.message);
        } else {
          setSongs(data || []);
          // if the saved_lists table has an icon column, fetch icon for this list
          try {
            if (listName !== 'All Saved Songs') {
              const { data: listData } = await supabase
                .from('saved_lists')
                .select('icon')
                .eq('user_id', session.user.id)
                .eq('name', listName)
                .single();

              if (listData?.icon) setListIcon(listData.icon);
            } else {
              setListIcon('bookmark');
            }
          } catch (err) {
            // ignore
          }
        }
      } catch (error) {
        console.error("Error fetching songs:", error);
        Alert.alert("Error", "An error occurred while fetching the songs.");
      }
    };

    fetchSongs();
    fetchAvailableIcons();
  }, [listName]);

  // Set navigation header
  useEffect(() => {
    navigation.setOptions({
      title: listName,
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => setIsEditing((prev) => !prev)}
          style={{ marginRight: 15 }}
        >
          <Ionicons
            name={isEditing ? "checkmark" : "create-outline"}
            size={24}
            color={isEditing ? COLORS.success : COLORS.primary}
          />
        </TouchableOpacity>
      ),
    });
  }, [isEditing, listName, navigation]);

  const handleDeleteSong = async (songId: number) => {
    Alert.alert(
      "Delete Song",
      "Are you sure you want to remove this song from the list?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("saved_songs")
                .delete()
                .eq("id", songId);

              if (error) {
                throw error;
              }

              setSongs((prevSongs) => prevSongs.filter((song) => song.id !== songId));
              Alert.alert("Success", "Song removed from the list.");
            } catch (error: any) {
              console.error("Error deleting song:", error);
              Alert.alert("Error", "Could not remove the song.");
            }
          },
        },
      ]
    );
  };

  const handleSongPress = (song: any) => {
    if (isEditing) return;
    
    navigation.navigate("Details", {
      name: song.name,
      artist: song.artist,
      vocalRange: song.vocal_range,
      username: song.username,
    });
  };

  const renderSongItem = ({ item, index }: { item: any; index: number }) => (
    <View style={[
      styles.songItemContainer,
      isEditing && styles.songItemEditing
    ]}>
      <TouchableOpacity
        style={styles.songItem}
        onPress={() => handleSongPress(item)}
        disabled={isEditing}
      >
        {/* Song Icon */}
        <View style={styles.songIcon}>
          <Ionicons name="musical-note" size={24} color={COLORS.primary} />
        </View>

        {/* Song Details */}
        <View style={styles.songDetails}>
          <Text style={styles.songName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {item.artist}
          </Text>
          {item.vocal_range && (
            <Text style={styles.vocalRange} numberOfLines={1}>
              🎤 {item.vocal_range}
            </Text>
          )}
        </View>

        {/* Arrow or Delete Button */}
        {isEditing ? (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteSong(item.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#ff4444" />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons 
          name={listName === "All Saved Songs" ? "bookmark-outline" : "list-outline"} 
          size={64} 
          color={COLORS.textLight} 
        />
      </View>
      <Text style={styles.emptyTitle}>
        {listName === "All Saved Songs" ? "No Saved Songs" : "Empty List"}
      </Text>
      <Text style={styles.emptyText}>
        {listName === "All Saved Songs"
          ? "Start exploring and save songs you love to see them here."
          : `No songs have been added to "${listName}" yet.`}
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.navigate("Search")}
      >
        <Text style={styles.exploreButtonText}>Explore Songs</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerInfo}>
          <TouchableOpacity
          style={styles.listIconContainer}
          onPress={() => {
            if (listName !== 'All Saved Songs') setIconModalVisible(true);
          }}
        >
          <Ionicons
            name={(listName === "All Saved Songs" ? "bookmark" : (listIcon || 'list')) as any}
            size={32}
            color={listName === "All Saved Songs" ? COLORS.secondary : COLORS.primary}
          />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.listTitle}>{listName}</Text>
          <Text style={styles.songCount}>
            {songs.length} {songs.length === 1 ? 'song' : 'songs'}
          </Text>
        </View>
        {isEditing && (
          <View style={styles.editingBadge}>
            <Text style={styles.editingText}>Editing</Text>
          </View>
        )}
      </View>

      {/* Edit Mode Notice */}
      {isEditing && (
        <View style={styles.editNotice}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textLight} />
          <Text style={styles.editNoticeText}>
            Tap the trash icon to remove songs from this list
          </Text>
        </View>
      )}

      {/* Songs List */}
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderSongItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />

      {/* Icon Picker Modal */}
      {iconModalVisible && (
        <Modal transparent animationType="slide" visible={iconModalVisible}>
          <View style={styles.modalOverlay}>
            <View style={styles.iconModalContent}>
              <Text style={styles.modalTitle}>Choose List Icon</Text>

              {/* Scrollable list that fits within the modal */}
              <ScrollView style={styles.iconScroll} contentContainerStyle={styles.iconScrollContent}>
                {(() => {
                  const grouped: Record<string, any[]> = {};
                  availableIcons.forEach((i: any) => {
                    const c = i.category || 'Other';
                    if (!grouped[c]) grouped[c] = [];
                    grouped[c].push(i);
                  });
                  const categories = Object.keys(grouped).sort();

                  return (
                    <View style={styles.iconSections}>
                      {categories.map((category) => (
                        <View key={category} style={styles.iconSection}>
                          <Text style={styles.iconSectionTitle}>{category}</Text>
                          <View style={styles.iconGrid}>
                            {grouped[category].map((icon: any) => (
                              <TouchableOpacity
                                key={icon.name}
                                style={styles.iconChoice}
                                onPress={async () => {
                                  const ok = await updateListIcon(listName, icon.name);
                                  if (ok) setListIcon(icon.name);
                                  setIconModalVisible(false);
                                }}
                              >
                                <Ionicons name={icon.name as any} size={28} color={COLORS.primary} />
                                <Text style={styles.iconLabel}>{icon.label || icon.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </ScrollView>

              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIconModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header Info
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  listIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerText: {
    flex: 1,
  },
  listTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textDark,
    fontFamily: FONTS.primary,
  },
  songCount: {
    fontSize: 16,
    color: COLORS.textLight,
    fontFamily: FONTS.primary,
    marginTop: 2,
  },
  editingBadge: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  editingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.primary,
  },

  // Edit Notice
  editNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    marginBottom: 8,
  },
  editNoticeText: {
    fontSize: 14,
    color: COLORS.textLight,
    fontFamily: FONTS.primary,
    marginLeft: 8,
  },

  // List Container
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    flexGrow: 1,
  },

  // Song Items
  songItemContainer: {
    marginBottom: 12,
  },
  songItemEditing: {
    opacity: 0.9,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  songIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  songDetails: {
    flex: 1,
    marginRight: 12,
  },
  songName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textDark,
    fontFamily: FONTS.primary,
    marginBottom: 2,
  },
  artistName: {
    fontSize: 16,
    color: COLORS.textLight,
    fontFamily: FONTS.primary,
    marginBottom: 4,
  },
  vocalRange: {
    fontSize: 14,
    color: COLORS.primary,
    fontFamily: FONTS.primary,
    fontWeight: '500',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffebee',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textDark,
    fontFamily: FONTS.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    fontFamily: FONTS.primary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 40,
  },
  exploreButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.primary,
  },
  // Icon picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconModalContent: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    /* Constrain the modal height to 80% of screen height so it fits on smaller devices */
    maxHeight: Math.round(Dimensions.get('window').height * 0.8),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 12,
    fontFamily: FONTS.primary,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconScroll: {
    width: '100%',
  },
  iconScrollContent: {
    paddingBottom: 12,
  },
  iconChoice: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    margin: 6,
  },
  modalCancelButton: {
    paddingVertical: 10,
  },
  modalCancelText: {
    color: COLORS.textLight,
    fontFamily: FONTS.primary,
  },
  iconSections: {
    width: '100%',
    marginBottom: 12,
  },
  iconSection: {
    marginBottom: 12,
  },
  iconSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
    alignSelf: 'flex-start',
    marginBottom: 8,
    fontFamily: FONTS.primary,
  },
  iconLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 4,
    textAlign: 'center',
    fontFamily: FONTS.primary,
  },
});