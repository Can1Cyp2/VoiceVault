import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../util/supabase';

export default function AdminQuickStats() {
    const [loading, setLoading] = useState(true);
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [activeUsers, setActiveUsers] = useState<number | null>(null);
    const [newToday, setNewToday] = useState<number | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        setErrorMsg(null); // Clear previous errors
        try {
            // Call the secure RPC function
            const { data: rpcData, error: rpcError } = await supabase.rpc('admin_get_stats');
            
            if (rpcError) {
                console.error('admin_get_stats error:', rpcError);
                setErrorMsg(rpcError.message || 'Failed to fetch admin stats');
                setLoading(false);
                return;
            }

            if (rpcData) {
                // Handle both single object and array response
                const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
                setTotalUsers(row?.total_users ?? null);
                setActiveUsers(row?.active_users ?? null);
                setNewToday(row?.new_today ?? null);
            }
        } catch (error) {
            console.error('Error fetching admin quick stats:', error);
            setErrorMsg('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.row}>
                <View style={styles.card}>
                    <ActivityIndicator color="#ff4757" />
                    <Text style={styles.label}>Total Users</Text>
                </View>
                <View style={styles.card}>
                    <ActivityIndicator color="#ff4757" />
                    <Text style={styles.label}>Active Users</Text>
                </View>
                <View style={styles.card}>
                    <ActivityIndicator color="#ff4757" />
                    <Text style={styles.label}>New Today</Text>
                </View>
            </View>
        );
    }

    return (
        <>
            <View style={styles.row}>
                <View style={styles.card}>
                    <Text style={styles.number}>{totalUsers ?? '—'}</Text>
                    <Text style={styles.label}>Total Users</Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.number}>{activeUsers ?? '—'}</Text>
                    <Text style={styles.label}>Active Users</Text>
                    <Text style={styles.sublabel}>(Last 7 days)</Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.number}>{newToday ?? '—'}</Text>
                    <Text style={styles.label}>New Today</Text>
                </View>
            </View>
            <AdminQuickStatsFooter errorMsg={errorMsg} onRetry={fetchStats} />
        </>
    );
}

// Show error message and retry below the stats
export function AdminQuickStatsFooter({ errorMsg, onRetry }: { errorMsg: string | null; onRetry: () => void }) {
    if (!errorMsg) return null;
    return (
        <View style={styles.footer}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
                <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    card: {
        flex: 1,
        backgroundColor: 'white',
        padding: 20,
        marginHorizontal: 5,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    number: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ff4757',
        marginBottom: 5,
    },
    label: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    sublabel: {
        fontSize: 10,
        color: '#999',
        marginTop: 2,
        textAlign: 'center',
    },
    footer: {
        marginTop: 10,
        alignItems: 'center',
    },
    errorText: {
        color: '#c0392b',
        fontSize: 12,
        marginBottom: 6,
        textAlign: 'center',
    },
    retryBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#ff4757',
        borderRadius: 8,
    },
    retryText: {
        color: 'white',
        fontWeight: '600',
    },
});