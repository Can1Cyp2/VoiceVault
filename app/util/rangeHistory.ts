// app/util/rangeHistory.ts
//
// Read/write access to the user_vocal_range_history table plus the pure
// progress math for the Range History screen. Requires the
// 20260703_add_vocal_range_history.sql migration to be applied.

import { supabase } from "./supabase";
import { noteToValue } from "./vocalRange";

export interface RangeHistoryEntry {
  id: number;
  min_range: string;
  max_range: string;
  voice_type: string | null;
  reason: string | null;
  created_at: string;
}

/** Newest first. Returns [] for guests or on error. */
export const fetchRangeHistory = async (): Promise<RangeHistoryEntry[]> => {
  const user = supabase.auth.user();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_vocal_range_history")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching range history:", error.message);
    return [];
  }
  return data || [];
};

/**
 * Record a range change. Skips silently for guests, on error, or when the
 * new range is identical to the most recent entry (saving the same range
 * twice shouldn't spam the history).
 */
export const logRangeHistoryEntry = async (
  minRange: string,
  maxRange: string,
  voiceType: string | null = null,
  reason: string | null = null
): Promise<void> => {
  const user = supabase.auth.user();
  if (!user) return;

  try {
    const { data: latest } = await supabase
      .from("user_vocal_range_history")
      .select("min_range, max_range")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const last = latest?.[0];
    if (last && last.min_range === minRange && last.max_range === maxRange) {
      return;
    }

    const { error } = await supabase.from("user_vocal_range_history").insert([
      {
        user_id: user.id,
        min_range: minRange,
        max_range: maxRange,
        voice_type: voiceType,
        reason,
      },
    ]);

    if (error) {
      console.error("Error logging range history:", error.message);
    }
  } catch (err) {
    // History is best-effort; never block the actual range save.
    console.error("Unexpected error logging range history:", err);
  }
};

export const deleteRangeHistoryEntry = async (id: number): Promise<boolean> => {
  const user = supabase.auth.user();
  if (!user) return false;

  const { error } = await supabase
    .from("user_vocal_range_history")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting range history entry:", error.message);
    return false;
  }
  return true;
};

// ------------------------------------------------------------
// Progress math (pure, unit tested)
// ------------------------------------------------------------

export interface RangeProgress {
  entryCount: number;
  firstEntry: RangeHistoryEntry;
  latestEntry: RangeHistoryEntry;
  /** Positive = the user can now sing lower than in their first entry. */
  semitonesGainedLow: number;
  /** Positive = the user can now sing higher than in their first entry. */
  semitonesGainedHigh: number;
  /** Overall range growth in semitones (can be negative). */
  spanChange: number;
}

/**
 * Compare the earliest and latest history entries. Returns null when there
 * are fewer than two valid entries (no progress to show yet).
 */
export const computeRangeProgress = (
  entries: RangeHistoryEntry[]
): RangeProgress | null => {
  const valid = (entries || []).filter(
    (entry) =>
      noteToValue(entry.min_range) !== -1 && noteToValue(entry.max_range) !== -1
  );
  if (valid.length < 2) return null;

  const sorted = [...valid].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
  );
  const firstEntry = sorted[0];
  const latestEntry = sorted[sorted.length - 1];

  const firstMin = noteToValue(firstEntry.min_range);
  const firstMax = noteToValue(firstEntry.max_range);
  const latestMin = noteToValue(latestEntry.min_range);
  const latestMax = noteToValue(latestEntry.max_range);

  return {
    entryCount: sorted.length,
    firstEntry,
    latestEntry,
    semitonesGainedLow: firstMin - latestMin,
    semitonesGainedHigh: latestMax - firstMax,
    spanChange: latestMax - latestMin - (firstMax - firstMin),
  };
};
