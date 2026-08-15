// File location: app/screens/ProfileScreen/SongSubmissionsModal.tsx
// "My Submissions" popup on the Profile screen: shows the signed-in user's
// added songs (pending_songs) and requested songs (song_requests) with their
// review status. Rejected requests can be edited and resubmitted from here.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import {
  fetchMySongRequests,
  fetchUserPendingSongs,
  resubmitSongRequest,
  SongRequest,
} from "../../util/api";

interface SongSubmissionsModalProps {
  visible: boolean;
  onClose: () => void;
}

interface AddedSong {
  id: number;
  name: string;
  artist: string;
  vocal_range: string;
  status: string;
  admin_notes?: string | null;
  created_at: string;
}

type StatusKey = "pending" | "approved" | "rejected" | "edited_and_approved";

const STATUS_DISPLAY: Record<StatusKey, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: "Pending review", color: "#f39c12", icon: "time" },
  approved: { label: "Approved", color: "#27ae60", icon: "checkmark-circle" },
  rejected: { label: "Declined", color: "#e74c3c", icon: "close-circle" },
  edited_and_approved: { label: "Edited & Approved", color: "#3498db", icon: "create" },
};

const getStatusDisplay = (status: string) =>
  STATUS_DISPLAY[(status as StatusKey)] ?? STATUS_DISPLAY.pending;

