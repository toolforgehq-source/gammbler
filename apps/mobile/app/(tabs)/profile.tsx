import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { profileAPI, badgesAPI } from '../../src/lib/api';
import { colors, fonts } from '../../src/lib/theme';

interface Profile {
  username: string;
  scores: Array<{ sport: string; score: string; is_unlocked: boolean; settled_bet_count: number }>;
  badges: Array<{ badge_type: string; earned_at: string }>;
  record: { wins: number; losses: number; pushes: number };
  roi: number;
  followers: number;
  following: number;
}

interface BadgeInfo {
  badge_type: string;
  name: string;
  icon: string;
  earned: boolean;
}

function getScoreColor(score: number): string {
  if (score <= 40) return colors.loss;
  if (score <= 60) return colors.gold;
  if (score <= 75) return colors.accentLight;
  if (score <= 90) return colors.accent;
  return colors.gold;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const isFree = user?.tier === 'free' || (!user?.tier && user?.subscription_status !== 'active');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [badges, setBadges] = useState<BadgeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    Promise.all([
      profileAPI.get(user.username).catch(() => ({ data: { profile: null } })),
      badgesAPI.getAll().catch(() => ({ data: { badges: [] } })),
    ]).then(([profileRes, badgesRes]) => {
      setProfile(profileRes.data.profile);
      setBadges(badgesRes.data.badges || []);
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading || !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  const overallScore = profile.scores.find((s) => s.sport === 'overall');
  const scoreVal = overallScore ? parseFloat(overallScore.score) : 0;
  const earnedBadges = badges.filter((b) => b.earned);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: colors.accent + '30', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
          }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 32, color: colors.accent }}>
              {profile.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.foreground, textTransform: 'uppercase', letterSpacing: 2 }}>
            {profile.username}
          </Text>

          {overallScore?.is_unlocked ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <Text style={{ fontFamily: fonts.number, fontSize: 36, color: getScoreColor(scoreVal) }}>
                {scoreVal.toFixed(1)}
              </Text>
              <View style={{
                backgroundColor: getScoreColor(scoreVal) + '20',
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
              }}>
                <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 11, color: getScoreColor(scoreVal) }}>
                  {scoreVal <= 40 ? 'Recreational' : scoreVal <= 60 ? 'Developing' : scoreVal <= 75 ? 'Sharp' : scoreVal <= 90 ? 'Elite' : 'Legend'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.mutedDark, marginTop: 8 }}>
              Score locked — {overallScore?.settled_bet_count || 0}/10 bets needed
            </Text>
          )}
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.number, fontSize: 18, color: colors.foreground }}>
              {profile.record.wins}-{profile.record.losses}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.mutedDark }}>Record</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.number, fontSize: 18, color: profile.roi >= 0 ? colors.win : colors.loss }}>
              {profile.roi >= 0 ? '+' : ''}{profile.roi}%
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.mutedDark }}>ROI</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.number, fontSize: 18, color: colors.foreground }}>{profile.followers}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.mutedDark }}>Followers</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.number, fontSize: 18, color: colors.foreground }}>{profile.following}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.mutedDark }}>Following</Text>
          </View>
        </View>

        {/* Sport scores */}
        <Text style={{ fontFamily: fonts.display, fontSize: 12, color: colors.mutedDark, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
          Sport Scores
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {profile.scores.filter((s) => s.sport !== 'overall').map((s) => {
            const val = parseFloat(s.score);
            return (
              <View key={s.sport} style={{
                backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
                borderRadius: 8, padding: 12, width: '31%' as any, opacity: s.is_unlocked ? 1 : 0.5,
              }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 10, color: colors.mutedDark, textTransform: 'uppercase' }}>
                  {s.sport}
                </Text>
                {s.is_unlocked ? (
                  <Text style={{ fontFamily: fonts.number, fontSize: 18, color: getScoreColor(val), marginTop: 2 }}>
                    {val.toFixed(1)}
                  </Text>
                ) : (
                  <Text style={{ fontFamily: fonts.body, fontSize: 9, color: colors.mutedDark, marginTop: 4 }}>
                    {s.settled_bet_count}/10
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Badges */}
        {isFree ? (
          <View style={{
            backgroundColor: colors.card, borderWidth: 1, borderColor: colors.accent + '40',
            borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 32,
          }}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>🔒</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 14, color: colors.foreground, textTransform: 'uppercase', marginBottom: 4 }}>Badges</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.mutedDark, textAlign: 'center' }}>Upgrade to Pro to earn and display badges</Text>
          </View>
        ) : (
          <>
            <Text style={{ fontFamily: fonts.display, fontSize: 12, color: colors.mutedDark, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
              Badges ({earnedBadges.length}/{badges.length})
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
              {badges.slice(0, 8).map((b) => (
                <View key={b.badge_type} style={{
                  backgroundColor: colors.card, borderWidth: 1,
                  borderColor: b.earned ? colors.gold + '60' : colors.border,
                  borderRadius: 8, padding: 10, width: '23%' as any, alignItems: 'center',
                  opacity: b.earned ? 1 : 0.3,
                }}>
                  <Text style={{ fontSize: 20 }}>{b.icon}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 9, color: colors.foreground, textAlign: 'center', marginTop: 4 }}>
                    {b.name}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Sign Out */}
        <TouchableOpacity
          onPress={async () => {
            await signOut();
            router.replace('/auth/signin');
          }}
          style={{ padding: 14, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.loss }}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
