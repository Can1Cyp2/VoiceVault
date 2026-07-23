// File location: app/screens/ContentModerationScreen/SongRequestsTab.tsx
// Admin view of user/guest song requests inside the Content Moderation screen.
// Supports search, status + date filtering, batch actions, per-request notes,
// and CSV/JSON export (for hunting down vocal ranges of requested songs).

import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    RefreshControl,
    Modal,
    Alert,
    Share,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import {
    SongRequest,
    SongRequestStatus,
    updateSongRequest,
    deleteSongRequest,
} from '../../util/api';

interface SongRequestsTabProps {
    requests: SongRequest[];
    refreshing: boolean;
    onRefresh: () => Promise<void>;
    reloadData: () => Promise<void>;
}

const STATUS_META: Record<SongRequestStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    pending: { label: 'Pending', color: '#f39c12', icon: 'time' },
    approved: { label: 'Approved', color: '#27ae60', icon: 'checkmark-circle' },
    rejected: { label: 'Rejected', color: '#e74c3c', icon: 'close-circle' },
    edited_and_approved: { label: 'Edited & Approved', color: '#3498db', icon: 'create' },
};

const STATUS_FILTERS: Array<{ key: 'all' | SongRequestStatus; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'edited_and_approved', label: 'Edited' },
];

const DATE_FILTERS: Array<{ key: 'all' | '7d' | '30d'; label: string }> = [
    { key: 'all', label: 'All time' },
    { key: '7d', label: 'Last 7 days' },
    { key: '30d', label: 'Last 30 days' },
];