export default function SongSubmissionsModal({ visible, onClose }: SongSubmissionsModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<"added" | "requested">("added");
  const [loading, setLoading] = useState(false);
  const [addedSongs, setAddedSongs] = useState<AddedSong[]>([]);
  const [requests, setRequests] = useState<SongRequest[]>([]);

  // Inline edit state for resubmitting a rejected request
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSongName, setEditSongName] = useState("");
  const [editArtistName, setEditArtistName] = useState("");
  const [isResubmitting, setIsResubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [added, requested] = await Promise.all([
        fetchUserPendingSongs(),
        fetchMySongRequests(),
      ]);
      setAddedSongs(added);
      setRequests(requested);
    } catch (err) {
      console.error("Failed to load submissions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setEditingId(null);
      void loadData();
    }
  }, [visible, loadData]);

  const startEditing = (request: SongRequest) => {
    setEditingId(request.id);
    setEditSongName(request.song_name);
    setEditArtistName(request.artist_name);
  };

  const handleResubmit = async () => {
    if (editingId === null) return;
    if (!editSongName.trim() || !editArtistName.trim()) {
      Alert.alert("Missing info", "Please enter both a song name and an artist name.");
      return;
    }
    try {
      setIsResubmitting(true);
      await resubmitSongRequest(editingId, editSongName, editArtistName);
      setEditingId(null);
      await loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to resubmit your request.");
    } finally {
      setIsResubmitting(false);
    }
  };

  const renderStatusRow = (status: string) => {
    const display = getStatusDisplay(status);
    return (
      <View style={styles.statusRow}>
        {status === "pending" ? (
          <ActivityIndicator size="small" color={display.color} />
        ) : (
          <Ionicons name={display.icon} size={18} color={display.color} />
        )}
        <Text style={[styles.statusText, { color: display.color }]}>{display.label}</Text>
      </View>
    );
  };

  const renderAddedSong = ({ item }: { item: AddedSong }) => (
    <View style={styles.itemCard}>
      <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.itemSubtitle} numberOfLines={1}>
        {item.artist} • {item.vocal_range}
      </Text>
      <Text style={styles.itemDate}>
        Submitted {new Date(item.created_at).toLocaleDateString()}
      </Text>
      {renderStatusRow(item.status)}
      {item.status === "rejected" && !!item.admin_notes && (
        <Text style={styles.adminNotes}>Reviewer note: {item.admin_notes}</Text>
      )}
    </View>
  );

  const renderRequest = ({ item }: { item: SongRequest }) => {
    const isEditing = editingId === item.id;
    return (
      <View style={styles.itemCard}>
        {isEditing ? (
          <>
            <Text style={styles.editLabel}>Edit and resubmit your request:</Text>
            <TextInput
              style={styles.editInput}
              value={editSongName}
              onChangeText={setEditSongName}
              placeholder="Song Name"
              placeholderTextColor={colors.textPlaceholder}
              maxLength={200}
              editable={!isResubmitting}
            />
            <TextInput
              style={styles.editInput}
              value={editArtistName}
              onChangeText={setEditArtistName}
              placeholder="Artist Name"
              placeholderTextColor={colors.textPlaceholder}
              maxLength={200}
              editable={!isResubmitting}
            />
            <View style={styles.editButtonsRow}>
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: colors.primary, opacity: isResubmitting ? 0.6 : 1 }]}
                onPress={handleResubmit}
                disabled={isResubmitting}
              >
                <Text style={styles.editButtonText}>
                  {isResubmitting ? "Resubmitting..." : "Resubmit"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: colors.lightGray }]}
                onPress={() => setEditingId(null)}
                disabled={isResubmitting}
              >
                <Text style={[styles.editButtonText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.itemTitle} numberOfLines={1}>{item.song_name}</Text>
            <Text style={styles.itemSubtitle} numberOfLines={1}>{item.artist_name}</Text>
            <Text style={styles.itemDate}>
              Requested {new Date(item.created_at).toLocaleDateString()}
            </Text>
            {renderStatusRow(item.status)}
            {(item.status === "approved" || item.status === "edited_and_approved") && (
              <Text style={styles.approvedNote}>
                This song should now be searchable in VoiceVault!
              </Text>
            )}
            {!!item.notes && (
              <Text style={styles.adminNotes}>Reviewer note: {item.notes}</Text>
            )}
            {item.status === "rejected" && (
              <TouchableOpacity
                style={[styles.resubmitLink, { borderColor: colors.primary }]}
                onPress={() => startEditing(item)}
              >
                <Ionicons name="create-outline" size={16} color={colors.primary} />
                <Text style={[styles.resubmitLinkText, { color: colors.primary }]}>
                  Edit & Resubmit
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  };

  const emptyState = (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={activeTab === "added" ? "musical-notes-outline" : "send-outline"}
        size={44}
        color={colors.textTertiary}
      />
      <Text style={styles.emptyText}>
        {activeTab === "added"
          ? "You haven't added any songs yet. Use the + button on the Search screen to submit one."
          : "You haven't requested any songs yet. Use the + button on the Search screen to request one."}
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>My Submissions</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close submissions"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "added" && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
              onPress={() => setActiveTab("added")}
            >
              <Text style={[styles.tabText, { color: activeTab === "added" ? colors.primary : colors.textSecondary }]}>
                Added Songs ({addedSongs.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "requested" && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
              onPress={() => setActiveTab("requested")}
            >
              <Text style={[styles.tabText, { color: activeTab === "requested" ? colors.primary : colors.textSecondary }]}>
                Requested ({requests.length})
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={activeTab === "added" ? (addedSongs as any[]) : (requests as any[])}
              renderItem={activeTab === "added" ? (renderAddedSong as any) : (renderRequest as any)}
              keyExtractor={(item) => `${activeTab}-${item.id}`}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={emptyState}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: typeof import("../../styles/theme").LightColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
    },
    container: {
      backgroundColor: colors.backgroundCard,
      borderRadius: 16,
      padding: 18,
      width: "92%",
      maxHeight: "82%",
      minHeight: "50%",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      fontSize: 21,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    closeButton: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    tabRow: {
      flexDirection: "row",
      marginTop: 8,
      marginBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
    },
    tabText: {
      fontSize: 14.5,
      fontWeight: "600",
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 40,
    },
    listContent: {
      paddingBottom: 8,
    },
    itemCard: {
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      marginVertical: 5,
    },
    itemTitle: {
      fontSize: 15.5,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    itemSubtitle: {
      fontSize: 13.5,
      color: colors.textSecondary,
      marginTop: 2,
    },
    itemDate: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 4,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
    },
    statusText: {
      fontSize: 13,
      fontWeight: "700",
    },
    approvedNote: {
      fontSize: 12.5,
      color: colors.textSecondary,
      marginTop: 4,
    },
    adminNotes: {
      fontSize: 12.5,
      color: colors.textSecondary,
      marginTop: 6,
      fontStyle: "italic",
    },
    resubmitLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      borderWidth: 1.5,
      borderRadius: 8,
      paddingVertical: 8,
      marginTop: 10,
    },
    resubmitLinkText: {
      fontSize: 13.5,
      fontWeight: "700",
    },
    editLabel: {
      fontSize: 13.5,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    editInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      marginVertical: 4,
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      fontSize: 14,
    },
    editButtonsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    editButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
    },
    editButtonText: {
      color: colors.buttonText,
      fontSize: 14,
      fontWeight: "700",
    },
    emptyContainer: {
      alignItems: "center",
      paddingVertical: 36,
      paddingHorizontal: 20,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 12,
      lineHeight: 20,
    },
  });
