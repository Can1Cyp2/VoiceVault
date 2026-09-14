// File location: app/screens/ContentModerationScreen/DuplicatesTab.tsx
// Admin-only, private. Kept out of git (see .gitignore).
//
// Finds near-duplicate songs and lets an admin collapse each group to a single
// row. The point of this screen is to make the DIFFERENCE obvious: the exact
// characters that differ are highlighted, and stated in words above, so the
// admin can tell at a glance whether it is the title or the artist that is off
// and which spelling is the correct one.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import {
    DuplicateGroup,
    DuplicateSong,
    fetchDuplicateSongs,
    mergeDuplicateSongs,
    describeDifferences,
    diffChars,
} from '../../util/duplicateSongsApi';

// Looser than this and unrelated songs by the same artist start matching.
const MIN_SIMILARITY = 0.72;

interface Props {
    onMerged?: () => void;
}

/**
 * Renders a string showing exactly how it differs from `compareTo`:
 *   - characters only in THIS string are highlighted
 *   - characters only in the OTHER string are shown struck through, so a row
 *     that is missing a character (e.g. "Mr Brightside" against
 *     "Mr. Brightside") is visibly different rather than looking identical
 */
const DiffText: React.FC<{
    value: string;
    compareTo: string;
    style: any;
    highlightColor: string;
    missingColor: string;
}> = ({ value, compareTo, style, highlightColor, missingColor }) => {
    const segments = useMemo(() => diffChars(value, compareTo), [value, compareTo]);
    return (
        <Text style={style} numberOfLines={2}>
            {segments.map((seg, i) => {
                if (seg.kind === 'same') return <Text key={i}>{seg.text}</Text>;
                if (seg.kind === 'extra') {
                    return (
                        <Text key={i} style={{ backgroundColor: highlightColor, fontWeight: '800' }}>
                            {seg.text}
                        </Text>
                    );
                }
                return (
                    <Text
                        key={i}
                        style={{
                            color: missingColor,
                            textDecorationLine: 'line-through',
                            opacity: 0.75,
                        }}
                    >
                        {seg.text}
                    </Text>
                );
            })}
        </Text>
    );
};

