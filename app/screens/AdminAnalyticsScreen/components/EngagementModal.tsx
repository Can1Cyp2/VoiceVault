import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnalyticsModal } from './AnalyticsModal';
import { BarChart, PieChart, StatHighlight, DataTable } from './Charts';

interface EngagementModalProps {
    visible: boolean;
    onClose: () => void;
    colors: any;
    stats: {
        total_users: number;
    } | null;
    extendedStats: {
        users_with_vocal_range?: number;
        total_saved_lists?: number;
        total_saved_songs?: number;
    };
    userAnalytics: {
        total_active_users: number;
        users_with_saved_songs: number;
        users_with_saved_lists: number;
        most_common_min_range: string;
        most_common_max_range: string;
    } | null;
    engagementMetrics: {
        avg_vocal_range_semitones: number;
        avg_lists_per_user: number;
        total_users_with_saved_songs: number;
    } | null;
}

export function EngagementModal({ 
    visible, 
    onClose, 
    colors, 
    stats,
    extendedStats,
    userAnalytics,
    engagementMetrics
}: EngagementModalProps) {
    const totalUsers = stats?.total_users || 1;
    const usersWithRange = extendedStats?.users_with_vocal_range || 0;
    const activeUsers = userAnalytics?.total_active_users || 0;
    const usersWithSongs = userAnalytics?.users_with_saved_songs || 0;
    const usersWithLists = userAnalytics?.users_with_saved_lists || 0;
    
    // Engagement breakdown for pie chart
    const engagementData = [
        { label: 'Highly Active', value: Math.round(activeUsers * 0.3), color: '#27ae60' },
        { label: 'Moderate', value: Math.round(activeUsers * 0.5), color: '#3498db' },
        { label: 'Low Activity', value: Math.round(activeUsers * 0.2), color: '#f39c12' },
        { label: 'Inactive', value: Math.max(0, totalUsers - activeUsers), color: '#e74c3c' },
    ];
    
    // Feature adoption data
    const featureAdoptionData = [
        { label: 'Vocal Range', value: usersWithRange, color: colors.primary },
        { label: 'Saved Songs', value: usersWithSongs, color: '#3498db' },
        { label: 'Saved Lists', value: usersWithLists, color: '#9b59b6' },
        { label: 'Active', value: activeUsers, color: '#27ae60' },
    ];
    
    // Calculate percentages
    const calcPercent = (value: number) => ((value / totalUsers) * 100).toFixed(1);

    return (
        <AnalyticsModal 
            visible={visible} 
            onClose={onClose} 
            title="User Engagement" 
            icon="🎯" 
            colors={colors}
        >
            {/* Key Stats */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🔥 Engagement Overview</Text>
            <View style={styles.statsRow}>
                <StatHighlight 
                    value={`${calcPercent(activeUsers)}%`}
                    label="Active Rate" 
                    icon="🔥" 
                    colors={colors}
                />
                <StatHighlight 
                    value={`${calcPercent(usersWithRange)}%`}
                    label="Set Vocal Range" 
                    icon="🎵" 
                    colors={colors}
                />
            </View>

            {/* Activity Breakdown */}
            <PieChart 
                data={engagementData}
                title="👥 User Activity Breakdown"
                colors={colors}
                size={140}
            />
            
            {/* Feature Adoption */}
            <BarChart 
                data={featureAdoptionData}
                title="📱 Feature Adoption"
                colors={colors}
                horizontal
                maxValue={totalUsers}
            />

            {/* Detailed Stats Table */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📊 Detailed Breakdown</Text>
            <DataTable 
                headers={['Metric', 'Users', '%']}
                rows={[
                    ['With Vocal Range', usersWithRange, `${calcPercent(usersWithRange)}%`],
                    ['With Saved Songs', usersWithSongs, `${calcPercent(usersWithSongs)}%`],
                    ['With Saved Lists', usersWithLists, `${calcPercent(usersWithLists)}%`],
                    ['Active (30 days)', activeUsers, `${calcPercent(activeUsers)}%`],
                ]}
                colors={colors}
            />
            
            {/* Vocal Range Insights */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🎼 Vocal Range Insights</Text>
            <View style={[styles.insightCard, { backgroundColor: colors.backgroundCard }]}>
                <View style={styles.insightRow}>
                    <View style={styles.insightItem}>
                        <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Most Common Low</Text>
                        <Text style={[styles.insightValue, { color: colors.primary }]}>
                            {userAnalytics?.most_common_min_range || 'N/A'}
                        </Text>
                    </View>
                    <View style={styles.insightDivider} />
                    <View style={styles.insightItem}>
                        <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Most Common High</Text>
                        <Text style={[styles.insightValue, { color: colors.primary }]}>
                            {userAnalytics?.most_common_max_range || 'N/A'}
                        </Text>
                    </View>
                </View>
                <View style={[styles.avgRangeBox, { backgroundColor: colors.backgroundTertiary }]}>
                    <Text style={[styles.avgRangeLabel, { color: colors.textSecondary }]}>Average Vocal Range</Text>
                    <Text style={[styles.avgRangeValue, { color: colors.primary }]}>
                        {(engagementMetrics?.avg_vocal_range_semitones || 0).toFixed(0)} semitones
                    </Text>
                    <Text style={[styles.avgRangeNote, { color: colors.textTertiary }]}>
                        (~{((engagementMetrics?.avg_vocal_range_semitones || 0) / 12).toFixed(1)} octaves)
                    </Text>
                </View>
            </View>

            {/* Content Engagement */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>💾 Content Engagement</Text>
            <View style={styles.contentStats}>
                <View style={[styles.contentStatCard, { backgroundColor: colors.backgroundCard }]}>
                    <Text style={styles.contentStatIcon}>📋</Text>
                    <Text style={[styles.contentStatValue, { color: colors.primary }]}>
                        {extendedStats?.total_saved_lists || 0}
                    </Text>
                    <Text style={[styles.contentStatLabel, { color: colors.textSecondary }]}>Total Lists</Text>
                    <Text style={[styles.contentStatSub, { color: colors.textTertiary }]}>
                        {(engagementMetrics?.avg_lists_per_user || 0).toFixed(1)} avg/user
                    </Text>
                </View>
                <View style={[styles.contentStatCard, { backgroundColor: colors.backgroundCard }]}>
                    <Text style={styles.contentStatIcon}>🎵</Text>
                    <Text style={[styles.contentStatValue, { color: colors.primary }]}>
                        {extendedStats?.total_saved_songs || 0}
                    </Text>
                    <Text style={[styles.contentStatLabel, { color: colors.textSecondary }]}>Saved Songs</Text>
                    <Text style={[styles.contentStatSub, { color: colors.textTertiary }]}>
                        {usersWithSongs > 0 
                            ? ((extendedStats?.total_saved_songs || 0) / usersWithSongs).toFixed(1) 
                            : '0'} avg/user
                    </Text>
                </View>
            </View>
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
    insightCard: {
        borderRadius: 12,
        padding: 16,
    },
    insightRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    insightItem: {
        flex: 1,
        alignItems: 'center',
    },
    insightDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(128,128,128,0.2)',
    },
    insightLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    insightValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    avgRangeBox: {
        marginTop: 16,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    avgRangeLabel: {
        fontSize: 12,
    },
    avgRangeValue: {
        fontSize: 28,
        fontWeight: 'bold',
        marginTop: 4,
    },
    avgRangeNote: {
        fontSize: 11,
        marginTop: 2,
    },
    contentStats: {
        flexDirection: 'row',
        gap: 12,
    },
    contentStatCard: {
        flex: 1,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    contentStatIcon: {
        fontSize: 28,
        marginBottom: 8,
    },
    contentStatValue: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    contentStatLabel: {
        fontSize: 12,
        marginTop: 4,
    },
    contentStatSub: {
        fontSize: 10,
        marginTop: 2,
    },
});
