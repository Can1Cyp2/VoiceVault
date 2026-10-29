// File location: app/screens/SearchScreen/SearchScreen.tsx
import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/StackNavigator";
import { Ionicons } from "@expo/vector-icons";
import { SearchBar } from "../../components/SearchBar/SearchBar";
import { supabase } from "../../util/supabase";
import { useSearch } from "../../util/useSearch";
import { useTheme } from "../../contexts/ThemeContext";
import {
  clearRecentHistory,
  getRecentHistoryItems,
  getSearchRecentsEnabled,
  isRecentSearchQuery,
  logRecentSearchQuery,
  removeRecentHistoryItem,
  RecentHistoryItem,
} from "../../util/recentlyViewed";
import { getVerifiedSongsOnly, isVerifiedSong } from "../../util/preferences";
import { logSongSearch } from "../../util/api";
import SongFilterModal from "../../components/SongFilters/SongFilterModal";
import RequestSongModal from "../../components/RequestSong/RequestSongModal";
import {
  countActiveFiltersForView,
  countActiveSongInfoFilters,
  countPausedFiltersForView,
  DEFAULT_SONG_FILTERS,
  getSongFilters,
  isArtistWithinBounds,
  isSongWithinBounds,
  saveSongFilters,
  SongFilters,
} from "../../util/songFilters";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Search">;

// Enough rows to fill a screen and leave something to scroll toward.
const MIN_VISIBLE_SONGS = 8;
// Cap on consecutive automatic page loads, so a filter that matches almost
// nothing cannot walk the entire catalogue in one go.
const MAX_AUTO_LOADS = 5;

