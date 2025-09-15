import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../util/supabase';

export default function AdminQuickStats() {
    const [loading, setLoading] = useState(true);
    const [totalUsers, setTotalUsers] = useState<number | null>(null);
    const [newToday, setNewToday] = useState<number | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            // Prefer server-side RPC which can bypass RLS for admins
            try {
                const { data: rpcData, error: rpcError } = await supabase.rpc('admin_get_stats');
                if (!rpcError && rpcData) {
                    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
                    setTotalUsers(row?.total_users ?? null);
                    setNewToday(row?.new_today ?? null);
                    setLoading(false);
                    return;
                }
                console.log('admin_get_stats RPC not available or denied', rpcError);
                if (rpcError && !errorMsg) setErrorMsg(rpcError.message || JSON.stringify(rpcError));
            } catch (rpcEx) {
                console.log('admin_get_stats RPC failed', rpcEx);
                if (!errorMsg) setErrorMsg(String(rpcEx));
            }

            // Fallback: Total users from the auth.users table (may be blocked by RLS)
            const { count, error } = await supabase
                .from('auth.users')
                .select('id', { count: 'exact', head: true });

            if (error) {
                console.warn('Failed to fetch total users from auth.users:', error);
                setTotalUsers(null);
                if (!errorMsg) setErrorMsg(error.message || JSON.stringify(error));
            } else {
                setTotalUsers(count ?? null);
            }

            // Also fetch new users today from auth.users.created_at
            try {
                const today = new Date().toISOString().split('T')[0];
                const { count: todayCount, error: todayError } = await supabase
                    .from('auth.users')
                    .select('id', { count: 'exact', head: true })
                    .gte('created_at', `${today}T00:00:00.000Z`)
                    .lt('created_at', `${today}T23:59:59.999Z`);
                if (!todayError) setNewToday(todayCount ?? 0);
                else if (!errorMsg) setErrorMsg(todayError.message || JSON.stringify(todayError));
            } catch (e) {
                // ignore
            }

            // If newToday is still null, try calling a debug RPC (will help diagnose RLS / schema issues)
            if (newToday === null) {
                try {
                    const { data: dbg, error: dbgErr } = await supabase.rpc('admin_get_stats_debug');
                    if (!dbgErr && dbg) {
                        // attach debug info to errorMsg so it appears in logs and UI
                        const row = Array.isArray(dbg) ? dbg[0] : dbg;
                        if (!errorMsg) setErrorMsg(`RPC debug: is_admin=${row?.is_admin} caller=${row?.caller} total_users=${row?.total_users} new_today=${row?.new_today}`);
                    } else if (dbgErr) {
                        if (!errorMsg) setErrorMsg(dbgErr.message || JSON.stringify(dbgErr));
                    }
                } catch (_) {
                    // ignore
                }
            }
        } catch (e) {
            console.error('Error fetching admin quick stats', e);
            setTotalUsers(null);
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
                    <Text style={styles.number}>{'—'}</Text>
                    <Text style={styles.label}>Active Users</Text>
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
    footer: {
        marginTop: 10,
        alignItems: 'center',
    },
    errorText: {
        color: '#c0392b',
        fontSize: 12,
        marginBottom: 6,
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
