'use client';

import { useEffect, useState, useCallback } from 'react';
import { leaguesAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Swords, Plus, Users, Trophy, Calendar, Copy, Check, Lock } from 'lucide-react';
import UpgradeBanner from '@/components/ui/UpgradeBanner';

interface LeagueItem {
  id: string;
  name: string;
  sport: string;
  status: string;
  season_name: string;
  season_start: string;
  season_end: string;
  invite_code: string;
  min_bets_per_week: number;
  max_members: number;
  commissioner_id: string;
  member_count: number;
  my_role: string;
  my_score: string;
  my_active_weeks: number;
}

interface LeagueStanding {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  role: string;
  season_score: string;
  active_weeks: number;
  total_weeks: number;
  total_bets_in_league: number;
  best_week_score: string;
  current_streak: number;
  is_self: boolean;
  is_commissioner: boolean;
}

const SPORT_LABELS: Record<string, string> = {
  all: 'All Sports',
  nfl: 'NFL',
  nba: 'NBA',
  mlb: 'MLB',
  nhl: 'NHL',
  cfb: 'CFB',
  cbb: 'CBB',
  soccer: 'Soccer',
  mma: 'MMA',
};

export default function LeaguesPage() {
  const { user } = useAuthStore();
  const [leagues, setLeagues] = useState<LeagueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    sport: 'nfl',
    season_name: '',
    season_start: '',
    season_end: '',
    min_bets_per_week: 1,
    max_members: 20,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Join form state
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  const isFree = user?.tier === 'free' || (!user?.tier && user?.subscription_status !== 'active' && user?.subscription_status !== 'trialing');

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

  const fetchStandings = useCallback(async (leagueId: string) => {
    setStandingsLoading(true);
    try {
      const res = await leaguesAPI.get(leagueId);
      setStandings(res.data.standings || []);
    } catch {
      setStandings([]);
    } finally {
      setStandingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  useEffect(() => {
    if (selectedLeague) {
      fetchStandings(selectedLeague);
    }
  }, [selectedLeague, fetchStandings]);

  const handleCreate = async () => {
    if (!createForm.name || !createForm.season_start || !createForm.season_end) {
      setCreateError('Please fill in all required fields');
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    try {
      await leaguesAPI.create({
        name: createForm.name,
        sport: createForm.sport,
        season_name: createForm.season_name || undefined,
        season_start: createForm.season_start,
        season_end: createForm.season_end,
        min_bets_per_week: createForm.min_bets_per_week,
        max_members: createForm.max_members,
      });
      setShowCreate(false);
      setCreateForm({ name: '', sport: 'nfl', season_name: '', season_start: '', season_end: '', min_bets_per_week: 1, max_members: 20 });
      fetchLeagues();
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create league');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode) {
      setJoinError('Please enter an invite code');
      return;
    }
    setJoinLoading(true);
    setJoinError('');
    try {
      await leaguesAPI.join(joinCode);
      setShowJoin(false);
      setJoinCode('');
      fetchLeagues();
    } catch (err: any) {
      setJoinError(err.response?.data?.error || 'Failed to join league');
    } finally {
      setJoinLoading(false);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getSeasonStatus = (start: string, end: string) => {
    const now = new Date();
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (now < startDate) return { label: 'Upcoming', color: 'text-muted' };
    if (now > endDate) return { label: 'Completed', color: 'text-gold' };
    return { label: 'In Progress', color: 'text-accent' };
  };

  // If viewing a specific league
  if (selectedLeague) {
    const league = leagues.find((l) => l.id === selectedLeague);
    if (!league) return null;

    const seasonStatus = getSeasonStatus(league.season_start, league.season_end);

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back button */}
        <button
          onClick={() => setSelectedLeague(null)}
          className="text-sm text-muted hover:text-white transition-colors"
        >
          &larr; Back to Leagues
        </button>

        {/* League Header */}
        <div className="bg-card border border-accent/20 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                {league.name}
              </h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted">
                <span className="bg-accent/20 text-accent px-2 py-0.5 rounded text-xs uppercase font-semibold">
                  {SPORT_LABELS[league.sport]}
                </span>
                <span className={seasonStatus.color}>{seasonStatus.label}</span>
                <span className="flex items-center gap-1">
                  <Users size={14} /> {league.member_count}/{league.max_members}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={14} /> Min {league.min_bets_per_week} bet/week
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-dark uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Invite Code</p>
              <button
                onClick={() => copyInviteCode(league.invite_code)}
                className="flex items-center gap-2 mt-1 px-3 py-1.5 bg-accent/20 rounded text-accent text-sm font-mono hover:bg-accent/30 transition-colors"
              >
                {league.invite_code}
                {copiedCode === league.invite_code ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Standings Table */}
        <div className="bg-card border border-accent/20 rounded-lg overflow-hidden">
          <div className="px-6 py-3 border-b border-accent/20 bg-secondary">
            <h2 className="text-sm uppercase tracking-wider text-muted-dark font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Season Standings
            </h2>
          </div>

          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs uppercase tracking-wider text-muted-dark border-b border-accent/10" style={{ fontFamily: 'var(--font-display)' }}>
            <div className="col-span-1">Rank</div>
            <div className="col-span-3">Player</div>
            <div className="col-span-2 text-right">Score</div>
            <div className="col-span-2 text-right">Active Wks</div>
            <div className="col-span-2 text-right">Bets</div>
            <div className="col-span-2 text-right">Best Week</div>
          </div>

          {standingsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : standings.length === 0 ? (
            <div className="text-center py-12 text-muted-dark">No standings yet</div>
          ) : (
            standings.map((member) => (
              <div
                key={member.user_id}
                className={`grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-accent/10 ${
                  member.is_self ? 'bg-accent/10' : 'hover:bg-secondary/50'
                } transition-colors`}
              >
                <div className="col-span-1">
                  <span className={`text-lg font-bold ${member.rank <= 3 ? 'text-gold' : 'text-muted'}`} style={{ fontFamily: 'var(--font-number)' }}>
                    {member.rank}
                  </span>
                </div>
                <div className="col-span-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs flex-shrink-0">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      member.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <span className={`text-sm font-medium ${member.is_self ? 'text-accent' : 'text-white'}`}>
                      {member.username}
                      {member.is_self && <span className="text-xs text-accent ml-1">(You)</span>}
                    </span>
                    {member.is_commissioner && (
                      <span className="text-xs text-gold ml-2">Commissioner</span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-lg font-bold text-accent" style={{ fontFamily: 'var(--font-number)' }}>
                    {parseFloat(member.season_score).toFixed(1)}
                  </span>
                </div>
                <div className="col-span-2 text-right text-sm text-muted">
                  {member.active_weeks}/{member.total_weeks}
                </div>
                <div className="col-span-2 text-right text-sm text-muted">
                  {member.total_bets_in_league}
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-sm text-gold" style={{ fontFamily: 'var(--font-number)' }}>
                    {parseFloat(member.best_week_score || '0').toFixed(1)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Swords className="text-accent" size={28} />
          <h1 className="text-2xl font-bold text-white uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
            Leagues
          </h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowJoin(true)}
            className="px-4 py-2 rounded-lg bg-card border border-accent/20 text-sm font-semibold text-white hover:bg-secondary transition-colors uppercase tracking-wide"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Join League
          </button>
          {isFree ? (
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/20 text-accent text-sm font-semibold cursor-not-allowed"
              style={{ fontFamily: 'var(--font-display)' }}
              disabled
            >
              <Lock size={14} /> Create League
              <span className="text-xs bg-accent text-background px-1.5 py-0.5 rounded ml-1">PRO</span>
            </button>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-light transition-colors uppercase tracking-wide"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <Plus size={16} /> Create League
            </button>
          )}
        </div>
      </div>

      {/* Create League Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-accent/20 rounded-xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
              Create a League
            </h2>

            <div>
              <label className="text-xs text-muted-dark uppercase tracking-wide block mb-1" style={{ fontFamily: 'var(--font-display)' }}>League Name *</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full px-4 py-3 bg-secondary border border-accent/20 rounded-lg text-white placeholder-muted-dark focus:outline-none focus:border-accent"
                placeholder="e.g. Sunday Degen League"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-dark uppercase tracking-wide block mb-1" style={{ fontFamily: 'var(--font-display)' }}>Sport *</label>
                <select
                  value={createForm.sport}
                  onChange={(e) => setCreateForm({ ...createForm, sport: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary border border-accent/20 rounded-lg text-white focus:outline-none focus:border-accent"
                >
                  {Object.entries(SPORT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-dark uppercase tracking-wide block mb-1" style={{ fontFamily: 'var(--font-display)' }}>Min Bets/Week</label>
                <select
                  value={createForm.min_bets_per_week}
                  onChange={(e) => setCreateForm({ ...createForm, min_bets_per_week: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-secondary border border-accent/20 rounded-lg text-white focus:outline-none focus:border-accent"
                >
                  {[1, 2, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-dark uppercase tracking-wide block mb-1" style={{ fontFamily: 'var(--font-display)' }}>Season Start *</label>
                <input
                  type="date"
                  value={createForm.season_start}
                  onChange={(e) => setCreateForm({ ...createForm, season_start: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary border border-accent/20 rounded-lg text-white focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs text-muted-dark uppercase tracking-wide block mb-1" style={{ fontFamily: 'var(--font-display)' }}>Season End *</label>
                <input
                  type="date"
                  value={createForm.season_end}
                  onChange={(e) => setCreateForm({ ...createForm, season_end: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary border border-accent/20 rounded-lg text-white focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-dark uppercase tracking-wide block mb-1" style={{ fontFamily: 'var(--font-display)' }}>Season Name (optional)</label>
              <input
                type="text"
                value={createForm.season_name}
                onChange={(e) => setCreateForm({ ...createForm, season_name: e.target.value })}
                className="w-full px-4 py-3 bg-secondary border border-accent/20 rounded-lg text-white placeholder-muted-dark focus:outline-none focus:border-accent"
                placeholder="e.g. 2025 NFL Season"
              />
            </div>

            {createError && <p className="text-loss text-sm">{createError}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-3 rounded-lg bg-secondary text-muted hover:text-white transition-colors text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createLoading}
                className="flex-1 px-4 py-3 rounded-lg bg-accent text-background font-semibold text-sm hover:bg-accent-light transition-colors disabled:opacity-50"
              >
                {createLoading ? 'Creating...' : 'Create League'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join League Modal */}
      {showJoin && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-accent/20 rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
              Join a League
            </h2>
            <p className="text-sm text-muted">Enter the invite code shared by your league commissioner.</p>

            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-secondary border border-accent/20 rounded-lg text-white text-center text-lg tracking-widest font-mono placeholder-muted-dark focus:outline-none focus:border-accent"
              placeholder="ENTER CODE"
              maxLength={8}
            />

            {joinError && <p className="text-loss text-sm">{joinError}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowJoin(false); setJoinCode(''); setJoinError(''); }}
                className="flex-1 px-4 py-3 rounded-lg bg-secondary text-muted hover:text-white transition-colors text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={joinLoading}
                className="flex-1 px-4 py-3 rounded-lg bg-accent text-background font-semibold text-sm hover:bg-accent-light transition-colors disabled:opacity-50"
              >
                {joinLoading ? 'Joining...' : 'Join League'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leagues List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : leagues.length === 0 ? (
        <div className="bg-card border border-accent/20 rounded-lg p-12 text-center">
          <Swords className="mx-auto text-muted-dark mb-4" size={48} />
          <h2 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            NO LEAGUES YET
          </h2>
          <p className="text-sm text-muted-dark max-w-md mx-auto">
            Create a league to compete with friends over an entire season, or join one using an invite code.
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={() => setShowJoin(true)}
              className="px-5 py-2.5 rounded-lg bg-card border border-accent/20 text-sm font-semibold text-white hover:bg-secondary transition-colors"
            >
              Join with Code
            </button>
            {!isFree && (
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-light transition-colors"
              >
                Create League
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {leagues.map((league) => {
            const seasonStatus = getSeasonStatus(league.season_start, league.season_end);
            return (
              <button
                key={league.id}
                onClick={() => setSelectedLeague(league.id)}
                className="bg-card border border-accent/20 rounded-lg p-5 text-left hover:border-accent/40 hover:bg-secondary/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-accent transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                      {league.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5 text-sm text-muted">
                      <span className="bg-accent/20 text-accent px-2 py-0.5 rounded text-xs uppercase font-semibold">
                        {SPORT_LABELS[league.sport]}
                      </span>
                      <span className={seasonStatus.color}>{seasonStatus.label}</span>
                      <span className="flex items-center gap-1">
                        <Users size={13} /> {league.member_count}
                      </span>
                      {league.my_role === 'commissioner' && (
                        <span className="text-gold text-xs">Commissioner</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-dark uppercase" style={{ fontFamily: 'var(--font-display)' }}>My Score</p>
                    <p className="text-2xl font-bold text-accent" style={{ fontFamily: 'var(--font-number)' }}>
                      {parseFloat(league.my_score || '0').toFixed(1)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Free user limit notice */}
      {isFree && leagues.length >= 2 && (
        <UpgradeBanner
          feature="Unlimited Leagues"
          description="Free users can join up to 2 leagues. Upgrade to Pro to join unlimited leagues and create your own."
        />
      )}
    </div>
  );
}
