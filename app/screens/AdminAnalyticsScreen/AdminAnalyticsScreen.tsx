import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { supabase } from '../../util/supabase';
import { useAdminStatus } from '../../util/adminUtils';
import { useTheme } from '../../contexts/ThemeContext';

interface DetailedStats {
    total_users: number;
    new_today: number;
    new_this_week: number;
    new_this_month: number;
    total_songs: number;
    pending_songs: number;
    total_issues: number;
    open_issues: number;
    total_saved_lists: number;
    total_saved_songs: number;
    users_with_vocal_range: number;
    total_coins_distributed: number;
    avg_coins_per_user: number;
}

interface UserAnalytics {
    total_users: number;
    users_with_vocal_range: number;
    users_with_saved_songs: number;
    users_with_saved_lists: number;
    most_common_min_range: string;
    most_common_max_range: string;
    avg_coins_per_user: number;
    total_active_users: number;
}

interface VocalRangeDistribution {
    note: string;
    count: number;
}

interface EngagementMetrics {
    avg_vocal_range_semitones: number;
    avg_lists_per_user: number;
    users_with_coins: number;
    total_users_with_saved_songs: number;
    week_over_week_growth: number;
    month_over_month_growth: number;
}

interface MostSavedSong {
    song_name: string;
    artist: string;
    save_count: number;
}

interface SupportMetrics {
    total_issues: number;
    resolved_issues: number;
    resolution_rate: number;
    avg_resolution_time_hours: number;
}

