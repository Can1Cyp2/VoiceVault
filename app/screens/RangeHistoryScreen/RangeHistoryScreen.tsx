// File: app/screens/RangeHistoryScreen/RangeHistoryScreen.tsx
//
// Shows the user's vocal range history: a progress showcase comparing
// their first recorded range to today's, and a dated list of every range
// change. Entries can be deleted (e.g. accidental saves). Data comes from
// user_vocal_range_history (see supabase/migrations/20260703_*.sql).

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { FONTS } from "../../styles/theme";
import { useTheme } from "../../contexts/ThemeContext";
import {
  computeRangeProgress,
  deleteRangeHistoryEntry,
  fetchRangeHistory,
  RangeHistoryEntry,
} from "../../util/rangeHistory";
import { noteToValue } from "../../util/vocalRange";

const formatDate = (isoDate: string): string => {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const describeGain = (semitones: number, direction: "lower" | "higher"): string => {
  if (semitones > 0) {
    return `${semitones} semitone${semitones !== 1 ? "s" : ""} ${direction}`;
  }
  if (semitones < 0) {
    return `${Math.abs(semitones)} semitone${semitones !== -1 ? "s" : ""} less`;
  }
  return "no change";
};

export default function RangeHistoryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [entries, setEntries] = useState<RangeHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    const history = await fetchRangeHistory();
    setEntries(history);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  const progress = useMemo(() => computeRangeProgress(entries), [entries]);

  // Bounds across all entries, used to draw each range as a bar.
  const bounds = useMemo(() => {
    const values = entries.flatMap((entry) => {
      const min = noteToValue(entry.min_range);
      const max = noteToValue(entry.max_range);
      return min !== -1 && max !== -1 ? [min, max] : [];
    });
    if (values.length === 0) return null;
    const lowest = Math.min(...values);
    const highest = Math.max(...values);
    return { lowest, span: Math.max(highest - lowest, 1) };
  }, [entries]);

  const handleDelete = (entry: RangeHistoryEntry) => {
    Alert.alert(
      "Delete Entry",
      `Remove ${entry.min_range} - ${entry.max_range} (${formatDate(entry.created_at)}) from your history?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const deleted = await deleteRangeHistoryEntry(entry.id);
            if (deleted) {
              setEntries((prev) => prev.filter((item) => item.id !== entry.id));
            } else {
              Alert.alert("Error", "Could not delete this entry right now.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderEntry = ({ item }: { item: RangeHistoryEntry }) => {
    const min = noteToValue(item.min_range);
    const max = noteToValue(item.max_range);
    const hasBar = bounds && min !== -1 && max !== -1;

    return (
      <View style={styles.entryCard}>
        <View style={styles.entryHeader}>
          <View style={styles.entryTextWrap}>
            <Text style={styles.entryRange}>
              {item.min_range} - {item.max_range}
            </Text>
            <Text style={styles.entryMeta}>
              {formatDate(item.created_at)}
              {item.voice_type ? ` • ${item.voice_type}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {hasBar && (
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  left: `${((min - bounds.lowest) / bounds.span) * 100}%`,
                  width: `${((max - min) / bounds.span) * 100}%`,
                },
              ]}
            />
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your range history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderEntry}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {progress && (
              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Ionicons name="trending-up" size={22} color={colors.primary} />
                  <Text style={styles.progressTitle}>Your Progress</Text>
                </View>
                <Text style={styles.progressRange}>
                  {progress.firstEntry.min_range} - {progress.firstEntry.max_range}
                  {"  →  "}
                  {progress.latestEntry.min_range} - {progress.latestEntry.max_range}
                </Text>
                <Text style={styles.progressSince}>
                  Since {formatDate(progress.firstEntry.created_at)}
                </Text>

                <View style={styles.progressStatsRow}>
                  <View style={styles.progressStat}>
                    <Ionicons name="arrow-down" size={16} color={colors.primary} />
                    <Text style={styles.progressStatText}>
                      Low: {describeGain(progress.semitonesGainedLow, "lower")}
                    </Text>
                  </View>
                  <View style={styles.progressStat}>
                    <Ionicons name="arrow-up" size={16} color={colors.primary} />
                    <Text style={styles.progressStatText}>
                      High: {describeGain(progress.semitonesGainedHigh, "higher")}
                    </Text>
                  </View>
                </View>
                <Text style={styles.progressSpan}>
                  {progress.spanChange > 0
                    ? `Your range grew by ${progress.spanChange} semitone${progress.spanChange !== 1 ? "s" : ""} 🎉`
                    : progress.spanChange < 0
                      ? `Your range narrowed by ${Math.abs(progress.spanChange)} semitone${progress.spanChange !== -1 ? "s" : ""}`
                      : "Your total range size is unchanged"}
                </Text>
              </View>
            )}
            {entries.length > 0 && (
              <Text style={styles.sectionTitle}>
                History ({entries.length} {entries.length === 1 ? "entry" : "entries"})
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="mic-outline" size={44} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No range history yet</Text>
            <Text style={styles.emptyBody}>
              Save your vocal range from the Profile tab and every change will
              show up here, so you can watch your voice grow over time.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (colors: typeof import("../../styles/theme").LightColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 15,
      marginTop: 10,
    },
    listContent: {
      padding: 16,
      paddingBottom: 60,
    },
    progressCard: {
      backgroundColor: colors.backgroundCard,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      padding: 16,
      marginBottom: 18,
    },
    progressHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    progressTitle: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 18,
      fontWeight: "bold",
    },
    progressRange: {
      color: colors.primary,
      fontFamily: FONTS.primary,
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 2,
    },
    progressSince: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 12.5,
      marginBottom: 12,
    },
    progressStatsRow: {
      flexDirection: "row",
      gap: 16,
      marginBottom: 10,
    },
    progressStat: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    progressStatText: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 13.5,
    },
    progressSpan: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 14,
      fontWeight: "600",
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    entryCard: {
      backgroundColor: colors.backgroundCard,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      marginBottom: 10,
    },
    entryHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    entryTextWrap: {
      flex: 1,
    },
    entryRange: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 17,
      fontWeight: "bold",
    },
    entryMeta: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 12.5,
      marginTop: 2,
    },
    deleteButton: {
      padding: 6,
    },
    barTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.backgroundTertiary,
      marginTop: 10,
      overflow: "hidden",
      position: "relative",
    },
    barFill: {
      position: "absolute",
      top: 0,
      bottom: 0,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 60,
      paddingHorizontal: 30,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontFamily: FONTS.primary,
      fontSize: 18,
      fontWeight: "bold",
      marginTop: 12,
      marginBottom: 6,
    },
    emptyBody: {
      color: colors.textSecondary,
      fontFamily: FONTS.primary,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
  });
