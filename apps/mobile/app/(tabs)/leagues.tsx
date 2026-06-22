import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { leaguesAPI } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { colors, fonts } from '../../src/lib/theme';

interface LeagueItem {
  id: string;
  name: string;
  sport: string;
  status: string;
  season_name: string;
  member_count: number;
  my_role: string;
  my_score: string;
  invite_code: string;
  min_bets_per_week: number;
  season_start: string;
  season_end: string;
}

interface Standing {
  rank: number;
  user_id: string;
  username: string;
  season_score: string;
  active_weeks: number;
  total_weeks: number;
  total_bets_in_league: number;
  best_week_score: string;
  is_self: boolean;
  is_commissioner: boolean;
}

const SPORT_LABELS: Record<string, string> = {
  all: 'All Sports', nfl: 'NFL', nba: 'NBA', mlb: 'MLB',
  nhl: 'NHL', cfb: 'CFB', cbb: 'CBB', soccer: 'Soccer', mma: 'MMA',
};

export default function LeaguesScreen() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<LeagueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const isFree = user?.tier === 'free' || (!user?.tier && user?.subscription_status !== 'active');

  const fetchLeagues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await leaguesAPI.list();
      setLeagues(res.data.leagues || []);
    } catch {
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStandings = useCallback(async (id: string) => {
    setStandingsLoading(true);
    try {
      const res = await leaguesAPI.get(id);
      setStandings(res.data.standings || []);
    } catch {
      setStandings([]);
    } finally {
      setStandingsLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeagues(); }, [fetchLeagues]);

  useEffect(() => {
    if (selectedLeague) fetchStandings(selectedLeague);
  }, [selectedLeague, fetchStandings]);

  const handleJoin = async () => {
    if (!joinCode) return;
    setJoinLoading(true);
    try {
      await leaguesAPI.join(joinCode);
      setShowJoin(false);
      setJoinCode('');
      fetchLeagues();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to join league');
    } finally {
      setJoinLoading(false);
    }
  };

  // Detail view
  if (selectedLeague) {
    const league = leagues.find((l) => l.id === selectedLeague);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: 20, paddingBottom: 0 }}>
          <TouchableOpacity onPress={() => setSelectedLeague(null)} style={{ marginBottom: 12 }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.foreground, textTransform: 'uppercase', letterSpacing: 1 }}>
            {league?.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.accent + '30' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 10, color: colors.accent, textTransform: 'uppercase' }}>
                {SPORT_LABELS[league?.sport || 'all']}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>
              {league?.member_count} members
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>
              Code: {league?.invite_code}
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1, padding: 20 }}>
          {/* Standings header */}
          <View style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 10, color: colors.mutedDark, width: 36, textTransform: 'uppercase' }}>#</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 10, color: colors.mutedDark, flex: 1, textTransform: 'uppercase' }}>Player</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 10, color: colors.mutedDark, width: 60, textAlign: 'right', textTransform: 'uppercase' }}>Score</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 10, color: colors.mutedDark, width: 50, textAlign: 'right', textTransform: 'uppercase' }}>Bets</Text>
          </View>

          {standingsLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
          ) : standings.length === 0 ? (
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.mutedDark, textAlign: 'center', marginTop: 40 }}>
              No standings yet
            </Text>
          ) : (
            standings.map((member) => (
              <View key={member.user_id} style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
                borderBottomWidth: 1, borderBottomColor: colors.border,
                backgroundColor: member.is_self ? colors.accent + '10' : 'transparent',
                paddingHorizontal: 4, borderRadius: 8,
              }}>
                <Text style={{
                  fontFamily: fonts.number, fontSize: 16, width: 36,
                  color: member.rank <= 3 ? colors.gold : colors.muted,
                }}>
                  {member.rank}
                </Text>
                <View style={{
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: colors.accent + '30', justifyContent: 'center', alignItems: 'center', marginRight: 10,
                }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.accent }}>
                    {member.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 13, color: member.is_self ? colors.accent : colors.foreground }}>
                    {member.username}{member.is_self ? ' (You)' : ''}
                  </Text>
                  {member.is_commissioner && (
                    <Text style={{ fontFamily: fonts.body, fontSize: 10, color: colors.gold }}>Commissioner</Text>
                  )}
                </View>
                <Text style={{ fontFamily: fonts.number, fontSize: 18, color: colors.accent, width: 60, textAlign: 'right' }}>
                  {parseFloat(member.season_score).toFixed(1)}
                </Text>
                <Text style={{ fontFamily: fonts.number, fontSize: 13, color: colors.muted, width: 50, textAlign: 'right' }}>
                  {member.total_bets_in_league}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.foreground, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
          Leagues
        </Text>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => setShowJoin(true)}
            style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 12, color: colors.foreground, textTransform: 'uppercase', letterSpacing: 1 }}>
              Join League
            </Text>
          </TouchableOpacity>
          {!isFree && (
            <TouchableOpacity
              onPress={() => Alert.alert('Coming Soon', 'League creation is available on the web dashboard.')}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: fonts.display, fontSize: 12, color: colors.background, textTransform: 'uppercase', letterSpacing: 1 }}>
                Create League
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Join Modal */}
      <Modal visible={showJoin} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.foreground, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Join a League
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginBottom: 16 }}>
              Enter the invite code from your league commissioner.
            </Text>
            <TextInput
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              placeholder="ENTER CODE"
              placeholderTextColor={colors.mutedDark}
              maxLength={8}
              style={{
                backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border,
                borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14,
                fontFamily: fonts.number, fontSize: 18, color: colors.foreground,
                textAlign: 'center', letterSpacing: 4, marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setShowJoin(false); setJoinCode(''); }}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: colors.secondary, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleJoin}
                disabled={joinLoading}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', opacity: joinLoading ? 0.5 : 1 }}
              >
                <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.background }}>
                  {joinLoading ? 'Joining...' : 'Join'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Leagues list */}
      <ScrollView style={{ flex: 1, padding: 20 }}>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : leagues.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>⚔️</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.foreground, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              No Leagues Yet
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.mutedDark, textAlign: 'center', maxWidth: 280 }}>
              Join a league with a code or create one on the web to compete with friends all season.
            </Text>
          </View>
        ) : (
          leagues.map((league) => (
            <TouchableOpacity
              key={league.id}
              onPress={() => setSelectedLeague(league.id)}
              style={{
                backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12,
                borderWidth: 1, borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 15, color: colors.foreground, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {league.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: colors.accent + '30' }}>
                      <Text style={{ fontFamily: fonts.display, fontSize: 9, color: colors.accent, textTransform: 'uppercase' }}>
                        {SPORT_LABELS[league.sport]}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.muted }}>
                      {league.member_count} members
                    </Text>
                    {league.my_role === 'commissioner' && (
                      <Text style={{ fontFamily: fonts.body, fontSize: 10, color: colors.gold }}>Commissioner</Text>
                    )}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 9, color: colors.mutedDark, textTransform: 'uppercase' }}>My Score</Text>
                  <Text style={{ fontFamily: fonts.number, fontSize: 24, color: colors.accent }}>
                    {parseFloat(league.my_score || '0').toFixed(1)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
