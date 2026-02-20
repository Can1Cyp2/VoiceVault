import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnalyticsModal } from './AnalyticsModal';
import { BarChart, StatHighlight, DataTable } from './Charts';

interface ContentModalProps {
    visible: boolean;
    onClose: () => void;
    colors: any;
    stats: {
        total_songs: number;
        pending_songs: number;
    } | null;
    extendedStats: {
        total_saved_lists?: number;
        total_saved_songs?: number;
    };
    mostSavedSongs: {
        song_name: string;
        artist: string;
        save_count: number;
    }[];
}

export function ContentModal({ 
    visible, 
    onClose, 
    colors, 
    stats,
    extendedStats,
    mostSavedSongs
}: ContentModalProps) {
    const totalSongs = stats?.total_songs || 0;
    const pendingSongs = stats?.pending_songs || 0;
    const approvedSongs = totalSongs - pendingSongs;
    const totalSavedLists = extendedStats?.total_saved_lists || 0;
    const totalSavedSongs = extendedStats?.total_saved_songs || 0;
    
    // Content status breakdown
    const statusData = [
        { label: 'Approved', value: approvedSongs, color: '#27ae60' },
        { label: 'Pending', value: pendingSongs, color: '#f39c12' },
    ];
    
    // Top 5 songs for chart
    const topSongsData = mostSavedSongs.slice(0, 5).map((song, index) => ({
        label: song.song_name.substring(0, 10) + (song.song_name.length > 10 ? '...' : ''),
        value: song.save_count,
        color: ['#9b59b6', '#3498db', '#27ae60', '#f39c12', '#e74c3c'][index],
    }));

    // Calculate approval rate
    const approvalRate = totalSongs > 0 ? ((approvedSongs / totalSongs) * 100).toFixed(1) : '100';
    
    // Avg saves per song
    const avgSavesPerSong = approvedSongs > 0 ? (totalSavedSongs / approvedSongs).toFixed(2) : '0';

    return (
        <AnalyticsModal 
            visible={visible} 
            onClose={onClose} 
            title="Content Analytics" 
            icon="📚" 
            colors={colors}
        >
            {/* Overview Stats */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📊 Content Overview</Text>
            <View style={styles.statsRow}>
                <StatHighlight 
                    value={totalSongs}
                    label="Total Songs" 
                    icon="🎵" 
                    colors={colors}
                />
                <StatHighlight 
                    value={pendingSongs}
                    label="Pending Review" 
                    icon="⏳"
                    trend={pendingSongs > 0 ? 'up' : 'neutral'}
                    trendValue={pendingSongs > 0 ? 'Needs attention' : 'All clear'}
                    colors={colors}
                />
            </View>
            
            {/* Content Status */}
            <BarChart 
                data={statusData}
                title="✅ Content Status"
                colors={colors}
                height={140}
            />
            
            {/* Approval Stats */}
            <View style={[styles.approvalCard, { backgroundColor: colors.backgroundCard }]}>
                <View style={styles.approvalHeader}>
                    <Text style={[styles.approvalTitle, { color: colors.textPrimary }]}>Approval Rate</Text>
                    <Text style={[styles.approvalValue, { color: colors.primary }]}>{approvalRate}%</Text>
                </View>
                <View style={styles.approvalMeter}>
                    <View style={[styles.approvalMeterFill, { 
                        width: `${approvalRate}%` as any,
                        backgroundColor: '#27ae60'
                    }]} />
                </View>
                <Text style={[styles.approvalSubtext, { color: colors.textSecondary }]}>
                    {approvedSongs} approved / {totalSongs} total songs
                </Text>
            </View>

            {/* User Collections */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>💾 User Collections</Text>
            <View style={styles.collectionsRow}>
                <View style={[styles.collectionCard, { backgroundColor: colors.backgroundCard }]}>
                    <Text style={styles.collectionIcon}>📋</Text>
                    <Text style={[styles.collectionValue, { color: colors.primary }]}>{totalSavedLists}</Text>
                    <Text style={[styles.collectionLabel, { color: colors.textSecondary }]}>Playlists Created</Text>
                </View>
                <View style={[styles.collectionCard, { backgroundColor: colors.backgroundCard }]}>
                    <Text style={styles.collectionIcon}>⭐</Text>
                    <Text style={[styles.collectionValue, { color: colors.primary }]}>{totalSavedSongs}</Text>
                    <Text style={[styles.collectionLabel, { color: colors.textSecondary }]}>Songs Saved</Text>
                </View>
            </View>
            
            <View style={[styles.avgCard, { backgroundColor: colors.backgroundTertiary }]}>
                <Text style={[styles.avgLabel, { color: colors.textSecondary }]}>Average Saves per Song</Text>
                <Text style={[styles.avgValue, { color: colors.primary }]}>{avgSavesPerSong}</Text>
            </View>

            {/* Top Saved Songs */}
            {topSongsData.length > 0 && (
                <>
                    <BarChart 
                        data={topSongsData}
                        title="🏆 Most Saved Songs"
                        colors={colors}
                        horizontal
                    />
                    
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🎵 Top 10 Songs</Text>
                    <DataTable 
                        headers={['#', 'Song', 'Saves']}
                        rows={mostSavedSongs.slice(0, 10).map((song, i) => [
                            `${i + 1}`,
                            `${song.song_name.substring(0, 20)}${song.song_name.length > 20 ? '...' : ''}`,
                            song.save_count.toString(),
                        ])}
                        colors={colors}
                    />
                </>
            )}

            {/* Pending Queue Info */}
            {pendingSongs > 0 && (
                <View style={[styles.pendingCard, { backgroundColor: '#fff3cd', borderColor: '#ffc107' }]}>
                    <Text style={styles.pendingIcon}>⚠️</Text>
                    <View style={styles.pendingContent}>
                        <Text style={[styles.pendingTitle, { color: '#856404' }]}>
                            {pendingSongs} songs awaiting review
                        </Text>
                        <Text style={[styles.pendingSubtext, { color: '#856404' }]}>
                            Head to Content Moderation to review submissions
                        </Text>
                    </View>
                </View>
            )}
        </AnalyticsModal>
    );
}

const styles = StyleSheet.create({
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 24,
        marginBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    approvalCard: {
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
    },
    approvalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    approvalTitle: {
        fontSize: 14,
        fontWeight: '500',
    },
    approvalValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    approvalMeter: {
        height: 8,
        backgroundColor: 'rgba(128,128,128,0.2)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    approvalMeterFill: {
        height: '100%',
        borderRadius: 4,
    },
    approvalSubtext: {
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    },
    collectionsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    collectionCard: {
        flex: 1,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    collectionIcon: {
        fontSize: 28,
        marginBottom: 8,
    },
    collectionValue: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    collectionLabel: {
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    avgCard: {
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    avgLabel: {
        fontSize: 13,
    },
    avgValue: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    pendingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 16,
        marginTop: 24,
        borderWidth: 1,
    },
    pendingIcon: {
        fontSize: 28,
        marginRight: 12,
    },
    pendingContent: {
        flex: 1,
    },
    pendingTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    pendingSubtext: {
        fontSize: 12,
        marginTop: 2,
    },
});
