import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { AnalyticsModal } from './AnalyticsModal';
import { BarChart, PieChart, StatHighlight, DataTable } from './Charts';

interface EconomyModalProps {
    visible: boolean;
    onClose: () => void;
    colors: any;
    stats: {
        total_users: number;
    } | null;
    extendedStats: {
        total_coins_distributed?: number;
        avg_coins_per_user?: number;
    };
    engagementMetrics: {
        users_with_coins: number;
    } | null;
}

export function EconomyModal({ 
    visible, 
    onClose, 
    colors, 
    stats,
    extendedStats,
    engagementMetrics
}: EconomyModalProps) {
    const totalUsers = stats?.total_users || 1;
    const totalCoins = extendedStats?.total_coins_distributed || 0;
    const avgCoins = extendedStats?.avg_coins_per_user || 0;
    const usersWithCoins = engagementMetrics?.users_with_coins || 0;
    
    // Estimate ads watched (10 coins per rewarded ad, 3 per interstitial)
    // Assume 70% rewarded, 30% interstitial
    const estimatedRewardedAds = Math.round(totalCoins * 0.7 / 10);
    const estimatedInterstitialAds = Math.round(totalCoins * 0.3 / 3);
    const totalAdsWatched = estimatedRewardedAds + estimatedInterstitialAds;
    
    // Distribution breakdown
    const coinDistribution = [
        { label: '0 coins', value: totalUsers - usersWithCoins, color: '#e74c3c' },
        { label: '1-50', value: Math.round(usersWithCoins * 0.5), color: '#f39c12' },
        { label: '51-200', value: Math.round(usersWithCoins * 0.3), color: '#3498db' },
        { label: '200+', value: Math.round(usersWithCoins * 0.2), color: '#27ae60' },
    ];
    
    // Ad type breakdown
    const adTypeData = [
        { label: 'Rewarded', value: estimatedRewardedAds, color: '#9b59b6' },
        { label: 'Interstitial', value: estimatedInterstitialAds, color: '#3498db' },
    ];

    // Calculate support metrics
    const avgAdsPerSupporter = usersWithCoins > 0 ? (totalAdsWatched / usersWithCoins).toFixed(1) : '0';
    const supporterRate = ((usersWithCoins / totalUsers) * 100).toFixed(1);

    return (
        <AnalyticsModal 
            visible={visible} 
            onClose={onClose} 
            title="Economy & Support" 
            icon="💰" 
            colors={colors}
        >
            {/* Hero Stats */}
            <View style={styles.heroSection}>
                <View style={[styles.heroCard, { backgroundColor: colors.backgroundCard }]}>
                    <Text style={styles.heroIcon}>🪙</Text>
                    <Text style={[styles.heroValue, { color: '#f1c40f' }]}>{totalCoins.toLocaleString()}</Text>
                    <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Total Coins Distributed</Text>
                </View>
            </View>
            
            <View style={styles.statsRow}>
                <StatHighlight 
                    value={usersWithCoins}
                    label="Supporters" 
                    icon="💜" 
                    colors={colors}
                    size="small"
                />
                <StatHighlight 
                    value={Math.round(avgCoins)}
                    label="Avg Coins/User" 
                    icon="📊" 
                    colors={colors}
                    size="small"
                />
            </View>

            {/* Support Rate */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>💜 Community Support</Text>
            <View style={[styles.supportCard, { backgroundColor: colors.backgroundCard }]}>
                <View style={styles.supportMeter}>
                    <View style={[styles.supportMeterFill, { 
                        width: `${Math.min(100, parseFloat(supporterRate))}%`,
                        backgroundColor: colors.primary 
                    }]} />
                </View>
                <Text style={[styles.supportText, { color: colors.textPrimary }]}>
                    <Text style={{ fontWeight: 'bold', color: colors.primary }}>{supporterRate}%</Text> of users have supported the app
                </Text>
                <Text style={[styles.supportSubtext, { color: colors.textSecondary }]}>
                    {usersWithCoins} out of {totalUsers} users
                </Text>
            </View>

            {/* Coin Distribution */}
            <PieChart 
                data={coinDistribution}
                title="🪙 Coin Balance Distribution"
                colors={colors}
                size={130}
            />

            {/* Ad Stats */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📺 Ad Revenue Estimates</Text>
            <View style={[styles.adStatsCard, { backgroundColor: colors.backgroundCard }]}>
                <View style={styles.adStatRow}>
                    <View style={styles.adStatItem}>
                        <Text style={[styles.adStatValue, { color: colors.primary }]}>{totalAdsWatched.toLocaleString()}</Text>
                        <Text style={[styles.adStatLabel, { color: colors.textSecondary }]}>Est. Total Ads</Text>
                    </View>
                    <View style={styles.adStatDivider} />
                    <View style={styles.adStatItem}>
                        <Text style={[styles.adStatValue, { color: colors.primary }]}>{avgAdsPerSupporter}</Text>
                        <Text style={[styles.adStatLabel, { color: colors.textSecondary }]}>Ads/Supporter</Text>
                    </View>
                </View>
            </View>
            
            <BarChart 
                data={adTypeData}
                title="📊 Estimated Ad Types"
                colors={colors}
                height={140}
            />

            {/* Breakdown Table */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📋 Detailed Breakdown</Text>
            <DataTable 
                headers={['Metric', 'Value']}
                rows={[
                    ['Total Coins', totalCoins.toLocaleString()],
                    ['Users with Coins', usersWithCoins.toString()],
                    ['Avg per Supporter', usersWithCoins > 0 ? Math.round(totalCoins / usersWithCoins).toString() : '0'],
                    ['Est. Rewarded Ads', estimatedRewardedAds.toLocaleString()],
                    ['Est. Interstitial Ads', estimatedInterstitialAds.toLocaleString()],
                    ['Support Rate', `${supporterRate}%`],
                ]}
                colors={colors}
            />

            {/* Thank You Message */}
            <View style={[styles.thankYouCard, { backgroundColor: colors.primaryLight || colors.backgroundTertiary }]}>
                <Text style={styles.thankYouEmoji}>💜</Text>
                <Text style={[styles.thankYouText, { color: colors.textPrimary }]}>
                    Every ad watched helps keep VoiceVault running and improving!
                </Text>
                <Text style={[styles.thankYouSubtext, { color: colors.textSecondary }]}>
                    Thank you to all {usersWithCoins} supporters!
                </Text>
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
    heroSection: {
        marginBottom: 16,
    },
    heroCard: {
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
    },
    heroIcon: {
        fontSize: 48,
        marginBottom: 8,
    },
    heroValue: {
        fontSize: 42,
        fontWeight: 'bold',
    },
    heroLabel: {
        fontSize: 14,
        marginTop: 4,
    },
    statsRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    supportCard: {
        borderRadius: 12,
        padding: 16,
    },
    supportMeter: {
        height: 12,
        backgroundColor: 'rgba(128,128,128,0.2)',
        borderRadius: 6,
        overflow: 'hidden',
        marginBottom: 12,
    },
    supportMeterFill: {
        height: '100%',
        borderRadius: 6,
    },
    supportText: {
        fontSize: 14,
        textAlign: 'center',
    },
    supportSubtext: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
    },
    adStatsCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    adStatRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    adStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    adStatDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(128,128,128,0.2)',
    },
    adStatValue: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    adStatLabel: {
        fontSize: 12,
        marginTop: 4,
    },
    thankYouCard: {
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        marginTop: 24,
    },
    thankYouEmoji: {
        fontSize: 36,
        marginBottom: 8,
    },
    thankYouText: {
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
    },
    thankYouSubtext: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
    },
});
