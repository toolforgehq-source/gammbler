import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { feedAPI } from '../../src/lib/api';
import { colors, fonts } from '../../src/lib/theme';

interface FeedItem {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  event_type: string;
  sport: string | null;
  created_at: string;
  display_text: string;
}

const EVENT_EMOJIS: Record<string, string> = {
  parlay_hit: '🔥', rank_up: '📈', win_streak: '⚡', badge_earned: '🏆',
  score_high: '📊', sportsbook_connected: '🔗', weekly_leader: '👑',
};

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function FeedScreen() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await feedAPI.get({ limit: '30', offset: '0' });
      setFeed(res.data.feed || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  const renderItem = ({ item }: { item: FeedItem }) => (
    <View style={{
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', gap: 12,
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.accent + '30', justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent }}>
          {item.username.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.foreground, lineHeight: 18 }}>
          <Text style={{ fontFamily: fonts.bodySemiBold, color: colors.accent }}>{item.username}</Text>
          {' '}{item.display_text.replace(item.username, '').trim()}{' '}
          {EVENT_EMOJIS[item.event_type] || '⚡'}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.mutedDark, marginTop: 4 }}>
          {timeAgo(item.created_at)}
          {item.sport ? ` • ${item.sport.toUpperCase()}` : ''}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 20, paddingBottom: 8 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.foreground, textTransform: 'uppercase', letterSpacing: 2 }}>
          Community
        </Text>
      </View>
      <FlatList
        data={feed}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingTop: 8 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>⚡</Text>
            <Text style={{ fontFamily: fonts.bodySemiBold, color: colors.mutedDark, fontSize: 14 }}>
              Your feed is empty
            </Text>
            <Text style={{ fontFamily: fonts.body, color: colors.mutedDark, fontSize: 12, marginTop: 4 }}>
              Follow bettors to see their activity.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