// This component renders a search screen with a search bar, filter buttons, and a list of results (songs or artists):
export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"songs" | "artists">("songs");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vocalRange, setVocalRange] = useState<{ min_range: string; max_range: string } | null>(null);
  const [songFilters, setSongFilters] = useState<SongFilters>(DEFAULT_SONG_FILTERS);
  const [isFilterVisible, setFilterVisible] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [recentItems, setRecentItems] = useState<RecentHistoryItem[]>([]);
  const [isRecentVisible, setRecentVisible] = useState(false);
  const [searchRecentsEnabled, setSearchRecentsEnabledState] = useState(true);
  const [verifiedSongsOnly, setVerifiedSongsOnlyState] = useState(false);
  const [isAddMenuVisible, setAddMenuVisible] = useState(false);
  const [addMenuTop, setAddMenuTop] = useState(150);
  const [isRequestSongVisible, setRequestSongVisible] = useState(false);
  const addButtonRef = React.useRef<View>(null);


  const {
    results,
    songsLoading,
    artistsLoading,
    error,
    endReachedLoading,
    hasMoreArtists,
    hasMoreSongs,
    isSongInRange,
    isArtistInRange,
    handleRefresh,
    handleLoadMore,
    handleRetry,
  } = useSearch({
    query,
    filter,
    vocalRange,
    initialFetchDone,
    setInitialFetchDone,
    trendingFirst: songFilters.trendingFirst,
    songInfoFilters: songFilters.songInfo,
    // Applied DB-side while browsing so pages come back full, instead of
    // being hollowed out by the client-side pass below.
    verifiedOnly: songFilters.verifiedOnly || verifiedSongsOnly,
  });

  // Create themed styles
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Deduplicate and filter results
  const displayData = useMemo(() => {
    let filteredResults = results;

    // Apply vocal range filter if active
    if (songFilters.inRangeOnly) {
      filteredResults = filter === "songs"
        ? results.filter((item) => isSongInRange(item.vocalRange))
        : results.filter((item) => isArtistInRange(item));
    }

    if (filter === "artists" && songFilters.customRangeEnabled) {
      // Same "Chosen Range" filter as songs, judged on the artist's overall
      // range - the figure their own screen shows.
      filteredResults = filteredResults.filter((item) =>
        isArtistWithinBounds(item, songFilters.customRangeMin, songFilters.customRangeMax)
      );
    }

    if (filter === "songs") {
      // Verified-only: from the search filter popup or the global preference
      if (songFilters.verifiedOnly || verifiedSongsOnly) {
        filteredResults = filteredResults.filter((item) => isVerifiedSong(item));
      }

      // Community uploads only
      if (songFilters.userAddedOnly) {
        filteredResults = filteredResults.filter((item) => !isVerifiedSong(item));
      }

      // Chosen note range: song must fit entirely inside the picked bounds
      if (songFilters.customRangeEnabled) {
        filteredResults = filteredResults.filter((item) =>
          isSongWithinBounds(item.vocalRange, songFilters.customRangeMin, songFilters.customRangeMax)
        );
      }
    }

    // Deduplicate by ID (for songs) or name (for artists)
    const seen = new Set();
    const uniqueResults = filteredResults.filter((item) => {
      const key = filter === "songs" ? item.id : item.name;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    return uniqueResults;
  }, [results, filter, songFilters, verifiedSongsOnly, isSongInRange, isArtistInRange]);
  const isLoading = songsLoading || (filter === "artists" && artistsLoading);

  // Auto-fill thin pages.
  //
  // "In Range" and "Chosen Range" have to be applied here rather than in the
  // query, because they compare parsed note values ("C3 - A4") that SQL
  // cannot evaluate. So a full page of 25 fetched songs can render as two
  // rows, which used to look like "no results" and left pull-to-refresh as
  // the only way to see more. Instead, keep requesting pages until there is
  // enough to actually scroll, or the data genuinely runs out.
  //
  // Bounded on purpose: a filter matching almost nothing must not spin
  // through the whole catalogue. After MAX_AUTO_LOADS the user still has
  // normal scroll-to-load-more, it just stops doing it automatically.
  const autoLoadCountRef = React.useRef(0);

  // A new query or filter set is a fresh start, so allow auto-filling again.
  React.useEffect(() => {
    autoLoadCountRef.current = 0;
  }, [query, filter, songFilters]);

  React.useEffect(() => {
    if (filter !== "songs") return;
    if (isLoading || endReachedLoading || !hasMoreSongs) return;
    if (displayData.length >= MIN_VISIBLE_SONGS) return;
    if (autoLoadCountRef.current >= MAX_AUTO_LOADS) return;

    autoLoadCountRef.current += 1;
    handleLoadMore();
    // handleLoadMore is intentionally not a dependency: it is recreated on
    // every render, which would re-run this effect constantly and spend the
    // auto-load budget on renders that never actually fetched. The listed
    // deps are all stable primitives, so this runs only on real changes, and
    // endReachedLoading flipping true immediately re-runs it into the guard
    // above until the in-flight page lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayData.length, hasMoreSongs, isLoading, endReachedLoading, filter]);

  const refreshRecentHistory = useCallback(async () => {
    const [items, enabled, verifiedOnly] = await Promise.all([
      getRecentHistoryItems(),
      getSearchRecentsEnabled(),
      getVerifiedSongsOnly(),
    ]);
    setRecentItems(items);
    setSearchRecentsEnabledState(enabled);
    setVerifiedSongsOnlyState(verifiedOnly);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshRecentHistory();
    }, [refreshRecentHistory])
  );

  // Load the saved search filters once on mount
  React.useEffect(() => {
    void getSongFilters().then(setSongFilters);
  }, []);

  React.useEffect(() => {
    const trimmedQuery = query.trim().replace(/\s+/g, " ");
    if (!searchRecentsEnabled || trimmedQuery.length < 2) return;

    const timeout = setTimeout(() => {
      void logRecentSearchQuery(trimmedQuery, filter).then(refreshRecentHistory);
    }, 900);

    return () => clearTimeout(timeout);
  }, [filter, query, refreshRecentHistory, searchRecentsEnabled]);

  // Fetch the user's vocal range when the component mounts
  React.useEffect(() => {
    const fetchUserVocalRange = async () => {
      try {
        const user = supabase.auth.user();
        if (!user) {
          setIsLoggedIn(false);
          setVocalRange(null);
          return;
        }
        setIsLoggedIn(true);
        const { data, error: rangeError } = await supabase
          .from("user_vocal_ranges")
          .select("min_range, max_range")
          .eq("user_id", user.id) 
          .single();
        if (!rangeError) {
          setVocalRange(data);
        } else {
          setVocalRange(null);
        }
      } catch (err) {
        console.error("Error fetching vocal range:", err);
        setIsLoggedIn(false);
      }
    };

    fetchUserVocalRange();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        setIsLoggedIn(true);
        fetchUserVocalRange();
      } else if (event === "SIGNED_OUT") {
        setIsLoggedIn(false);
        setVocalRange(null);
        // The in-range filter needs an account; drop it on sign-out
        setSongFilters((prev) => {
          const next = { ...prev, inRangeOnly: false };
          void saveSongFilters(next);
          return next;
        });
      }
    });
    
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Opens the add/request dropdown anchored just below the plus button
  const handleAddPress = () => {
    addButtonRef.current?.measureInWindow((_x, y, _width, height) => {
      setAddMenuTop(y + height + 6);
      setAddMenuVisible(true);
    });
  };

  // Function to handle pressing on a song or artist:
  // navigates to the details screen for the selected song or artist
  const handlePress = (item: any) => {
    if (filter === "songs") {
      // Feeds the "Trending" filter; fire-and-forget so navigation never waits
      void logSongSearch(item.id);
      navigation.navigate("Details", {
        name: item.name,
        artist: item.artist,
        vocalRange: item.vocalRange,
        username: item.username,
      });
    } else if (filter === "artists") {
      navigation.navigate("ArtistDetails", {
        name: item.name,
      });
    }
  };

  const openRecentItem = (item: RecentHistoryItem) => {
    setRecentVisible(false);

    if (isRecentSearchQuery(item)) {
      setFilter(item.filter);
      setQuery(item.query);
      void logRecentSearchQuery(item.query, item.filter).then(refreshRecentHistory);
      return;
    }

    navigation.navigate("Details", {
      name: item.name,
      artist: item.artist,
      vocalRange: item.vocalRange,
      username: item.username,
    });
  };

  const handleRemoveRecentItem = async (item: RecentHistoryItem) => {
    await removeRecentHistoryItem(item);
    const remaining = await getRecentHistoryItems();
    setRecentItems(remaining);
    if (remaining.length === 0) {
      setRecentVisible(false);
    }
  };

  const handleClearRecent = () => {
    Alert.alert(
      "Clear History",
      "Remove all recently viewed songs and searches?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearRecentHistory();
            setRecentItems([]);
            setRecentVisible(false);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const hasVocalRange =
    !!vocalRange && vocalRange.min_range !== "C0" && vocalRange.max_range !== "C0";

  // Badge and empty-state copy describe the CURRENT view only: in the
  // Artists view the song-only filters stay saved but do not narrow
  // anything, so counting them would blame results on filters that are not
  // running. countPausedFiltersForView is what powers the note that says so.
  const activeFilterCount = countActiveFiltersForView(songFilters, filter);
  const pausedFilterCount = countPausedFiltersForView(songFilters, filter);
  const activeSongInfoFilterCount =
    filter === "songs" ? countActiveSongInfoFilters(songFilters.songInfo) : 0;

  // Save or tap-outside from the filter popup: persist and apply
  const handleFiltersSave = (filters: SongFilters) => {
    setSongFilters(filters);
    void saveSongFilters(filters);
    setFilterVisible(false);
  };


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.searchBarContainer}>
        <SearchBar value={query} onSearch={setQuery} containerStyle={styles.searchInput} />
        {searchRecentsEnabled && recentItems.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open recent songs and searches"
            style={({ pressed }) => [
              styles.recentSearchButton,
              { borderColor: colors.border, backgroundColor: colors.backgroundCard },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => setRecentVisible(true)}
          >
            <Ionicons name="time-outline" size={24} color={colors.primary} />
          </Pressable>
        )}
      </View>
      <View style={styles.filterContainer}>
        <Pressable
          ref={addButtonRef}
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}
          onPress={handleAddPress}
          accessibilityRole="button"
          accessibilityLabel="Add or request a song"
        >
          <Ionicons name="add-circle" size={36} color={colors.primary} />
        </Pressable>
        <View style={styles.filterButtonsWrapper}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { borderColor: colors.border, backgroundColor: colors.backgroundCard },
              filter === "songs" && [styles.activeFilter, { backgroundColor: colors.primary, borderColor: colors.primary }]
            ]}
            // The query carries over between the two views, so switching is
            // "show me the artists for what I just typed" rather than
            // starting the search again from nothing.
            onPress={() => setFilter("songs")}
          >
            <Text style={[styles.filterText, { color: colors.textPrimary }, filter === "songs" && { color: colors.textInverse }]}>Songs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { borderColor: colors.border, backgroundColor: colors.backgroundCard },
              filter === "artists" && [styles.activeFilter, { backgroundColor: colors.primary, borderColor: colors.primary }]
            ]}
            onPress={() => setFilter("artists")}
          >
            <Text style={[styles.filterText, { color: colors.textPrimary }, filter === "artists" && { color: colors.textInverse }]}>Artists</Text>
          </TouchableOpacity>
          <Pressable
            style={({ pressed }) => [styles.filterButtonRight, pressed && { opacity: 0.7 }]}
            onPress={() => setFilterVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open song filters"
          >
            <Ionicons name="options" size={30} color={colors.primary} />
            {activeFilterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error}</Text>
          <TouchableOpacity onPress={handleRetry} style={[styles.retryButton, { backgroundColor: colors.lightGray }]}>
            <Text style={[styles.retryButtonText, { color: colors.textPrimary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {!error && isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
            {filter === "songs" ? "Loading songs..." : "Loading artists..."}
          </Text>
          <View style={[styles.loadingBarTrack, { backgroundColor: colors.lightGray }]}>
            <View style={[styles.loadingBarFill, { backgroundColor: colors.primary }]} />
          </View>
        </View>
      )}
      {!isLoading && initialFetchDone && displayData.length === 0 && !error && (
        <ScrollView
          contentContainerStyle={styles.emptyStateContainer}
          refreshControl={
            <RefreshControl
              refreshing={filter === "songs" ? songsLoading : artistsLoading}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
        >
          <Ionicons name="search-outline" size={44} color={colors.textTertiary} />
          <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>No results found.</Text>
          {(activeFilterCount > 0 || (filter === "songs" && verifiedSongsOnly)) && (
            <Text style={[styles.emptyStateHint, { color: colors.textTertiary }]}>
              {filter === "artists"
                ? "Artists are matched on their overall range, which is wider than any one song's - so a range filter hides them quickly. Try widening it or turning it off."
                : activeSongInfoFilterCount > 0
                  ? "Not every song has this extra info yet, which may be hiding results. Try widening your Song Info filters or turning some off."
                  : "Your active filters may be hiding songs. Try widening your range or turning some off."}
            </Text>
          )}
          <View style={styles.emptyStateButtons}>
            {(activeFilterCount > 0 || (filter === "songs" && verifiedSongsOnly)) && (
              <TouchableOpacity
                style={[styles.refreshButton, { backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => setFilterVisible(true)}
              >
                <Ionicons name="options" size={18} color={colors.primary} />
                <Text style={[styles.refreshButtonText, { color: colors.primary }]}>Adjust filters</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.refreshButton, { backgroundColor: colors.primary }]}
              onPress={handleRefresh}
            >
              <Ionicons name="refresh" size={18} color={colors.buttonText} />
              <Text style={[styles.refreshButtonText, { color: colors.buttonText }]}>Try again</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.emptyStateHint, { color: colors.textTertiary }]}>
            Pull down to refresh
          </Text>
        </ScrollView>
      )}
      {/* Says out loud what the badge no longer counts: song-only filters
          are still saved, they just do not narrow the artist list. Without
          this the artists view looks like it is ignoring the filters. */}
      {filter === "artists" && pausedFilterCount > 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.pausedFiltersBanner,
            { backgroundColor: colors.backgroundTertiary, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => setFilterVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Song-only filters are paused in the artists view. Open filters."
        >
          <Ionicons name="lock-closed" size={14} color={colors.textTertiary} />
          <Text style={[styles.pausedFiltersText, { color: colors.textSecondary }]}>
            {pausedFilterCount} song-only {pausedFilterCount === 1 ? "filter" : "filters"} paused
            here - still applied under Songs.
          </Text>
        </Pressable>
      )}
      {filter === "artists" &&
        !artistsLoading &&
        songFilters.inRangeOnly &&
        hasVocalRange && (
          <View style={[styles.inRangeExplanationContainer, { backgroundColor: colors.highlightAlt }]}>
            <Text style={[styles.inRangeExplanationText, { color: colors.textPrimary }]}>
              You may not have artists in your range. Keep refreshing to load more artists.
            </Text>
          </View>
        )}
      {!isLoading && displayData.length > 0 && (
        <FlatList
          style={{ minHeight: '88%' }}
          contentContainerStyle={{
            paddingBottom: 90
          }}
          keyExtractor={(item) => filter === "songs" ? `song-${item.id}` : `artist-${item.name}`}
          data={displayData}
          renderItem={({ item }) => {
            if (filter === "songs" && (!item.name || !item.artist || !item.vocalRange)) return null;
            if (filter === "artists" && !item.name) return null;
            return (
              <TouchableOpacity onPress={() => handlePress(item)}>
                <View style={[styles.resultItem, { backgroundColor: colors.backgroundCard, shadowColor: colors.shadow }]}>
                  <View style={[styles.resultIcon, { backgroundColor: colors.highlightAlt }]}>
                    <Ionicons
                      name={filter === "songs" ? "musical-notes" : "person"}
                      size={25}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.resultTextContainer}>
                    <Text style={[styles.resultText, { color: colors.textPrimary }]}>{item.name}</Text>
                    {filter === "songs" && (
                      <Text style={[styles.resultSubText, { color: colors.textSecondary }]}>
                        {item.artist} • {item.vocalRange}
                      </Text>
                    )}
                  </View>
                  {isLoggedIn && vocalRange && (
                    <Ionicons
                      name={
                        filter === "songs"
                          ? isSongInRange(item.vocalRange)
                            ? "checkmark-circle"
                            : "close-circle"
                          : isArtistInRange(item)
                            ? "checkmark-circle"
                            : "close-circle"
                      }
                      size={31}
                      color={
                        filter === "songs"
                          ? isSongInRange(item.vocalRange)
                            ? colors.primary
                            : colors.darkGray
                          : isArtistInRange(item)
                            ? colors.primary
                            : colors.darkGray
                      }
                      style={styles.inRangeIcon}
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            filter === "songs" && endReachedLoading ? (
              <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textPrimary }]}>Loading more...</Text>
              </View>
            ) : filter === "artists" && query.length === 0 ? (
              <View style={[styles.swipeMessageContainer, { backgroundColor: colors.lightGray }]}>
                <Text style={[styles.swipeMessageText, { color: colors.textPrimary }]}>
                  Swipe down from top to cycle artists:
                </Text>
              </View>
            ) : null
          }
          onEndReached={filter === "songs" ? handleLoadMore : null} // Disable onEndReached for artists
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={filter === "songs" ? songsLoading : artistsLoading}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
          overScrollMode="always" // Enable overscroll on Android
          bounces={true} // overscroll on ios
        />
      )}

      {/* Add / Request song dropdown (anchored under the plus button) */}
      <Modal
        visible={isAddMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddMenuVisible(false)}
      >
        <Pressable style={styles.addMenuBackdrop} onPress={() => setAddMenuVisible(false)}>
          <View
            style={[
              styles.addMenuContainer,
              { top: addMenuTop, backgroundColor: colors.backgroundCard, borderColor: colors.border, shadowColor: colors.shadow },
            ]}
          >
            <TouchableOpacity
              style={styles.addMenuOption}
              onPress={() => {
                setAddMenuVisible(false);
                navigation.navigate("AddSong");
              }}
              accessibilityRole="button"
              accessibilityLabel="Add a new song with its vocal range"
            >
              <Ionicons name="musical-notes-outline" size={22} color={colors.primary} />
              <View style={styles.addMenuTextContainer}>
                <Text style={[styles.addMenuTitle, { color: colors.textPrimary }]}>Add Song</Text>
                <Text style={[styles.addMenuSubtitle, { color: colors.textSecondary }]}>
                  Submit a song with its vocal range
                </Text>
              </View>
            </TouchableOpacity>
            <View style={[styles.addMenuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.addMenuOption}
              onPress={() => {
                setAddMenuVisible(false);
                setRequestSongVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Request a song to be added"
            >
              <Ionicons name="send-outline" size={22} color={colors.primary} />
              <View style={styles.addMenuTextContainer}>
                <Text style={[styles.addMenuTitle, { color: colors.textPrimary }]}>Request Song</Text>
                <Text style={[styles.addMenuSubtitle, { color: colors.textSecondary }]}>
                  Ask our team to add a song for you
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <RequestSongModal
        visible={isRequestSongVisible}
        onClose={() => setRequestSongVisible(false)}
      />

      <SongFilterModal
        visible={isFilterVisible}
        filters={songFilters}
        view={filter}
        isLoggedIn={isLoggedIn}
        hasVocalRange={hasVocalRange}
        onSave={handleFiltersSave}
        onCancel={() => setFilterVisible(false)}
        onRequireLogin={() => {
          setFilterVisible(false);
          (navigation.getParent() as any)?.navigate("Home");
        }}
      />

      <Modal
        visible={isRecentVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRecentVisible(false)}
      >
        <View style={[styles.recentModalContainer, { backgroundColor: colors.overlay }]}>
          <View style={[styles.recentModalContent, { backgroundColor: colors.backgroundCard }]}>
            <View style={styles.recentModalHeader}>
              <Text style={[styles.recentModalTitle, { color: colors.textPrimary }]}>
                Recent
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close recent history"
                style={styles.recentCloseIcon}
                onPress={() => setRecentVisible(false)}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={recentItems}
              keyExtractor={(item) =>
                isRecentSearchQuery(item)
                  ? `query-${item.filter}-${item.query}`
                  : `song-${item.name}-${item.artist}`
              }
              renderItem={({ item }) => {
                const isQuery = isRecentSearchQuery(item);
                return (
                  <TouchableOpacity
                    style={[styles.recentItem, { backgroundColor: colors.backgroundTertiary, borderColor: colors.border }]}
                    onPress={() => openRecentItem(item)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.recentItemIcon, { backgroundColor: colors.highlightAlt }]}>
                      <Ionicons
                        name={isQuery ? "search" : "musical-notes"}
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.recentItemText}>
                      <Text
                        style={[styles.recentItemName, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {isQuery ? item.query : item.name}
                      </Text>
                      <Text
                        style={[styles.recentItemSub, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {isQuery
                          ? `Search ${item.filter}`
                          : `${item.artist} - ${item.vocalRange}`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={
                        isQuery
                          ? `Remove search ${item.query} from history`
                          : `Remove ${item.name} from history`
                      }
                      style={styles.recentItemDelete}
                      onPress={() => {
                        void handleRemoveRecentItem(item);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity style={styles.recentClearButton} onPress={handleClearRecent}>
              <Text style={[styles.recentClearText, { color: colors.danger }]}>Clear History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  container: { flex: 1, paddingTop: 30 },
  searchBarContainer: {
    marginTop: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
  },
  recentSearchButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { textAlign: "center", marginVertical: 10 },
  loadingBarTrack: {
    width: 140,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  loadingBarFill: {
    width: "65%",
    height: "100%",
    borderRadius: 2,
  },
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 15,
    paddingHorizontal: 16,
  },
  addButton: {
    position: "absolute",
    left: 17,
    zIndex: 10,
  },
  addMenuBackdrop: {
    flex: 1,
  },
  addMenuContainer: {
    position: "absolute",
    left: 16,
    width: 270,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  addMenuOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  addMenuTextContainer: {
    flex: 1,
  },
  addMenuTitle: {
    fontSize: 15.5,
    fontWeight: "600",
  },
  addMenuSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  addMenuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  filterButtonsWrapper: {
    flexDirection: "row",
    justifyContent: "center",
    flex: 1,
  },
  filterButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginHorizontal: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  activeFilter: { 
    // Colors applied inline
  },
  resultItem: {
    padding: 17,
    marginVertical: 6,
    marginHorizontal: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultText: {
    fontSize: 17.5,
    fontWeight: "600",
  },
  resultSubText: {
    fontSize: 13.5,
    marginTop: 3,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginBottom: 10,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  retryButtonText: {
    fontWeight: "bold",
  },
  noResultsText: { textAlign: "center", marginVertical: 20 },
  emptyStateContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyStateHint: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
  },
  emptyStateButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  refreshButton: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  inRangeIcon: {
    marginLeft: "auto",
  },
  resultIcon: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  // Sits inside filterButtonsWrapper, whose right edge is already inset by
  // the container's 16px padding - so right: 0 lines up with the recents
  // button above it.
  filterButtonRight: {
    position: "absolute",
    right: 0,
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  filterBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  loadingFooter: {
    paddingVertical: 10,
  },
  pausedFiltersBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  pausedFiltersText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  inRangeExplanationContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 5,
  },
  inRangeExplanationText: {
    fontSize: 14,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  swipeMessageContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 5,
  },
  swipeMessageText: {
    fontSize: 14,
    textAlign: "center",
  },
  recentModalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  recentModalContent: {
    borderRadius: 16,
    padding: 18,
    width: "90%",
    maxHeight: "72%",
  },
  recentModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  recentModalTitle: {
    fontSize: 22,
    fontWeight: "bold",
  },
  recentCloseIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginVertical: 4,
  },
  recentItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  recentItemText: {
    flex: 1,
  },
  recentItemName: {
    fontSize: 15,
    fontWeight: "600",
  },
  recentItemSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
  recentItemDelete: {
    marginLeft: 8,
    padding: 2,
  },
  recentClearButton: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 8,
  },
  recentClearText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
