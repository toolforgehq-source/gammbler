import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { leaderboardsAPI } from '../../src/lib/api';
import { colors, fonts } from '../../src/lib/theme';

interface Entry {
  rank: number | null;
  user_id: string;
  username: string;
  score: string;
  win_rate: string | null;
  roi: string | null;
  is_self: boolean;
}

const SPORTS = ['overall', 'nfl', 'nba', 'mlb', 'nhl', 'cfb', 'cbb', 'soccer'];

export default function LeaderboardsScreen() {
  const [sport, setSport] = useState('overall');
  const [tab, setTab] = useState<'friends' | 'national'>('friends');
  const [data, setData] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = tab === 'friends'
        ? await leaderboardsAPI.friends(sport)
        : await leaderboardsAPI.national(sport);
      setData(res.data.leaderboard || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [sport, tab]);

  useEffect(() => { fetch(); }, [fetch]);

  const renderRow = ({ item, index }: { item: Entry; index: number }) => (
    <View style={{
      flexDirection: 'row', alignItems: 'center', padding: 14,
      backgroundColor: item.is_self ? colors.accent + '15' : 'transparent',
      borderBottomWidth: 1, borderBottomColor: colors.border,
    }}>
      <Text style={{
        fontFamily: fonts.number, fontSize: 16, width: 36,
        color: (item.rank || 0) <= 3 ? colors.gold : colors.muted,
      }}>
        {item.rank || '—'}
      </Text>
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: colors.accent + '30', justifyContent: 'center', alignItems: 'center', marginRight: 10,
      }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent }}>
          {item.username.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 14, color: item.is_self ? colors.accent : colors.foreground }}>
          {item.username}{item.is_self ? ' (You)' : ''}
        </Text>
      </View>
      <Text style={{ fontFamily: fonts.number, fontSize: 18, color: colors.accent }}>
        {parseFloat(item.score).toFixed(1)}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.foreground, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
          Leaderboards
        </Text>

        {/* Sport pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {SPORTS.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSport(s)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginRight: 8,
                backgroundColor: sport === s ? colors.accent : colors.card,
                borderWidth: sport === s ? 0 : 1, borderColor: colors.border,
              }}
            >
              <Text style={{
                fontFamily: fonts.display, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
                color: sport === s ? colors.background : colors.muted,
              }}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Friends / National */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setTab('friends')}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
              backgroundColor: tab === 'friends' ? colors.accent : colors.card,
              borderWidth: tab === 'friends' ? 0 : 1, borderColor: colors.border,
            }}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 12, color: tab === 'friends' ? colors.background : colors.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
              Friends
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab('national')}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
              backgroundColor: tab === 'national' ? colors.accent : colors.card,
              borderWidth: tab === 'national' ? 0 : 1, borderColor: colors.border,
            }}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 12, color: tab === 'national' ? colors.background : colors.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
              National
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderRow}
          keyExtractor={(item, i) => `${item.user_id}-${i}`}
          style={{ backgroundColor: colors.card, marginHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.body, color: colors.mutedDark, fontSize: 13 }}>
                No rankings available yet.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