export default function SongRequestsTab({ requests, refreshing, onRefresh, reloadData }: SongRequestsTabProps) {
    const { colors } = useTheme();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | SongRequestStatus>('all');
    const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d'>('all');
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [detailRequest, setDetailRequest] = useState<SongRequest | null>(null);
    const [detailNotes, setDetailNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const filteredRequests = useMemo(() => {
        const query = search.trim().toLowerCase();
        const now = Date.now();
        const cutoff =
            dateFilter === '7d' ? now - 7 * 24 * 60 * 60 * 1000 :
            dateFilter === '30d' ? now - 30 * 24 * 60 * 60 * 1000 :
            null;

        return requests.filter((req) => {
            if (statusFilter !== 'all' && req.status !== statusFilter) return false;
            if (cutoff && new Date(req.created_at).getTime() < cutoff) return false;
            if (query) {
                const requester = (req.username || 'guest').toLowerCase();
                if (
                    !req.song_name.toLowerCase().includes(query) &&
                    !req.artist_name.toLowerCase().includes(query) &&
                    !requester.includes(query)
                ) {
                    return false;
                }
            }
            return true;
        });
    }, [requests, search, statusFilter, dateFilter]);

    const toggleSelected = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const exitSelectMode = () => {
        setSelectMode(false);
        setSelectedIds(new Set());
    };

    const openDetail = (request: SongRequest) => {
        setDetailRequest(request);
        setDetailNotes(request.notes || '');
    };

    const closeDetail = () => {
        setDetailRequest(null);
        setDetailNotes('');
    };

    // Single-request status change from the detail modal (also saves notes)
    const handleSetStatus = async (status: SongRequestStatus) => {
        if (!detailRequest) return;
        try {
            setSaving(true);
            await updateSongRequest(detailRequest.id, status, detailNotes.trim() || undefined);
            closeDetail();
            await reloadData();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update request');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSingle = () => {
        if (!detailRequest) return;
        const id = detailRequest.id;
        Alert.alert(
            'Delete Request',
            'Permanently delete this song request? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setSaving(true);
                            await deleteSongRequest(id);
                            closeDetail();
                            await reloadData();
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to delete request');
                        } finally {
                            setSaving(false);
                        }
                    },
                },
            ]
        );
    };

    // Batch status update / delete for all selected requests
    const handleBatch = (action: SongRequestStatus | 'delete') => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        const label = action === 'delete' ? 'Delete' : `Mark as ${STATUS_META[action].label}`;
        Alert.alert(
            `${label} ${ids.length} request${ids.length > 1 ? 's' : ''}?`,
            action === 'delete' ? 'This cannot be undone.' : undefined,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: label,
                    style: action === 'delete' ? 'destructive' : 'default',
                    onPress: async () => {
                        const failures: number[] = [];
                        for (const id of ids) {
                            try {
                                if (action === 'delete') await deleteSongRequest(id);
                                else await updateSongRequest(id, action);
                            } catch {
                                failures.push(id);
                            }
                        }
                        exitSelectMode();
                        await reloadData();
                        if (failures.length > 0) {
                            Alert.alert('Partial failure', `${failures.length} request(s) could not be updated.`);
                        }
                    },
                },
            ]
        );
    };

    // Export the currently filtered list so admins can research vocal ranges
    const handleExport = () => {
        if (filteredRequests.length === 0) {
            Alert.alert('Nothing to export', 'No requests match the current filters.');
            return;
        }
        Alert.alert('Export Requests', `Export ${filteredRequests.length} filtered request(s) as:`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'JSON', onPress: () => shareExport('json') },
            { text: 'CSV', onPress: () => shareExport('csv') },
        ]);
    };

    const shareExport = async (format: 'csv' | 'json') => {
        try {
            let content: string;
            if (format === 'json') {
                content = JSON.stringify(
                    filteredRequests.map((r) => ({
                        id: r.id,
                        song_name: r.song_name,
                        artist_name: r.artist_name,
                        requester: r.username || 'Guest',
                        status: r.status,
                        notes: r.notes,
                        created_at: r.created_at,
                    })),
                    null,
                    2
                );
            } else {
                const escapeCsv = (value: string | null) =>
                    `"${(value ?? '').replace(/"/g, '""')}"`;
                const header = 'id,song_name,artist_name,requester,status,notes,created_at';
                const rows = filteredRequests.map((r) =>
                    [
                        r.id,
                        escapeCsv(r.song_name),
                        escapeCsv(r.artist_name),
                        escapeCsv(r.username || 'Guest'),
                        r.status,
                        escapeCsv(r.notes),
                        r.created_at,
                    ].join(',')
                );
                content = [header, ...rows].join('\n');
            }
            await Share.share({ message: content });
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to export requests');
        }
    };

    const renderRequest = ({ item }: { item: SongRequest }) => {
        const meta = STATUS_META[item.status];
        const isSelected = selectedIds.has(item.id);
        return (
            <TouchableOpacity
                style={[
                    styles.card,
                    { backgroundColor: colors.backgroundCard },
                    selectMode && isSelected && { borderWidth: 2, borderColor: colors.primary },
                ]}
                onPress={() => (selectMode ? toggleSelected(item.id) : openDetail(item))}
                onLongPress={() => {
                    if (!selectMode) {
                        setSelectMode(true);
                        toggleSelected(item.id);
                    }
                }}
                activeOpacity={0.75}
            >
                <View style={styles.cardRow}>
                    {selectMode && (
                        <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={24}
                            color={isSelected ? colors.primary : colors.textTertiary}
                            style={{ marginRight: 10 }}
                        />
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.songTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                            {item.song_name}
                        </Text>
                        <Text style={[styles.songArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.artist_name}
                        </Text>
                        <Text style={[styles.submittedBy, { color: colors.textSecondary }]}>
                            By: {item.username || 'Guest'} • {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${meta.color}22` }]}>
                        <Ionicons name={meta.icon} size={14} color={meta.color} />
                        <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1 }}>
            {/* Search + toolbar */}
            <View style={styles.toolbar}>
                <View style={[styles.searchBox, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
                    <Ionicons name="search" size={18} color={colors.textTertiary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.textPrimary }]}
                        placeholder="Search song, artist, or requester"
                        placeholderTextColor={colors.textPlaceholder}
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    style={[styles.toolbarButton, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
                    onPress={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                    accessibilityLabel={selectMode ? 'Exit selection mode' : 'Select multiple requests'}
                >
                    <Ionicons
                        name={selectMode ? 'close' : 'checkbox-outline'}
                        size={20}
                        color={selectMode ? '#e74c3c' : colors.primary}
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toolbarButton, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
                    onPress={handleExport}
                    accessibilityLabel="Export requests"
                >
                    <Ionicons name="download-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Status + date filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
                {STATUS_FILTERS.map((f) => (
                    <TouchableOpacity
                        key={f.key}
                        style={[
                            styles.chip,
                            { borderColor: colors.border, backgroundColor: colors.backgroundCard },
                            statusFilter === f.key && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setStatusFilter(f.key)}
                    >
                        <Text style={[styles.chipText, { color: statusFilter === f.key ? '#fff' : colors.textSecondary }]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
                <View style={[styles.chipDivider, { backgroundColor: colors.border }]} />
                {DATE_FILTERS.map((f) => (
                    <TouchableOpacity
                        key={f.key}
                        style={[
                            styles.chip,
                            { borderColor: colors.border, backgroundColor: colors.backgroundCard },
                            dateFilter === f.key && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setDateFilter(f.key)}
                    >
                        <Text style={[styles.chipText, { color: dateFilter === f.key ? '#fff' : colors.textSecondary }]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <FlatList
                data={filteredRequests}
                renderItem={renderRequest}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="send" size={64} color={colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            {requests.length === 0 ? 'No song requests yet' : 'No requests match your filters'}
                        </Text>
                    </View>
                }
            />

            {/* Batch action bar */}
            {selectMode && selectedIds.size > 0 && (
                <View style={[styles.batchBar, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
                    <Text style={[styles.batchCount, { color: colors.textPrimary }]}>{selectedIds.size} selected</Text>
                    <TouchableOpacity style={[styles.batchButton, { backgroundColor: '#27ae60' }]} onPress={() => handleBatch('approved')}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                        <Text style={styles.batchButtonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.batchButton, { backgroundColor: '#e74c3c' }]} onPress={() => handleBatch('rejected')}>
                        <Ionicons name="close" size={16} color="#fff" />
                        <Text style={styles.batchButtonText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.batchButton, { backgroundColor: '#7f8c8d' }]} onPress={() => handleBatch('delete')}>
                        <Ionicons name="trash" size={16} color="#fff" />
                        <Text style={styles.batchButtonText}>Delete</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Detail / review modal */}
            <Modal visible={!!detailRequest} transparent animationType="fade" onRequestClose={closeDetail}>
                <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
                    <View style={[styles.modalContainer, { backgroundColor: colors.backgroundCard }]}>
                        {detailRequest && (
                            <ScrollView keyboardShouldPersistTaps="handled">
                                <View style={styles.modalHeader}>
                                    <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Review Request</Text>
                                    <TouchableOpacity onPress={closeDetail} accessibilityLabel="Close request details">
                                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={[styles.detailSong, { color: colors.textPrimary }]}>{detailRequest.song_name}</Text>
                                <Text style={[styles.detailArtist, { color: colors.textSecondary }]}>{detailRequest.artist_name}</Text>

                                <View style={styles.detailMetaBlock}>
                                    <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>
                                        Requested by: {detailRequest.username || 'Guest'}
                                    </Text>
                                    <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>
                                        Date: {new Date(detailRequest.created_at).toLocaleString()}
                                    </Text>
                                    <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>
                                        Current status: {STATUS_META[detailRequest.status].label}
                                    </Text>
                                    {detailRequest.reviewed_at && (
                                        <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>
                                            Last reviewed: {new Date(detailRequest.reviewed_at).toLocaleString()}
                                        </Text>
                                    )}
                                </View>

                                <Text style={[styles.notesLabel, { color: colors.textPrimary }]}>Admin notes (visible to requester)</Text>
                                <TextInput
                                    style={[styles.notesInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
                                    placeholder="e.g. Added! / Couldn't find a reliable vocal range for this song."
                                    placeholderTextColor={colors.textPlaceholder}
                                    value={detailNotes}
                                    onChangeText={setDetailNotes}
                                    multiline
                                    maxLength={1000}
                                    editable={!saving}
                                />

                                <Text style={[styles.notesLabel, { color: colors.textPrimary }]}>Set status</Text>
                                <View style={styles.statusButtonsGrid}>
                                    {(Object.keys(STATUS_META) as SongRequestStatus[]).map((status) => (
                                        <TouchableOpacity
                                            key={status}
                                            style={[
                                                styles.statusButton,
                                                { borderColor: STATUS_META[status].color },
                                                detailRequest.status === status && { backgroundColor: STATUS_META[status].color },
                                            ]}
                                            onPress={() => handleSetStatus(status)}
                                            disabled={saving}
                                        >
                                            <Ionicons
                                                name={STATUS_META[status].icon}
                                                size={16}
                                                color={detailRequest.status === status ? '#fff' : STATUS_META[status].color}
                                            />
                                            <Text
                                                style={[
                                                    styles.statusButtonText,
                                                    { color: detailRequest.status === status ? '#fff' : STATUS_META[status].color },
                                                ]}
                                            >
                                                {STATUS_META[status].label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <TouchableOpacity
                                    style={[styles.saveNotesButton, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
                                    onPress={() => handleSetStatus(detailRequest.status)}
                                    disabled={saving}
                                >
                                    <Text style={styles.saveNotesButtonText}>
                                        {saving ? 'Saving...' : 'Save Notes (keep status)'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.deleteLink} onPress={handleDeleteSingle} disabled={saving}>
                                    <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                                    <Text style={styles.deleteLinkText}>Delete this request</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        gap: 8,
    },
    searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 42,
        gap: 6,
    },
    searchInput: {
        flex: 1,
        fontSize: 14.5,
        paddingVertical: 0,
    },
    toolbarButton: {
        width: 42,
        height: 42,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipsRow: {
        flexGrow: 0,
        marginTop: 10,
    },
    chipsContent: {
        paddingHorizontal: 16,
        alignItems: 'center',
        gap: 6,
    },
    chip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    chipText: {
        fontSize: 12.5,
        fontWeight: '600',
    },
    chipDivider: {
        width: 1,
        height: 20,
        marginHorizontal: 4,
    },
    listContainer: {
        padding: 16,
        paddingBottom: 90,
    },
    card: {
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    songTitle: {
        fontSize: 16.5,
        fontWeight: 'bold',
    },
    songArtist: {
        fontSize: 14.5,
        marginTop: 2,
    },
    submittedBy: {
        fontSize: 12,
        marginTop: 6,
        fontStyle: 'italic',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 10,
        marginLeft: 8,
    },
    statusBadgeText: {
        fontSize: 11.5,
        fontWeight: '700',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
    },
    batchBar: {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        padding: 10,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 6,
    },
    batchCount: {
        fontSize: 13.5,
        fontWeight: '700',
        flex: 1,
    },
    batchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    batchButtonText: {
        color: '#fff',
        fontSize: 12.5,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        borderRadius: 16,
        padding: 20,
        width: '90%',
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    detailSong: {
        fontSize: 19,
        fontWeight: 'bold',
    },
    detailArtist: {
        fontSize: 16,
        marginTop: 2,
    },
    detailMetaBlock: {
        marginTop: 12,
        gap: 3,
    },
    detailMeta: {
        fontSize: 13,
    },
    notesLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 6,
    },
    notesInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        minHeight: 70,
        fontSize: 14,
        textAlignVertical: 'top',
    },
    statusButtonsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statusButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1.5,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    statusButtonText: {
        fontSize: 12.5,
        fontWeight: '700',
    },
    saveNotesButton: {
        marginTop: 16,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    saveNotesButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    deleteLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        marginTop: 14,
        paddingVertical: 6,
    },
    deleteLinkText: {
        color: '#e74c3c',
        fontSize: 13.5,
        fontWeight: '600',
    },
});
