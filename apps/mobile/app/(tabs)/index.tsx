import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/lib/auth';
import { scoresAPI, betsAPI } from '../../src/lib/api';
import { colors, fonts } from '../../src/lib/theme';

interface Score {
  sport: string;
  score: string;
  is_unlocked: boolean;
  settled_bet_count: number;
}

interface Stats {
  record: { wins: number; losses: number; pushes: number };
  roi: number;
  total_profit_loss: number;
  current_streak: { count: number; type: string };
}

const SPORT_ICONS: Record<string, string> = {
  nfl: '🏈', nba: '🏀', mlb: '⚾', nhl: '🏒', cfb: '🏟️', cbb: '🏀', soccer: '⚽', prizepicks: '🎯', dfs: '🏆',
};

function getScoreColor(score: number): string {
  if (score <= 40) return colors.loss;
  if (score <= 60) return colors.gold;
  if (score <= 75) return colors.accentLight;
  if (score <= 90) return colors.accent;
  return colors.gold;
}

function getTierName(score: number): string {
  if (score <= 40) return 'Recreational';
  if (score <= 60) return 'Developing';
  if (score <= 75) return 'Sharp';
  if (score <= 90) return 'Elite';
  return 'Legend';
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const [scores, setScores] = useState<Score[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      scoresAPI.getAll().catch(() => ({ data: { scores: [] } })),
      betsAPI.stats().catch(() => ({ data: null })),
    ]).then(([scoresRes, statsRes]) => {
      setScores(scoresRes.data.scores || []);
      setStats(statsRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const overallScore = scores.find((s) => s.sport === 'overall');
  const sportScores = scores.filter((s) => s.sport !== 'overall');
  const scoreVal = overallScore ? parseFloat(overallScore.score) : 0;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Header */}
        <Text style={{ fontFamily: fonts.display, fontSize: 12, color: colors.mutedDark, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
          Welcome back
        </Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.foreground, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 24 }}>
          {user?.username || 'Player'}
        </Text>

        {/* Main Score Card */}
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 12, color: colors.mutedDark, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
            Gammbler Score
          </Text>
          {overallScore?.is_unlocked ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontFamily: fonts.number, fontSize: 64, color: getScoreColor(scoreVal) }}>
                  {scoreVal.toFixed(1)}
                </Text>
                <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 13, color: getScoreColor(scoreVal) }}>
                  {getTierName(scoreVal)}
                </Text>
              </View>
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                borderWidth: 3, borderColor: getScoreColor(scoreVal) + '40',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ fontFamily: fonts.number, fontSize: 28, color: getScoreColor(scoreVal) }}>
                  {scoreVal.toFixed(0)}
                </Text>
              </View>
            </View>
          ) : (
            <View>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: colors.mutedDark }}>
                Not enough data yet
              </Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.mutedDark, marginTop: 4 }}>
                {overallScore?.settled_bet_count || 0}/10 bets needed
              </Text>
              <View style={{ height: 6, backgroundColor: colors.background, borderRadius: 3, marginTop: 8 }}>
                <View style={{
                  height: 6, backgroundColor: colors.accent, borderRadius: 3,
                  width: `${((overallScore?.settled_bet_count || 0) / 10) * 100}%` as any,
                }} />
              </View>
            </View>
          )}
        </View>

        {/* Sport Score Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {sportScores.map((s) => {
            const val = parseFloat(s.score);
            return (
              <View key={s.sport} style={{
                backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
                borderRadius: 10, padding: 14, marginRight: 10, minWidth: 110,
                opacity: s.is_unlocked ? 1 : 0.5,
              }}>
                <Text style={{ fontSize: 16, marginBottom: 4 }}>{SPORT_ICONS[s.sport] || '🎲'}</Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 10, color: colors.mutedDark, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {s.sport.toUpperCase()}
                </Text>
                {s.is_unlocked ? (
                  <Text style={{ fontFamily: fonts.number, fontSize: 22, color: getScoreColor(val), marginTop: 4 }}>
                    {val.toFixed(1)}
                  </Text>
                ) : (
                  <Text style={{ fontFamily: fonts.body, fontSize: 10, color: colors.mutedDark, marginTop: 4 }}>
                    {s.settled_bet_count}/10
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Quick Stats */}
        {stats && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            <View style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 10, color: colors.mutedDark, textTransform: 'uppercase', letterSpacing: 1 }}>Record</Text>
              <Text style={{ fontFamily: fonts.number, fontSize: 20, color: colors.foreground, marginTop: 4 }}>
                {stats.record.wins}-{stats.record.losses}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 10, color: colors.mutedDark, textTransform: 'uppercase', letterSpacing: 1 }}>ROI</Text>
              <Text style={{ fontFamily: fonts.number, fontSize: 20, color: stats.roi >= 0 ? colors.win : colors.loss, marginTop: 4 }}>
                {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 10, color: colors.mutedDark, textTransform: 'uppercase', letterSpacing: 1 }}>Streak</Text>
              <Text style={{ fontFamily: fonts.number, fontSize: 20, color: stats.current_streak.type === 'win' ? colors.win : colors.loss, marginTop: 4 }}>
                {stats.current_streak.count}{stats.current_streak.type === 'win' ? 'W' : 'L'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
