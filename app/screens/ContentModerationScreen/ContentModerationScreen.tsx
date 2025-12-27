import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    RefreshControl,
    Alert,
    FlatList,
} from 'react-native';
import { supabase } from '../../util/supabase';
import { useAdminStatus } from '../../util/adminUtils';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface PendingSong {
    id: number;
    name: string;
    artist: string;
    vocal_range: string;
    username: string;
    user_id: string;
    created_at: string;
    status: string;
}

interface Issue {
    id: number;
    user_id: string;
    subject: string;
    description: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export default function ContentModerationScreen({ navigation }: any) {
    const { isAdmin, loading: adminLoading } = useAdminStatus();
    const { colors } = useTheme();
    const [pendingSongs, setPendingSongs] = useState<PendingSong[]>([]);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'songs' | 'issues'>('songs');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!adminLoading && isAdmin) {
            fetchAllData();
        } else if (!adminLoading && !isAdmin) {
            // Redirect non-admins
            navigation.replace('Search');
        }
    }, [adminLoading, isAdmin]);

    const fetchAllData = async () => {
        try {
            setError(null);
            setLoading(true);
            
            // Fetch pending songs
            const { data: songsData, error: songsError } = await supabase
                .from('pending_songs')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (songsError) throw songsError;
            setPendingSongs(songsData || []);

            // Fetch open issues
            const { data: issuesData, error: issuesError } = await supabase
                .from('issues')
                .select('*')
                .eq('status', 'open')
                .order('created_at', { ascending: false });

            if (issuesError) throw issuesError;
            setIssues(issuesData || []);

        } catch (err: any) {
            console.error('Error fetching moderation data:', err);
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchAllData();
        setRefreshing(false);
    };

    const handleApproveSong = async (songId: number) => {
        Alert.alert(
            'Approve Song',
            'Are you sure you want to approve this song?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.rpc('admin_approve_pending_song', {
                                p_pending_song_id: songId
                            });

                            if (error) throw error;

                            Alert.alert('Success', 'Song approved successfully!');
                            fetchAllData();
                        } catch (err: any) {
                            console.error('Error approving song:', err);
                            Alert.alert('Error', err.message || 'Failed to approve song');
                        }
                    },
                },
            ]
        );
    };

    const handleRejectSong = async (songId: number) => {
        Alert.alert(
            'Reject Song',
            'Are you sure you want to reject this song? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.rpc('admin_reject_pending_song', {
                                p_pending_song_id: songId
                            });

                            if (error) throw error;

                            Alert.alert('Success', 'Song rejected successfully!');
                            fetchAllData();
                        } catch (err: any) {
                            console.error('Error rejecting song:', err);
                            Alert.alert('Error', err.message || 'Failed to reject song');
                        }
                    },
                },
            ]
        );
    };

    const handleResolveIssue = async (issueId: number) => {
        Alert.alert(
            'Resolve Issue',
            'Mark this issue as resolved?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Resolve',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.rpc('admin_resolve_issue', {
                                p_issue_id: issueId
                            });

                            if (error) throw error;

                            Alert.alert('Success', 'Issue marked as resolved!');
                            fetchAllData();
                        } catch (err: any) {
                            console.error('Error resolving issue:', err);
                            Alert.alert('Error', err.message || 'Failed to resolve issue');
                        }
                    },
                },
            ]
        );
    };

    const renderPendingSong = ({ item }: { item: PendingSong }) => (
        <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
            <View style={styles.cardHeader}>
                <View style={styles.songInfo}>
                    <Text style={[styles.songTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                    <Text style={[styles.songArtist, { color: colors.textSecondary }]}>{item.artist}</Text>
                    <Text style={[styles.songRange, { color: colors.textSecondary }]}>
                        Range: {item.vocal_range}
                    </Text>
                    <Text style={[styles.submittedBy, { color: colors.textSecondary }]}>
                        By: {item.username} • {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                </View>
            </View>
            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={[styles.approveButton, { backgroundColor: '#27ae60' }]}
                    onPress={() => handleApproveSong(item.id)}
                >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.rejectButton, { backgroundColor: '#e74c3c' }]}
                    onPress={() => handleRejectSong(item.id)}
                >
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Reject</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderIssue = ({ item }: { item: Issue }) => (
        <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
            <View style={styles.cardHeader}>
                <View style={styles.issueInfo}>
                    <Text style={[styles.issueSubject, { color: colors.textPrimary }]}>{item.subject}</Text>
                    <Text style={[styles.issueDescription, { color: colors.textSecondary }]} numberOfLines={3}>
                        {item.description}
                    </Text>
                    <Text style={[styles.issueDate, { color: colors.textSecondary }]}>
                        {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                </View>
            </View>
            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={[styles.resolveButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleResolveIssue(item.id)}
                >
                    <Ionicons name="checkmark-done" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Resolve</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (adminLoading || loading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Tab Selector */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'songs' && styles.activeTab,
                        activeTab === 'songs' && { borderBottomColor: colors.primary },
                    ]}
                    onPress={() => setActiveTab('songs')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'songs' ? colors.primary : colors.textSecondary },
                        ]}
                    >
                        Pending Songs ({pendingSongs.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'issues' && styles.activeTab,
                        activeTab === 'issues' && { borderBottomColor: colors.primary },
                    ]}
                    onPress={() => setActiveTab('issues')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'issues' ? colors.primary : colors.textSecondary },
                        ]}
                    >
                        Open Issues ({issues.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {error && (
                <View style={[styles.errorContainer, { backgroundColor: '#e74c3c20' }]}>
                    <Text style={[styles.errorText, { color: '#e74c3c' }]}>{error}</Text>
                </View>
            )}

            {/* Content Area */}
            {activeTab === 'songs' ? (
                <FlatList
                    data={pendingSongs}
                    renderItem={renderPendingSong}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="musical-notes" size={64} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No pending songs to review
                            </Text>
                        </View>
                    }
                />
            ) : (
                <FlatList
                    data={issues}
                    renderItem={renderIssue}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="help-circle" size={64} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No open issues
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
    },
    tabContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 3,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
    },
    errorContainer: {
        padding: 12,
        margin: 16,
        borderRadius: 8,
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
    },
    listContainer: {
        padding: 16,
    },
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        marginBottom: 12,
    },
    songInfo: {
        gap: 4,
    },
    songTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    songArtist: {
        fontSize: 16,
    },
    songRange: {
        fontSize: 14,
        marginTop: 4,
    },
    submittedBy: {
        fontSize: 12,
        marginTop: 8,
        fontStyle: 'italic',
    },
    issueInfo: {
        gap: 6,
    },
    issueSubject: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    issueDescription: {
        fontSize: 14,
        lineHeight: 20,
    },
    issueDate: {
        fontSize: 12,
        marginTop: 4,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    approveButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 6,
    },
    rejectButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 6,
    },
    resolveButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 6,
    },
    buttonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
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
    },
});