export default function DuplicatesTab({ onMerged }: Props) {
    const { colors } = useTheme();

    const [groups, setGroups] = useState<DuplicateGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<number | null>(null);

    // group key -> song id the admin wants to keep
    const [keepChoice, setKeepChoice] = useState<Record<number, number>>({});
    // group key -> range to write onto the kept song
    const [rangeChoice, setRangeChoice] = useState<Record<number, string>>({});

    const load = useCallback(async () => {
        try {
            setError(null);
            const data = await fetchDuplicateSongs(MIN_SIMILARITY);
            setGroups(data);
            // Default to keeping the oldest row (lowest id): it is the one most
            // likely to be referenced elsewhere and to have been curated.
            const defaults: Record<number, number> = {};
            const ranges: Record<number, string> = {};
            for (const g of data) {
                defaults[g.key] = g.songs[0].id;
                ranges[g.key] = g.songs[0].vocalRange || '';
            }
            setKeepChoice(defaults);
            setRangeChoice(ranges);
        } catch (err: any) {
            const raw = err?.message || '';
            // Postgres' own timeout text is meaningless to an admin, so say
            // what actually happened and what to do about it.
            setError(
                /timeout/i.test(raw)
                    ? 'The duplicate scan took too long to finish. Pull down to retry, or lower the similarity threshold to narrow the search.'
                    : raw || 'Failed to scan for duplicates'
            );
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        load().finally(() => setLoading(false));
    }, [load]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const handleMerge = (group: DuplicateGroup) => {
        const keepId = keepChoice[group.key];
        const keeper = group.songs.find((s) => s.id === keepId);
        if (!keeper) return;
        const removeIds = group.songs.filter((s) => s.id !== keepId).map((s) => s.id);
        const finalRange = (rangeChoice[group.key] || '').trim();

        Alert.alert(
            'Merge duplicates?',
            `Keep:\n"${keeper.name}" by ${keeper.artist}` +
                (finalRange ? `\nRange: ${finalRange}` : '') +
                `\n\nThis permanently deletes ${removeIds.length} other ` +
                `${removeIds.length === 1 ? 'row' : 'rows'}. This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Merge',
                    style: 'destructive',
                    onPress: async () => {
                        setBusyKey(group.key);
                        try {
                            await mergeDuplicateSongs(keepId, removeIds, finalRange || null);
                            setGroups((prev) => prev.filter((g) => g.key !== group.key));
                            onMerged?.();
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to merge duplicates');
                        } finally {
                            setBusyKey(null);
                        }
                    },
                },
            ]
        );
    };

    const renderGroup = ({ item }: { item: DuplicateGroup }) => {
        const keepId = keepChoice[item.key] ?? item.songs[0].id;
        const keeper = item.songs.find((s) => s.id === keepId) || item.songs[0];
        const isBusy = busyKey === item.key;

        // Every difference in the group, described against the row being kept.
        const differences = item.songs
            .filter((s) => s.id !== keeper.id)
            .flatMap((s) => describeDifferences(keeper, s));
        const uniqueDifferences = Array.from(new Set(differences));

        const rangesDiffer =
            new Set(item.songs.map((s) => (s.vocalRange || '').trim())).size > 1;
        const exact = item.minNameSim >= 0.999 && item.minArtistSim >= 0.999;

        return (
            <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
                <View style={styles.cardTopRow}>
                    <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>
                        {item.songs.length} similar entries
                    </Text>
                    <View
                        style={[
                            styles.simBadge,
                            { backgroundColor: exact ? '#e74c3c22' : '#f39c1222' },
                        ]}
                    >
                        <Text style={[styles.simBadgeText, { color: exact ? '#e74c3c' : '#f39c12' }]}>
                            {exact
                                ? 'Exact match'
                                : `${Math.round(Math.min(item.minNameSim, item.minArtistSim) * 100)}% similar`}
                        </Text>
                    </View>
                </View>

                {/* What actually differs, in words, before the highlighted rows */}
                {uniqueDifferences.length > 0 && (
                    <View style={[styles.diffBox, { backgroundColor: colors.backgroundTertiary }]}>
                        {uniqueDifferences.map((d, i) => (
                            <Text key={i} style={[styles.diffText, { color: colors.textSecondary }]}>
                                {'•'} {d}
                            </Text>
                        ))}
                    </View>
                )}

                <Text style={[styles.pickHint, { color: colors.textTertiary }]}>
                    Select the row to keep. Highlighted characters are extra; struck-through
                    characters are missing compared to the selected row.
                </Text>

                {item.songs.map((song) => {
                    const selected = song.id === keepId;
                    return (
                        <TouchableOpacity
                            key={song.id}
                            style={[
                                styles.songRow,
                                { borderColor: selected ? colors.primary : colors.border },
                                selected && { backgroundColor: `${colors.primary}11` },
                            ]}
                            onPress={() =>
                                setKeepChoice((prev) => ({ ...prev, [item.key]: song.id }))
                            }
                            disabled={isBusy}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                        >
                            <Ionicons
                                name={selected ? 'radio-button-on' : 'radio-button-off'}
                                size={20}
                                color={selected ? colors.primary : colors.textTertiary}
                            />
                            <View style={styles.songInfo}>
                                <DiffText
                                    value={song.name}
                                    compareTo={keeper.name}
                                    style={[styles.songName, { color: colors.textPrimary }]}
                                    highlightColor="#f39c1255"
                                    missingColor="#e74c3c"
                                />
                                <DiffText
                                    value={song.artist}
                                    compareTo={keeper.artist}
                                    style={[styles.songArtist, { color: colors.textSecondary }]}
                                    highlightColor="#3498db55"
                                    missingColor="#e74c3c"
                                />
                                <View style={styles.songMetaRow}>
                                    <Text style={[styles.songMeta, { color: colors.textTertiary }]}>
                                        id {song.id}
                                    </Text>
                                    <Text style={[styles.songMeta, { color: colors.textTertiary }]}>
                                        {song.vocalRange || 'no range'}
                                    </Text>
                                    {song.createdAt && (
                                        <Text style={[styles.songMeta, { color: colors.textTertiary }]}>
                                            {new Date(song.createdAt).toLocaleDateString()}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}

                {/* Only worth asking which range is right when they disagree */}
                {rangesDiffer && (
                    <View style={styles.rangePicker}>
                        <Text style={[styles.rangePickerLabel, { color: colors.textSecondary }]}>
                            Range to keep
                        </Text>
                        <View style={styles.rangeChips}>
                            {Array.from(
                                new Set(
                                    item.songs
                                        .map((s) => (s.vocalRange || '').trim())
                                        .filter(Boolean)
                                )
                            ).map((r) => {
                                const active = (rangeChoice[item.key] || '').trim() === r;
                                return (
                                    <TouchableOpacity
                                        key={r}
                                        style={[
                                            styles.rangeChip,
                                            {
                                                borderColor: active ? colors.primary : colors.border,
                                                backgroundColor: active
                                                    ? colors.primary
                                                    : colors.backgroundCard,
                                            },
                                        ]}
                                        onPress={() =>
                                            setRangeChoice((prev) => ({ ...prev, [item.key]: r }))
                                        }
                                    >
                                        <Text
                                            style={[
                                                styles.rangeChipText,
                                                { color: active ? '#fff' : colors.textSecondary },
                                            ]}
                                        >
                                            {r}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <TextInput
                            style={[
                                styles.rangeInput,
                                { color: colors.textPrimary, borderColor: colors.border },
                            ]}
                            value={rangeChoice[item.key] ?? ''}
                            onChangeText={(v) =>
                                setRangeChoice((prev) => ({ ...prev, [item.key]: v }))
                            }
                            placeholder="or type the correct range, e.g. G#3 - C#5"
                            placeholderTextColor={colors.textPlaceholder}
                            autoCapitalize="characters"
                        />
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.mergeButton, { backgroundColor: '#e74c3c', opacity: isBusy ? 0.6 : 1 }]}
                    onPress={() => handleMerge(item)}
                    disabled={isBusy}
                >
                    {isBusy ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="git-merge" size={18} color="#fff" />
                            <Text style={styles.mergeButtonText}>
                                Keep selected, delete {item.songs.length - 1} other
                                {item.songs.length - 1 === 1 ? '' : 's'}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Scanning for duplicates
                </Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            {error && (
                <View style={[styles.errorContainer, { backgroundColor: '#e74c3c20' }]}>
                    <Text style={[styles.errorText, { color: '#e74c3c' }]}>{error}</Text>
                </View>
            )}
            <FlatList
                data={groups}
                renderItem={renderGroup}
                keyExtractor={(item) => item.key.toString()}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={[colors.primary]}
                    />
                }
                ListHeaderComponent={
                    groups.length > 0 ? (
                        <Text style={[styles.countHeader, { color: colors.textSecondary }]}>
                            {groups.length} duplicate {groups.length === 1 ? 'group' : 'groups'} found
                        </Text>
                    ) : null
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="checkmark-done" size={64} color={colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            {error ? 'Could not scan for duplicates' : 'No duplicates found'}
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    listContainer: { padding: 16, paddingBottom: 40 },
    countHeader: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
    card: {
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    groupTitle: { fontSize: 15, fontWeight: '700' },
    simBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    simBadgeText: { fontSize: 11, fontWeight: '700' },
    diffBox: { borderRadius: 8, padding: 10, marginBottom: 10 },
    diffText: { fontSize: 12, lineHeight: 18 },
    pickHint: { fontSize: 11.5, marginBottom: 8 },
    songRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
    },
    songInfo: { flex: 1 },
    songName: { fontSize: 14, fontWeight: '700' },
    songArtist: { fontSize: 12.5, marginTop: 2 },
    songMetaRow: { flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap' },
    songMeta: { fontSize: 11 },
    rangePicker: { marginTop: 4, marginBottom: 10 },
    rangePickerLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    rangeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    rangeChip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
    rangeChipText: { fontSize: 12, fontWeight: '600' },
    rangeInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 13,
    },
    mergeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 8,
        paddingVertical: 11,
    },
    mergeButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 13 },
    errorContainer: { margin: 16, padding: 12, borderRadius: 8 },
    errorText: { fontSize: 13 },
    emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 14 },
    emptyText: { fontSize: 15 },
});
