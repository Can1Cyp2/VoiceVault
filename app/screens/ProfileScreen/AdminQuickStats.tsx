import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../util/supabase';

/**
 * AdminQuickStats Component
 * 
 * SECURITY: This component uses RLS-protected RPC functions to fetch admin stats.
 * Only users in the 'admins' table with status='active' can access this data.
 * The RPC function 'admin_get_stats' validates admin status server-side.
 * 
 * Even if an attacker modifies this client code, they cannot bypass RLS.
 */

interface AdminStats {
    total_users: number;
    new_today: number;
    total_songs: number;
    pending_songs: number;
    total_issues: number;
    open_issues: number;
}

export default function AdminQuickStats() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        setErrorMsg(null);
        
        try {
            // Use the secure admin_get_stats RPC function
            // This function checks admin status server-side via is_admin()
            const { data, error } = await supabase.rpc('admin_get_stats');
            
            if (error) {
                console.error('Error fetching admin stats:', error);
                setErrorMsg(error.message || 'Failed to load stats');
                setStats(null);
                return;
            }
            
            if (data && data.length > 0) {
                setStats(data[0]);
            } else {
                setErrorMsg('No stats data returned');
            }
        } catch (error) {
            console.error('Unexpected error fetching stats:', error);
            setErrorMsg('An unexpected error occurred');
            setStats(null);
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
                    <Text style={styles.label}>Total Songs</Text>
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
                    <Text style={styles.number}>{stats?.total_users ?? '—'}</Text>
                    <Text style={styles.label}>Total Users</Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.number}>{stats?.total_songs ?? '—'}</Text>
                    <Text style={styles.label}>Total Songs</Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.number}>{stats?.new_today ?? '—'}</Text>
                    <Text style={styles.label}>New Today</Text>
                </View>
            </View>
            {errorMsg && (
                <View style={styles.footer}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={fetchStats}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    card: {
        flex: 1,
        backgroundColor: 'white',
        padding: 16,
        marginHorizontal: 4,
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
        textAlign: 'center',
        paddingHorizontal: 20,
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
