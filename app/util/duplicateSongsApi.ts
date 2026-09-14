// File location: app/util/duplicateSongsApi.ts
// Admin-only, private. Kept out of git (see .gitignore) - this backs the
// internal "Duplicates" tab in Content Moderation. Requires
// supabase/migrations/20260803_add_duplicate_song_detection.sql (also
// gitignored) for the SQL functions and trigram indexes it depends on.

import { supabase } from "./supabase";

export interface DuplicateSong {
  id: number;
  name: string;
  artist: string;
  vocalRange: string | null;
  createdAt: string | null;
}

export interface DuplicateGroup {
  /** Stable id for list keys: the smallest song id in the group. */
  key: number;
  songs: DuplicateSong[];
  /** Worst-case (lowest) similarity seen inside the group, 0-1. */
  minNameSim: number;
  minArtistSim: number;
}

interface DuplicatePairRow {
  a_id: number;
  a_name: string;
  a_artist: string;
  a_range: string | null;
  a_created_at: string | null;
  b_id: number;
  b_name: string;
  b_artist: string;
  b_range: string | null;
  b_created_at: string | null;
  name_sim: number;
  artist_sim: number;
}

/**
 * Admin: scan for duplicate songs.
 *
 * The SQL side returns PAIRS. Chains matter here - if A matches B and B
 * matches C, all three are the same song and must be reviewed together, or
 * the admin merges A+B and is shown C as a fresh "duplicate" on the next
 * scan. So pairs are collapsed into connected components (union-find) before
 * being handed to the UI.
 */
export const fetchDuplicateSongs = async (
  minSimilarity = 0.72,
  limit = 1500
): Promise<DuplicateGroup[]> => {
  const { data, error } = await supabase.rpc("admin_find_duplicate_songs", {
    p_min_similarity: minSimilarity,
    p_limit: limit,
  });

  if (error) {
    console.error("Error finding duplicate songs:", error.message);
    throw error;
  }

  const rows = (data as DuplicatePairRow[]) || [];

  // --- union-find over song ids ---
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // path compression
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (x: number, y: number) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(ry, rx);
  };

  const songs = new Map<number, DuplicateSong>();
  // Lowest similarity per pair, tracked against each member so the group can
  // report its weakest link - that is what tells an admin how confident the
  // match is.
  const worstName = new Map<number, number>();
  const worstArtist = new Map<number, number>();

  for (const r of rows) {
    for (const [id, name, artist, range, created] of [
      [r.a_id, r.a_name, r.a_artist, r.a_range, r.a_created_at],
      [r.b_id, r.b_name, r.b_artist, r.b_range, r.b_created_at],
    ] as const) {
      if (!parent.has(id)) parent.set(id, id);
      if (!songs.has(id)) {
        songs.set(id, {
          id,
          name: name ?? "",
          artist: artist ?? "",
          vocalRange: range,
          createdAt: created,
        });
      }
      worstName.set(id, Math.min(worstName.get(id) ?? 1, r.name_sim));
      worstArtist.set(id, Math.min(worstArtist.get(id) ?? 1, r.artist_sim));
    }
    union(r.a_id, r.b_id);
  }

  const byRoot = new Map<number, number[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    const list = byRoot.get(root) ?? [];
    list.push(id);
    byRoot.set(root, list);
  }

  const groups: DuplicateGroup[] = [];
  for (const ids of byRoot.values()) {
    if (ids.length < 2) continue;
    ids.sort((a, b) => a - b);
    groups.push({
      key: ids[0],
      songs: ids.map((id) => songs.get(id)!),
      minNameSim: Math.min(...ids.map((id) => worstName.get(id) ?? 1)),
      minArtistSim: Math.min(...ids.map((id) => worstArtist.get(id) ?? 1)),
    });
  }

  // Most-similar groups first - the clearest duplicates are the quickest calls.
  groups.sort(
    (x, y) => y.minNameSim + y.minArtistSim - (x.minNameSim + x.minArtistSim)
  );
  return groups;
};

/**
 * Admin: the duplicates of one specific song, anchor row included.
 *
 * Used by the Ranges review queue to resolve a duplicate in place. Anchored
 * to a single song, so unlike the full scan it is cheap and cannot time out.
 * Returns [] when the song has no duplicates.
 */