export default function AdminAnalyticsScreen({ navigation }: any) {
    const { isAdmin, loading: adminLoading } = useAdminStatus();
    const { colors } = useTheme();
    const [stats, setStats] = useState<DetailedStats | null>(null);
    const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
    const [minRangeDistribution, setMinRangeDistribution] = useState<VocalRangeDistribution[]>([]);
    const [maxRangeDistribution, setMaxRangeDistribution] = useState<VocalRangeDistribution[]>([]);
    const [engagementMetrics, setEngagementMetrics] = useState<EngagementMetrics | null>(null);
    const [mostSavedSongs, setMostSavedSongs] = useState<MostSavedSong[]>([]);
    const [supportMetrics, setSupportMetrics] = useState<SupportMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        if (!adminLoading && isAdmin) {
            fetchAllData();
        } else if (!adminLoading && !isAdmin) {
            navigation.replace('Profile');
        }
    }, [adminLoading, isAdmin]);

    const fetchAllData = async () => {
        try {
            setError(null);
            
            const { data: statsData, error: statsError } = await supabase.rpc('admin_get_detailed_stats');
            if (statsError) throw statsError;
            if (statsData && statsData.length > 0) setStats(statsData[0]);

            const { data: analyticsData, error: analyticsError } = await supabase.rpc('admin_get_user_analytics');
            if (analyticsError) throw analyticsError;
            if (analyticsData && analyticsData.length > 0) setUserAnalytics(analyticsData[0]);

            const { data: minData, error: minError} = await supabase.rpc('admin_get_min_range_distribution');
            if (!minError && minData) setMinRangeDistribution(minData);

            const { data: maxData, error: maxError } = await supabase.rpc('admin_get_max_range_distribution');
            if (!maxError && maxData) setMaxRangeDistribution(maxData);

            const { data: engagementData, error: engagementError } = await supabase.rpc('admin_get_engagement_metrics');
            if (!engagementError && engagementData && engagementData.length > 0) setEngagementMetrics(engagementData[0]);

            const { data: songsData, error: songsError } = await supabase.rpc('admin_get_most_saved_songs');
            if (!songsError && songsData) setMostSavedSongs(songsData);

            const { data: supportData, error: supportError } = await supabase.rpc('admin_get_support_metrics');
            if (!supportError && supportData && supportData.length > 0) setSupportMetrics(supportData[0]);
        } catch (err: any) {
            console.error('Error fetching analytics:', err);
            setError(err.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchAllData();
    };

    const toggleSection = (sectionName: string) => {
        setExpandedSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }));
    };

    const calculatePercentage = (part: number, total: number) => {
        if (total === 0) return 0;
        return ((part / total) * 100).toFixed(1);
    };

    if (adminLoading || loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading Analytics...</Text>
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.errorContainer}>
                    <Text style={[styles.errorText, { color: colors.error }]}>❌ {error}</Text>
                    <TouchableOpacity 
                        style={[styles.retryButton, { backgroundColor: colors.primary }]} 
                        onPress={fetchAllData}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        >
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>📊 Admin Analytics</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Comprehensive System Overview</Text>
            </View>

            {/* User Growth Section */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>👥 User Growth</Text>
                <View style={styles.row}>
                    <MetricCard label="Total Users" value={stats?.total_users?.toString() || '0'} icon="👤" colors={colors} />
                    <MetricCard label="New Today" value={stats?.new_today?.toString() || '0'} icon="✨" color="#27ae60" colors={colors} />
                </View>
                <View style={styles.row}>
                    <MetricCard label="New This Week" value={stats?.new_this_week?.toString() || '0'} icon="📅" color="#3498db" colors={colors} />
                    <MetricCard label="New This Month" value={stats?.new_this_month?.toString() || '0'} icon="📆" color="#9b59b6" colors={colors} />
                </View>
            </View>

            {/* Engagement Section */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🎯 User Engagement</Text>
                <View style={styles.row}>
                    <MetricCard 
                        label="With Vocal Range" 
                        value={stats?.users_with_vocal_range?.toString() || '0'}
                        subtitle={`${calculatePercentage(stats?.users_with_vocal_range || 0, stats?.total_users || 0)}% of users`}
                        icon="🎵" 
                        colors={colors}
                    />
                    <MetricCard 
                        label="Active Users" 
                        value={userAnalytics?.total_active_users?.toString() || '0'}
                        subtitle={`${calculatePercentage(userAnalytics?.total_active_users || 0, stats?.total_users || 0)}% active`}
                        icon="🔥" 
                        color="#e67e22" 
                        colors={colors}
                    />
                </View>
            </View>

            {/* Vocal Range Distribution (Expandable) */}
            <View style={styles.section}>
                <TouchableOpacity 
                    style={[styles.expandableHeader, { backgroundColor: colors.backgroundCard }]}
                    onPress={() => toggleSection('vocalRange')}
                >
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                        🎼 Vocal Range Distribution
                    </Text>
                    <Text style={[styles.expandIcon, { color: colors.textPrimary }]}>
                        {expandedSections['vocalRange'] ? '▼' : '▶'}
                    </Text>
                </TouchableOpacity>
                
                {expandedSections['vocalRange'] && (
                    <View style={[styles.expandedContent, { backgroundColor: colors.backgroundCard }]}>
                        <View style={styles.distributionSection}>
                            <Text style={[styles.distributionTitle, { color: colors.textSecondary }]}>Lowest Notes:</Text>
                            {minRangeDistribution.slice(0, 10).map((item, index) => (
                                <View key={index} style={styles.distributionRow}>
                                    <Text style={[styles.distributionNote, { color: colors.textPrimary }]}>{item.note}</Text>
                                    <View style={styles.distributionBarContainer}>
                                        <View 
                                            style={[
                                                styles.distributionBar, 
                                                { 
                                                    width: `${(item.count / (minRangeDistribution[0]?.count || 1)) * 100}%`,
                                                    backgroundColor: colors.primary 
                                                }
                                            ]} 
                                        />
                                    </View>
                                    <Text style={[styles.distributionCount, { color: colors.textSecondary }]}>{item.count}</Text>
                                </View>
                            ))}
                        </View>
                        
                        <View style={[styles.distributionSection, { marginTop: 20 }]}>
                            <Text style={[styles.distributionTitle, { color: colors.textSecondary }]}>Highest Notes:</Text>
                            {maxRangeDistribution.slice(0, 10).map((item, index) => (
                                <View key={index} style={styles.distributionRow}>
                                    <Text style={[styles.distributionNote, { color: colors.textPrimary }]}>{item.note}</Text>
                                    <View style={styles.distributionBarContainer}>
                                        <View 
                                            style={[
                                                styles.distributionBar, 
                                                { 
                                                    width: `${(item.count / (maxRangeDistribution[0]?.count || 1)) * 100}%`,
                                                    backgroundColor: colors.primary 
                                                }
                                            ]} 
                                        />
                                    </View>
                                    <Text style={[styles.distributionCount, { color: colors.textSecondary }]}>{item.count}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </View>

            {/* Content Section */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📚 Content Stats</Text>
                <View style={styles.row}>
                    <MetricCard label="Total Songs" value={stats?.total_songs?.toString() || '0'} icon="🎵" colors={colors} />
                    <MetricCard label="Pending Songs" value={stats?.pending_songs?.toString() || '0'} icon="⏳" color="#f39c12" colors={colors} />
                </View>
                <View style={styles.row}>
                    <MetricCard label="Saved Lists" value={stats?.total_saved_lists?.toString() || '0'} icon="📋" colors={colors} />
                    <MetricCard label="Saved Songs" value={stats?.total_saved_songs?.toString() || '0'} icon="💾" colors={colors} />
                </View>
            </View>

            {/* Support & Economy Section */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>💰 Economy</Text>
                <View style={styles.row}>
                    <MetricCard 
                        label="Total Coins" 
                        value={stats?.total_coins_distributed?.toString() || '0'} 
                        icon="🪙" 
                        color="#f1c40f"
                        colors={colors}
                    />
                    <MetricCard 
                        label="Users w/ Coins" 
                        value={engagementMetrics?.users_with_coins?.toString() || '0'} 
                        icon="💰" 
                        color="#2ecc71"
                        colors={colors}
                    />
                </View>
                <View style={styles.row}>
                    <MetricCard 
                        label="Avg per User" 
                        value={Math.round(stats?.avg_coins_per_user || 0).toString()} 
                        icon="💵" 
                        color="#27ae60"
                        colors={colors}
                    />
                    <MetricCard 
                        label="Avg Lists/User" 
                        value={(engagementMetrics?.avg_lists_per_user || 0).toFixed(1)} 
                        icon="📋" 
                        color="#3498db"
                        colors={colors}
                    />
                </View>
            </View>

            {/* Growth Metrics (Expandable) */}
            <View style={styles.section}>
                <TouchableOpacity 
                    style={[styles.expandableHeader, { backgroundColor: colors.backgroundCard }]}
                    onPress={() => toggleSection('growth')}
                >
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                        📈 Growth Metrics
                    </Text>
                    <Text style={[styles.expandIcon, { color: colors.textPrimary }]}>
                        {expandedSections['growth'] ? '▼' : '▶'}
                    </Text>
                </TouchableOpacity>
                
                {expandedSections['growth'] && (
                    <View style={[styles.expandedContent, { backgroundColor: colors.backgroundCard }]}>
                        <View style={styles.row}>
                            <MetricCard 
                                label="Week over Week" 
                                value={`${(engagementMetrics?.week_over_week_growth || 0).toFixed(1)}%`}
                                icon="📊" 
                                color={engagementMetrics && engagementMetrics.week_over_week_growth >= 0 ? "#27ae60" : "#e74c3c"}
                                colors={colors}
                            />
                            <MetricCard 
                                label="Month over Month" 
                                value={`${(engagementMetrics?.month_over_month_growth || 0).toFixed(1)}%`}
                                icon="📈" 
                                color={engagementMetrics && engagementMetrics.month_over_month_growth >= 0 ? "#27ae60" : "#e74c3c"}
                                colors={colors}
                            />
                        </View>
                    </View>
                )}
            </View>

            {/* Most Saved Songs (Expandable) */}
            <View style={styles.section}>
                <TouchableOpacity 
                    style={[styles.expandableHeader, { backgroundColor: colors.backgroundCard }]}
                    onPress={() => toggleSection('topSongs')}
                >
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                        🎵 Most Saved Songs
                    </Text>
                    <Text style={[styles.expandIcon, { color: colors.textPrimary }]}>
                        {expandedSections['topSongs'] ? '▼' : '▶'}
                    </Text>
                </TouchableOpacity>
                
                {expandedSections['topSongs'] && (
                    <View style={[styles.expandedContent, { backgroundColor: colors.backgroundCard }]}>
                        {mostSavedSongs.slice(0, 10).map((song, index) => (
                            <View key={index} style={styles.songRow}>
                                <Text style={[styles.songRank, { color: colors.textSecondary }]}>#{index + 1}</Text>
                                <View style={styles.songInfo}>
                                    <Text style={[styles.songName, { color: colors.textPrimary }]}>{song.song_name}</Text>
                                    <Text style={[styles.songArtist, { color: colors.textSecondary }]}>{song.artist}</Text>
                                </View>
                                <Text style={[styles.songCount, { color: colors.primary }]}>{song.save_count} saves</Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {/* Support Metrics (Expandable) */}
            {supportMetrics && supportMetrics.total_issues > 0 && (
                <View style={styles.section}>
                    <TouchableOpacity 
                        style={[styles.expandableHeader, { backgroundColor: colors.backgroundCard }]}
                        onPress={() => toggleSection('support')}
                    >
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                            🐛 Support Quality
                        </Text>
                        <Text style={[styles.expandIcon, { color: colors.textPrimary }]}>
                            {expandedSections['support'] ? '▼' : '▶'}
                        </Text>
                    </TouchableOpacity>
                    
                    {expandedSections['support'] && (
                        <View style={[styles.expandedContent, { backgroundColor: colors.backgroundCard }]}>
                            <View style={styles.row}>
                                <MetricCard 
                                    label="Total Issues" 
                                    value={supportMetrics.total_issues.toString()}
                                    icon="📝" 
                                    colors={colors}
                                />
                                <MetricCard 
                                    label="Resolved" 
                                    value={supportMetrics.resolved_issues.toString()}
                                    icon="✅" 
                                    color="#27ae60"
                                    colors={colors}
                                />
                            </View>
                            <View style={styles.row}>
                                <MetricCard 
                                    label="Resolution Rate" 
                                    value={`${supportMetrics.resolution_rate.toFixed(1)}%`}
                                    icon="📊" 
                                    color="#3498db"
                                    colors={colors}
                                />
                                <MetricCard 
                                    label="Avg Time (hrs)" 
                                    value={(supportMetrics.avg_resolution_time_hours || 0).toFixed(1)}
                                    icon="⏱️" 
                                    color="#f39c12"
                                    colors={colors}
                                />
                            </View>
                        </View>
                    )}
                </View>
            )}

            {/* Key Insights */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>💡 Quick Insights</Text>
                <View style={[styles.insightCard, { backgroundColor: colors.backgroundCard }]}>
                    <Text style={[styles.insightLabel, { color: colors.textPrimary }]}>Most Common Low Note:</Text>
                    <Text style={[styles.insightValue, { color: colors.primary }]}>{userAnalytics?.most_common_min_range || 'N/A'}</Text>
                </View>
                <View style={[styles.insightCard, { backgroundColor: colors.backgroundCard }]}>
                    <Text style={[styles.insightLabel, { color: colors.textPrimary }]}>Most Common High Note:</Text>
                    <Text style={[styles.insightValue, { color: colors.primary }]}>{userAnalytics?.most_common_max_range || 'N/A'}</Text>
                </View>
                <View style={[styles.insightCard, { backgroundColor: colors.backgroundCard }]}>
                    <Text style={[styles.insightLabel, { color: colors.textPrimary }]}>Avg Vocal Range:</Text>
                    <Text style={[styles.insightValue, { color: colors.primary }]}>
                        {(engagementMetrics?.avg_vocal_range_semitones || 0).toFixed(0)} semitones
                    </Text>
                </View>
            </View>

            <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                    Last updated: {new Date().toLocaleString()}
                </Text>
            </View>
        </ScrollView>
    );
}

interface MetricCardProps {
    label: string;
    value: string;
    subtitle?: string;
    icon?: string;
    color?: string;
    colors: any;
}

function MetricCard({ label, value, subtitle, icon, color, colors }: MetricCardProps) {
    return (
        <View style={[styles.metricCard, { backgroundColor: colors.backgroundCard }]}>
            {icon && <Text style={styles.metricIcon}>{icon}</Text>}
            <Text style={[styles.metricValue, { color: color || colors.primary }]}>{value}</Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
            {subtitle && <Text style={[styles.metricSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    header: {
        marginBottom: 24,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
    },
    expandableHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    expandIcon: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    expandedContent: {
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
    },
    distributionSection: {
        marginBottom: 8,
    },
    distributionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    distributionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    distributionNote: {
        width: 50,
        fontSize: 14,
        fontWeight: '500',
    },
    distributionBarContainer: {
        flex: 1,
        height: 20,
        backgroundColor: 'rgba(128, 128, 128, 0.1)',
        borderRadius: 4,
        marginHorizontal: 8,
        overflow: 'hidden',
    },
    distributionBar: {
        height: '100%',
        borderRadius: 4,
    },
    distributionCount: {
        width: 40,
        fontSize: 12,
        textAlign: 'right',
    },
    songRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(128, 128, 128, 0.1)',
    },
    songRank: {
        width: 35,
        fontSize: 16,
        fontWeight: 'bold',
    },
    songInfo: {
        flex: 1,
        marginLeft: 8,
    },
    songName: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    songArtist: {
        fontSize: 12,
    },
    songCount: {
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    metricCard: {
        flex: 1,
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 4,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    metricIcon: {
        fontSize: 24,
        marginBottom: 8,
    },
    metricValue: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    metricLabel: {
        fontSize: 12,
        textAlign: 'center',
    },
    metricSubtitle: {
        fontSize: 10,
        marginTop: 4,
        textAlign: 'center',
    },
    insightCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    insightLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    insightValue: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
    },
    footerText: {
        fontSize: 12,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    errorText: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});
