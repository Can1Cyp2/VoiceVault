// app/util/featuredSongsApi.ts
//
// Fetches the candidate songs the Featured engine (featuredSongs.ts) scores.
//
// Two pools, fetched in parallel:
//   * Tessitura pool - songs whose melody centre (tessitura_median) is one of
//     the note names inside the user's estimated comfort zone. Note names are
//     a small finite set, so this is an exact DB-side `in` filter, and it is
//     what guarantees the list contains real tessitura matches instead of
//     hoping random sampling happens to hit some. A random window into the
//     matching set keeps each refresh different.
//   * Random pool - a general random sample, for songs without tessitura
//     data that still fit the range, and for the near-miss stretch picks.
//
// vocalRange is stored as text ("C3 - A4"), which SQL can't compare as
// pitches, so range fit is judged client-side by the engine.

import { supabase } from "./supabase";
import { getRandomSongs } from "./api";
import {
  FeaturedSong,
  notesInZone,
  selectFeaturedSongs,
  selectTopSongs,
  songKey,
  TOP_PICK_COUNT,
  VoiceProfile,
} from "./featuredSongs";

const TESSITURA_WINDOW = 80;
const RANDOM_POOL_SIZE = 120;
// Picks with tessitura data to aim for; the spec asks for at least three,
// so another window is fetched while we are short of this.
const MIN_TESSITURA_PICKS = 3;
const MAX_TESSITURA_WINDOWS = 3;

const fetchTessituraWindow = async (
  zoneNotes: string[],
  total: number,
  verifiedOnly: boolean
): Promise<any[]> => {
  const offset = total > TESSITURA_WINDOW ? Math.floor(Math.random() * (total - TESSITURA_WINDOW)) : 0;
  let query = supabase.from("songs").select("*").in("tessitura_median", zoneNotes);
  if (verifiedOnly) query = query.is("username", null);
  const { data, error } = await query
    .order("id", { ascending: true })
    .range(offset, offset + TESSITURA_WINDOW - 1);
  if (error) {
    console.warn("Featured: tessitura window failed:", error.message);
    return [];
  }
  return data || [];
};

const countTessituraMatches = async (zoneNotes: string[], verifiedOnly: boolean): Promise<number> => {
  let query = supabase
    .from("songs")
    .select("id", { count: "exact", head: true })
    .in("tessitura_median", zoneNotes);
  if (verifiedOnly) query = query.is("username", null);
  const { count, error } = await query;
  if (error) {
    // Most likely the metadata columns don't exist yet; Featured still works
    // from the random pool, just without tessitura picks.
    console.warn("Featured: tessitura count failed:", error.message);
    return 0;
  }
  return count ?? 0;
};

export type FeaturedResults = {
  top: FeaturedSong[];
  songs: FeaturedSong[];
};

/**
 * Build a fresh Featured list for this voice. Every call draws new random
 * pools, which is what "refresh for a new list" relies on. `avoidTop` holds
 * the previous top picks, so a refresh doesn't show them again.
 */
export const fetchFeaturedSongs = async (
  profile: VoiceProfile,
  opts: { verifiedOnly?: boolean; avoidTop?: Set<string> } = {}
): Promise<FeaturedResults> => {
  const verifiedOnly = !!opts.verifiedOnly;
  const zoneNotes = notesInZone(profile);

  const [matchCount, randomPool] = await Promise.all([
    countTessituraMatches(zoneNotes, verifiedOnly),
    getRandomSongs(RANDOM_POOL_SIZE),
  ]);

  const randomCandidates = verifiedOnly
    ? randomPool.filter((song) => !song?.username)
    : randomPool;

  let candidates = [...randomCandidates];
  if (matchCount > 0) {
    // Windows may overlap when the matching set is small; selectFeaturedSongs
    // dedupes, so that only costs a little wasted bandwidth.
    const windows = Math.min(MAX_TESSITURA_WINDOWS, Math.ceil(matchCount / TESSITURA_WINDOW));
    for (let i = 0; i < windows; i++) {
      candidates = candidates.concat(await fetchTessituraWindow(zoneNotes, matchCount, verifiedOnly));
      const picks = selectFeaturedSongs(candidates, profile, { random: () => 0 });
      const enoughTessitura = picks.filter((p) => p.info.category === "tessitura").length >= MIN_TESSITURA_PICKS;
      if (enoughTessitura && selectTopSongs(candidates, profile).length >= TOP_PICK_COUNT) break;
    }
  }

  const top = selectTopSongs(candidates, profile, { avoid: opts.avoidTop });
  const topKeys = new Set(top.map((t) => songKey(t.song)));
  return {
    top,
    // Top picks only appear once, above the rest of the list.
    songs: selectFeaturedSongs(candidates.filter((song) => !topKeys.has(songKey(song))), profile),
  };
};