export const fetchDuplicatesForSong = async (
  songId: number,
  minSimilarity = 0.72
): Promise<DuplicateSong[]> => {
  const { data, error } = await supabase.rpc("admin_find_duplicates_for_song", {
    p_song_id: songId,
    p_min_similarity: minSimilarity,
  });

  if (error) {
    console.error("Error finding duplicates for song:", error.message);
    throw error;
  }

  const rows =
    (data as Array<{
      id: number;
      name: string;
      artist: string;
      range: string | null;
      created_at: string | null;
    }>) || [];

  // A lone row means the anchor matched only itself - not a duplicate group.
  if (rows.length < 2) return [];

  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? "",
    artist: r.artist ?? "",
    vocalRange: r.range,
    createdAt: r.created_at,
  }));
};

/**
 * Admin: keep one song, delete the rest of the group. Optionally corrects the
 * kept song's vocal range in the same transaction. Returns how many rows were
 * deleted. Destructive - callers must confirm with the user first.
 */
export const mergeDuplicateSongs = async (
  keepId: number,
  removeIds: number[],
  finalRange?: string | null
): Promise<number> => {
  const { data, error } = await supabase.rpc("admin_merge_duplicate_songs", {
    p_keep_id: keepId,
    p_remove_ids: removeIds,
    p_final_range: finalRange && finalRange.trim() ? finalRange.trim() : null,
  });

  if (error) {
    console.error("Error merging duplicate songs:", error.message);
    throw error;
  }
  // The RPC returns a scalar INT (rows deleted), but the client types every
  // rpc() result as an array, hence the double cast.
  return (data as unknown as number) ?? 0;
};

// ---------------------------------------------------------------------------
// Character-level difference highlighting
// ---------------------------------------------------------------------------

/**
 * `same`    - character matches the other string
 * `extra`   - character is present here but NOT in the other string
 * `missing` - character is present in the OTHER string but not here. Carries
 *             the other string's text so the UI can show precisely what is
 *             absent; without this, "Mr Brightside" next to "Mr. Brightside"
 *             would render with nothing highlighted and read as identical.
 */
export type DiffKind = "same" | "extra" | "missing";
export type DiffSegment = { text: string; kind: DiffKind; /** @deprecated use kind */ same: boolean };

/**
 * Split `value` into segments describing how it differs from `other`, so the
 * UI can highlight exactly which characters differ in each direction.
 *
 * Uses a longest-common-subsequence walk rather than a naive index-by-index
 * compare, because the interesting real-world cases are insertions and
 * deletions ("Mr Brightside" vs "Mr. Brightside"), where a positional compare
 * would mark the entire rest of the string as different.
 */
export const diffChars = (value: string, other: string): DiffSegment[] => {
  const a = value ?? "";
  const b = other ?? "";
  if (!a && !b) return [];
  if (!a) return [{ text: b, kind: "missing", same: false }];
  if (!b) return [{ text: a, kind: "extra", same: false }];

  // LCS table. These are song titles and artist names, so lengths are small
  // enough that the O(n*m) table is not a concern.
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i].toLowerCase() === b[j].toLowerCase()
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  const push = (ch: string, kind: DiffKind) => {
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) last.text += ch;
    else segments.push({ text: ch, kind, same: kind === "same" });
  };

  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i].toLowerCase() === b[j].toLowerCase()) {
      push(a[i], "same");
      i++;
      j++;
    } else if (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) {
      push(a[i], "extra"); // in this string, absent from the other
      i++;
    } else if (j < m) {
      push(b[j], "missing"); // in the other string, absent from this one
      j++;
    }
  }
  return segments;
};

/**
 * Plain-language summary of what actually differs between two songs, e.g.
 * 'Title differs: "Mr Brightside" vs "Mr. Brightside"'. Returned as a list so
 * a group can differ in title, artist, or both.
 */
export const describeDifferences = (
  a: DuplicateSong,
  b: DuplicateSong
): string[] => {
  const out: string[] = [];
  const nameSame = a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
  const artistSame =
    a.artist.trim().toLowerCase() === b.artist.trim().toLowerCase();

  if (!nameSame) out.push(`Title differs: "${a.name}" vs "${b.name}"`);
  if (!artistSame) out.push(`Artist differs: "${a.artist}" vs "${b.artist}"`);
  if (nameSame && artistSame) {
    out.push("Title and artist are identical - these are exact duplicates.");
  }
  if ((a.vocalRange || "") !== (b.vocalRange || "")) {
    out.push(
      `Vocal range differs: ${a.vocalRange || "none"} vs ${b.vocalRange || "none"}`
    );
  }
  return out;
};
