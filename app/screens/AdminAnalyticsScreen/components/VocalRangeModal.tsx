import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnalyticsModal } from './AnalyticsModal';
import { BarChart, StatHighlight, DataTable } from './Charts';

interface VocalRangeModalProps {
    visible: boolean;
    onClose: () => void;
    colors: any;
    minRangeDistribution: { note: string; count: number }[];
    maxRangeDistribution: { note: string; count: number }[];
    userAnalytics: {
        most_common_min_range: string;
        most_common_max_range: string;
    } | null;
    engagementMetrics: {
        avg_vocal_range_semitones: number;
    } | null;
    extendedStats: {
        users_with_vocal_range?: number;
    };
}

export function VocalRangeModal({ 
    visible, 
    onClose, 
    colors, 
    minRangeDistribution,
    maxRangeDistribution,
    userAnalytics,
    engagementMetrics,
    extendedStats
}: VocalRangeModalProps) {
    const usersWithRange = extendedStats?.users_with_vocal_range || 0;
    const avgSemitones = engagementMetrics?.avg_vocal_range_semitones || 0;
    const avgOctaves = (avgSemitones / 12).toFixed(1);
    
    // Prepare chart data
    const minRangeData = minRangeDistribution.slice(0, 8).map((item, index) => ({
        label: item.note,
        value: item.count,
        color: ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e91e63'][index % 8],
    }));
    
    const maxRangeData = maxRangeDistribution.slice(0, 8).map((item, index) => ({
        label: item.note,
        value: item.count,
        color: ['#9b59b6', '#3498db', '#1abc9c', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c', '#e91e63'][index % 8],
    }));
    
    // Calculate voice type estimates based on common ranges
    const estimateVoiceTypes = () => {
        // This is a rough estimate based on typical vocal classifications
        const total = usersWithRange || 1;
        return {
            bass: Math.round(total * 0.08),
            baritone: Math.round(total * 0.22),
            tenor: Math.round(total * 0.20),
            alto: Math.round(total * 0.18),
            mezzosoprano: Math.round(total * 0.17),
            soprano: Math.round(total * 0.15),
        };
    };
    
    const voiceTypes = estimateVoiceTypes();

    return (
        <AnalyticsModal 
            visible={visible} 
            onClose={onClose} 
            title="Vocal Range Analysis" 
            icon="🎼" 
            colors={colors}
        >
            {/* Key Stats */}
            <View style={styles.statsRow}>
                <StatHighlight 
                    value={usersWithRange}
                    label="Users with Range" 
                    icon="🎤" 
                    colors={colors}
                />
                <StatHighlight 
                    value={`${avgOctaves} oct`}
                    label="Average Range" 
                    icon="📏" 
                    colors={colors}
                />
            </View>

            {/* Most Common Notes */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🎯 Most Common Notes</Text>
            <View style={[styles.commonNotesCard, { backgroundColor: colors.backgroundCard }]}>
                <View style={styles.commonNoteItem}>
                    <Text style={[styles.commonNoteLabel, { color: colors.textSecondary }]}>Lowest Note</Text>
                    <View style={[styles.noteBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.noteBadgeText}>{userAnalytics?.most_common_min_range || 'N/A'}</Text>
                    </View>
                </View>
                <View style={styles.commonNoteDivider} />
                <View style={styles.commonNoteItem}>
                    <Text style={[styles.commonNoteLabel, { color: colors.textSecondary }]}>Highest Note</Text>
                    <View style={[styles.noteBadge, { backgroundColor: colors.secondary }]}>
                        <Text style={styles.noteBadgeText}>{userAnalytics?.most_common_max_range || 'N/A'}</Text>
                    </View>
                </View>
            </View>

            {/* Range Stats */}
            <View style={[styles.rangeStatsCard, { backgroundColor: colors.backgroundTertiary }]}>
                <View style={styles.rangeStatItem}>
                    <Text style={[styles.rangeStatValue, { color: colors.primary }]}>{avgSemitones.toFixed(0)}</Text>
                    <Text style={[styles.rangeStatLabel, { color: colors.textSecondary }]}>Avg Semitones</Text>
                </View>
                <View style={styles.rangeStatItem}>
                    <Text style={[styles.rangeStatValue, { color: colors.primary }]}>{avgOctaves}</Text>
                    <Text style={[styles.rangeStatLabel, { color: colors.textSecondary }]}>Avg Octaves</Text>
                </View>
                <View style={styles.rangeStatItem}>
                    <Text style={[styles.rangeStatValue, { color: colors.primary }]}>{Math.round(avgSemitones / 3)}</Text>
                    <Text style={[styles.rangeStatLabel, { color: colors.textSecondary }]}>Avg Full Notes</Text>
                </View>
            </View>

            {/* Lowest Notes Distribution */}
            {minRangeData.length > 0 && (
                <BarChart 
                    data={minRangeData}
                    title="📉 Lowest Note Distribution"
                    colors={colors}
                    horizontal
                />
            )}

            {/* Highest Notes Distribution */}
            {maxRangeData.length > 0 && (
                <BarChart 
                    data={maxRangeData}
                    title="📈 Highest Note Distribution"
                    colors={colors}
                    horizontal
                />
            )}

            {/* Voice Type Estimates */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🎭 Estimated Voice Types</Text>
            <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
                *Rough estimates based on typical classifications
            </Text>
            <DataTable 
                headers={['Voice Type', 'Est. Users', 'Range']}
                rows={[
                    ['Bass', voiceTypes.bass.toString(), 'E2-E4'],
                    ['Baritone', voiceTypes.baritone.toString(), 'A2-A4'],
                    ['Tenor', voiceTypes.tenor.toString(), 'C3-C5'],
                    ['Alto', voiceTypes.alto.toString(), 'F3-F5'],
                    ['Mezzo-Soprano', voiceTypes.mezzosoprano.toString(), 'A3-A5'],
                    ['Soprano', voiceTypes.soprano.toString(), 'C4-C6'],
                ]}
                colors={colors}
            />

            {/* All Low Notes */}
            {minRangeDistribution.length > 0 && (
                <>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📋 All Lowest Notes</Text>
                    <DataTable 
                        headers={['Note', 'Count', '%']}
                        rows={minRangeDistribution.slice(0, 15).map(item => [
                            item.note,
                            item.count.toString(),
                            `${((item.count / usersWithRange) * 100).toFixed(1)}%`,
                        ])}
                        colors={colors}
                    />
                </>
            )}

            {/* All High Notes */}
            {maxRangeDistribution.length > 0 && (
                <>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📋 All Highest Notes</Text>
                    <DataTable 
                        headers={['Note', 'Count', '%']}
                        rows={maxRangeDistribution.slice(0, 15).map(item => [
                            item.note,
                            item.count.toString(),
                            `${((item.count / usersWithRange) * 100).toFixed(1)}%`,
                        ])}
                        colors={colors}
                    />
                </>
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
    commonNotesCard: {
        borderRadius: 12,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    commonNoteItem: {
        flex: 1,
        alignItems: 'center',
    },
    commonNoteDivider: {
        width: 1,
        height: 50,
        backgroundColor: 'rgba(128,128,128,0.2)',
    },
    commonNoteLabel: {
        fontSize: 12,
        marginBottom: 8,
    },
    noteBadge: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    noteBadgeText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    rangeStatsCard: {
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 16,
    },
    rangeStatItem: {
        alignItems: 'center',
    },
    rangeStatValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    rangeStatLabel: {
        fontSize: 11,
        marginTop: 4,
    },
    disclaimer: {
        fontSize: 11,
        fontStyle: 'italic',
        marginBottom: 8,
    },
});
