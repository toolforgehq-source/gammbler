'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { challengesAPI, shareableAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Target,
  Plus,
  Check,
  X,
  Trophy,
  Clock,
  Search,
  Download,
  Send,
  ShieldCheck,
  Loader2,
  Zap,
} from 'lucide-react';

interface ChallengeUser {
  username: string;
  avatar_url: string | null;
}

interface Challenge {
  id: string;
  challenger_id: string;
  challengee_id: string;
  sport: string;
  event_name: string;
  event_start_time: string | null;
  challenger_pick: string;
  challengee_pick: string | null;
  status: string;
  winner_id: string | null;
  message: string | null;
  stake_display: string | null;
  settled_at: string | null;
  expires_at: string;
  created_at: string;
  challenger: ChallengeUser | null;
  challengee: ChallengeUser | null;
  winner: ChallengeUser | null;
  is_challenger: boolean;
  // Verified H2H fields
  is_verified: boolean;
  odds_api_event_id: string | null;
  market: string | null;
  challenger_line: string | null;
  challenger_odds: number | null;
  challengee_odds: number | null;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  settlement_method: string | null;
}

interface H2HStats {
  wins: number;
  losses: number;
  draws: number;
  pending_received: number;
}

interface SearchUser {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

interface Market {
  key: string;
  outcomes: OddsOutcome[];
}

interface GameEvent {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Market[];
  }>;
}

const SPORTS = [
  { value: 'nfl', label: 'NFL' },
  { value: 'nba', label: 'NBA' },
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
  { value: 'cfb', label: 'CFB' },
  { value: 'cbb', label: 'CBB' },
  { value: 'soccer', label: 'Soccer' },
];

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : String(odds);
}

function formatGameTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` ${timeStr}`;
}

function getConsensusOdds(game: GameEvent, marketKey: string): Market | null {
  const preferred = ['draftkings', 'fanduel', 'betmgm', 'caesars'];
  for (const pref of preferred) {
    const book = game.bookmakers.find(b => b.key === pref);
    if (book) {
      const market = book.markets.find(m => m.key === marketKey);
      if (market) return market;
    }
  }
  for (const book of game.bookmakers) {
    const market = book.markets.find(m => m.key === marketKey);
    if (market) return market;
  }
  return null;
}

function StatusBadge({ status, isVerified }: { status: string; isVerified?: boolean }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    accepted: 'bg-blue-500/20 text-blue-400',
    declined: 'bg-red-500/20 text-red-400',
    settled: 'bg-green-500/20 text-green-400',
    auto_settled: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-gray-500/20 text-gray-400',
    expired: 'bg-gray-500/20 text-gray-400',
  };
  const displayStatus = status === 'auto_settled' ? 'settled' : status;
  return (
    <div className="flex items-center gap-1.5">
      {isVerified && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/20 text-accent uppercase tracking-wider">
          <ShieldCheck size={10} />
          Verified
        </span>
      )}
      {!isVerified && status !== 'pending' && (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400 uppercase tracking-wider">
          Custom
        </span>
      )}
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${styles[status] || styles.pending}`}>
        {displayStatus}
      </span>
    </div>
  );
}

function MarketLabel({ market }: { market: string | null }) {
  if (!market) return null;
  const labels: Record<string, string> = { h2h: 'Moneyline', spreads: 'Spread', totals: 'Over/Under' };
  return (
    <span className="text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded font-medium">
      {labels[market] || market}
    </span>
  );
}

function ChallengesPageInner() {
  const searchParams = useSearchParams();
  const opponentParam = searchParams.get('opponent');
  const { user } = useAuthStore();
  const [challengesList, setChallengesList] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<H2HStats>({ wins: 0, losses: 0, draws: 0, pending_received: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'pending' | 'active' | 'settled'>('all');
  const [showCreate, setShowCreate] = useState(!!opponentParam);

  // Create form state
  const [createMode, setCreateMode] = useState<'verified' | 'custom'>('verified');
  const [searchQuery, setSearchQuery] = useState(opponentParam || '');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [sport, setSport] = useState('mlb');
  const [eventName, setEventName] = useState('');
  const [challengerPick, setChallengerPick] = useState('');
  const [message, setMessage] = useState('');
  const [stakeDisplay, setStakeDisplay] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Verified game picker state
  const [games, setGames] = useState<GameEvent[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameEvent | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<'h2h' | 'spreads' | 'totals'>('h2h');
  const [selectedOutcome, setSelectedOutcome] = useState<OddsOutcome | null>(null);
  const [opponentOutcome, setOpponentOutcome] = useState<OddsOutcome | null>(null);

  // Accept modal
  const [acceptingChallenge, setAcceptingChallenge] = useState<Challenge | null>(null);
  const [acceptPick, setAcceptPick] = useState('');
  const [accepting, setAccepting] = useState(false);

  // Settle modal
  const [settlingChallenge, setSettlingChallenge] = useState<Challenge | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function refresh() { setRefreshKey((k) => k + 1); }

  useEffect(() => {
    async function fetchChallenges() {
      try {
        const statusFilter = tab === 'all' ? undefined
          : tab === 'pending' ? 'pending'
          : tab === 'active' ? 'accepted'
          : 'settled';

        const [challengesRes, statsRes] = await Promise.all([
          challengesAPI.list(statusFilter ? { status: statusFilter } : undefined),
          challengesAPI.stats(),
        ]);
        setChallengesList(challengesRes.data.challenges || []);
        setStats(statsRes.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchChallenges();
  }, [tab, refreshKey]);

  // Auto-select opponent from URL param
  useEffect(() => {
    if (opponentParam && !selectedUser) {
      challengesAPI.searchUsers(opponentParam).then((res) => {
        const users = res.data.users || [];
        const match = users.find((u: SearchUser) => u.username.toLowerCase() === opponentParam.toLowerCase());
        if (match) {
          setSelectedUser(match);
          setSearchQuery('');
        }
      }).catch(() => {});
    }
  }, [opponentParam]);

  // User search debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await challengesAPI.searchUsers(searchQuery);
        setSearchResults(res.data.users || []);
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Fetch games when sport changes (verified mode)
  useEffect(() => {
    if (createMode !== 'verified' || !showCreate) return;
    setGamesLoading(true);
    setGames([]);
    setSelectedGame(null);
    setSelectedOutcome(null);
    setOpponentOutcome(null);
    challengesAPI.games(sport).then((res) => {
      setGames(res.data.games || []);
    }).catch(() => {
      setGames([]);
    }).finally(() => {
      setGamesLoading(false);
    });
  }, [sport, createMode, showCreate]);

  function selectOutcome(game: GameEvent, market: 'h2h' | 'spreads' | 'totals', outcome: OddsOutcome) {
    setSelectedGame(game);
    setSelectedMarket(market);
    setSelectedOutcome(outcome);
    setEventName(`${game.away_team} @ ${game.home_team}`);

    // Determine the pick text
    if (market === 'h2h') {
      setChallengerPick(outcome.name);
    } else if (market === 'spreads') {
      const pointStr = outcome.point != null ? (outcome.point > 0 ? `+${outcome.point}` : String(outcome.point)) : '';
      setChallengerPick(`${outcome.name} ${pointStr}`);
    } else if (market === 'totals') {
      const pointStr = outcome.point != null ? String(outcome.point) : '';
      setChallengerPick(`${outcome.name} ${pointStr}`);
    }

    // Find the opponent's outcome
    const marketData = getConsensusOdds(game, market);
    if (marketData) {
      const opp = marketData.outcomes.find(o => o.name !== outcome.name);
      setOpponentOutcome(opp || null);
    }
  }

  async function handleCreate() {
    if (!selectedUser) return;

    if (createMode === 'verified') {
      if (!selectedGame || !selectedOutcome) return;
    } else {
      if (!eventName || !challengerPick) return;
    }

    setCreating(true);
    setCreateError('');
    try {
      const payload: Parameters<typeof challengesAPI.create>[0] = {
        challengee_username: selectedUser.username,
        sport,
        event_name: eventName,
        challenger_pick: challengerPick,
        message: message || undefined,
        stake_display: stakeDisplay || undefined,
      };

      if (createMode === 'verified' && selectedGame && selectedOutcome) {
        payload.is_verified = true;
        payload.odds_api_event_id = selectedGame.id;
        payload.market = selectedMarket;
        payload.event_start_time = selectedGame.commence_time;
        payload.challenger_odds = selectedOutcome.price;
        payload.home_team = selectedGame.home_team;
        payload.away_team = selectedGame.away_team;

        if (selectedMarket === 'spreads' && selectedOutcome.point != null) {
          payload.challenger_line = selectedOutcome.point;
        } else if (selectedMarket === 'totals' && selectedOutcome.point != null) {
          payload.challenger_line = selectedOutcome.point;
        }

        if (opponentOutcome) {
          payload.challengee_odds = opponentOutcome.price;
        }
      }

      await challengesAPI.create(payload);
      setShowCreate(false);
      resetCreateForm();
      refresh();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setCreateError(axiosErr.response?.data?.error || 'Failed to create challenge');
    } finally {
      setCreating(false);
    }
  }

  function resetCreateForm() {
    setSelectedUser(null);
    setSearchQuery('');
    setEventName('');
    setChallengerPick('');
    setMessage('');
    setStakeDisplay('');
    setSelectedGame(null);
    setSelectedOutcome(null);
    setOpponentOutcome(null);
    setCreateMode('verified');
  }

  async function handleAccept(challenge: Challenge) {
    setAccepting(true);
    try {
      if (challenge.is_verified) {
        // Verified: no pick needed, server auto-assigns
        await challengesAPI.accept(challenge.id);
      } else {
        if (!acceptPick) return;
        await challengesAPI.accept(challenge.id, acceptPick);
      }
      setAcceptingChallenge(null);
      setAcceptPick('');
      refresh();
    } catch {
      // ignore
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline(id: string) {
    try {
      await challengesAPI.decline(id);
      refresh();
    } catch {
      // ignore
    }
  }

  async function handleCancel(id: string) {
    try {
      await challengesAPI.cancel(id);
      refresh();
    } catch {
      // ignore
    }
  }

  async function handleSettle(challengeId: string, winnerId: string) {
    try {
      await challengesAPI.settle(challengeId, winnerId);
      setSettlingChallenge(null);
      refresh();
    } catch {
      // ignore
    }
  }

  async function handleDownloadH2HCard(challengeId: string) {
    try {
      const res = await shareableAPI.h2hCard(challengeId);
      const blob = new Blob([res.data], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gammbler-h2h-${challengeId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
            <Target className="text-accent" size={28} />
            Head-to-Head
          </h1>
          <p className="text-sm text-muted-dark mt-1">Challenge friends, pick your side, prove who&apos;s sharper.</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateMode('verified'); }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent-light transition-colors text-sm self-start sm:self-auto"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Plus size={16} />
          New Challenge
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-accent/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-win" style={{ fontFamily: 'var(--font-number)' }}>{stats.wins}</p>
          <p className="text-xs text-muted-dark uppercase tracking-wider mt-1" style={{ fontFamily: 'var(--font-display)' }}>Wins</p>
        </div>
        <div className="bg-card border border-accent/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-loss" style={{ fontFamily: 'var(--font-number)' }}>{stats.losses}</p>
          <p className="text-xs text-muted-dark uppercase tracking-wider mt-1" style={{ fontFamily: 'var(--font-display)' }}>Losses</p>
        </div>
        <div className="bg-card border border-accent/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-muted" style={{ fontFamily: 'var(--font-number)' }}>{stats.draws}</p>
          <p className="text-xs text-muted-dark uppercase tracking-wider mt-1" style={{ fontFamily: 'var(--font-display)' }}>Draws</p>
        </div>
        <div className="bg-card border border-accent/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gold" style={{ fontFamily: 'var(--font-number)' }}>{stats.pending_received}</p>
          <p className="text-xs text-muted-dark uppercase tracking-wider mt-1" style={{ fontFamily: 'var(--font-display)' }}>Incoming</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {(['all', 'pending', 'active', 'settled'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors uppercase tracking-wider ${
              tab === t ? 'bg-accent/20 text-accent' : 'text-muted-dark hover:text-white'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Challenges list */}
      <div className="space-y-3">
        {challengesList.length === 0 ? (
          <div className="bg-card border border-accent/20 rounded-lg p-12 text-center">
            <Target size={40} className="text-muted-dark mx-auto mb-4" />
            <p className="text-muted-dark">No challenges yet. Send one!</p>
          </div>
        ) : (
          challengesList.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              userId={user?.id || ''}
              onAccept={(c) => {
                if (c.is_verified) {
                  handleAccept(c);
                } else {
                  setAcceptingChallenge(c);
                  setAcceptPick('');
                }
              }}
              onDecline={handleDecline}
              onCancel={handleCancel}
              onSettle={(c) => setSettlingChallenge(c)}
              onDownloadCard={handleDownloadH2HCard}
            />
          ))
        )}
      </div>

      {/* ═══════ Create Challenge Modal ═══════ */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-secondary border border-accent/20 rounded-xl w-full max-w-lg p-6 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>New Challenge</h2>
              <button onClick={() => { setShowCreate(false); resetCreateForm(); }} className="text-muted-dark hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-1 bg-card rounded-lg p-1">
              <button
                onClick={() => setCreateMode('verified')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                  createMode === 'verified' ? 'bg-accent/20 text-accent' : 'text-muted-dark hover:text-white'
                }`}
              >
                <ShieldCheck size={12} />
                Verified — Pick a Game
              </button>
              <button
                onClick={() => setCreateMode('custom')}
                className={`flex-1 py-2 rounded-md text-xs font-semibold transition-colors ${
                  createMode === 'custom' ? 'bg-gray-500/20 text-gray-300' : 'text-muted-dark hover:text-white'
                }`}
              >
                Custom — Type Your Own
              </button>
            </div>

            {createMode === 'verified' && (
              <p className="text-xs text-accent flex items-center gap-1.5">
                <ShieldCheck size={12} />
                Verified challenges use real game data and auto-settle when the game ends.
              </p>
            )}
            {createMode === 'custom' && (
              <p className="text-xs text-muted-dark">
                Custom challenges are for fun. They require manual settlement and are labeled &quot;Custom&quot; in your H2H record.
              </p>
            )}

            {/* User Search */}
            <div>
              <label className="text-xs text-muted-dark uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Challenge Who?
              </label>
              {selectedUser ? (
                <div className="flex items-center gap-3 bg-card border border-accent/20 rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                    {selectedUser.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-white">@{selectedUser.username}</span>
                  <button onClick={() => { setSelectedUser(null); setSearchQuery(''); }} className="ml-auto text-muted-dark hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-dark" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by username..."
                    className="w-full bg-card border border-accent/20 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-muted-dark focus:border-accent/50 focus:outline-none"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-accent/20 rounded-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                      {searchResults.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => { setSelectedUser(u); setSearchQuery(''); setSearchResults([]); }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-white hover:bg-accent/10 transition-colors"
                        >
                          <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          @{u.username}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sport */}
            <div>
              <label className="text-xs text-muted-dark uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Sport
              </label>
              <div className="flex flex-wrap gap-2">
                {SPORTS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSport(s.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      sport === s.value ? 'bg-accent text-background' : 'bg-card text-muted-dark border border-accent/20 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Verified Mode: Game Picker ─── */}
            {createMode === 'verified' && (
              <>
                {/* Market Tabs */}
                <div>
                  <label className="text-xs text-muted-dark uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                    Market
                  </label>
                  <div className="flex gap-1 bg-card rounded-lg p-1">
                    {([
                      { key: 'h2h' as const, label: 'Moneyline' },
                      { key: 'spreads' as const, label: 'Spread' },
                      { key: 'totals' as const, label: 'Over/Under' },
                    ]).map((m) => (
                      <button
                        key={m.key}
                        onClick={() => { setSelectedMarket(m.key); setSelectedGame(null); setSelectedOutcome(null); setOpponentOutcome(null); }}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          selectedMarket === m.key ? 'bg-accent/20 text-accent' : 'text-muted-dark hover:text-white'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Games List */}
                <div>
                  <label className="text-xs text-muted-dark uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                    Pick a Game ({games.length} available)
                  </label>
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {gamesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={20} className="animate-spin text-accent" />
                        <span className="text-sm text-muted-dark ml-2">Loading games...</span>
                      </div>
                    ) : games.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-dark">No upcoming games for {SPORTS.find(s => s.value === sport)?.label || sport}.</p>
                      </div>
                    ) : (
                      games.map((game) => {
                        const market = getConsensusOdds(game, selectedMarket);
                        if (!market) return null;
                        const isSelected = selectedGame?.id === game.id;

                        return (
                          <div
                            key={game.id}
                            className={`bg-card border rounded-lg p-3 ${
                              isSelected ? 'border-accent' : 'border-accent/20'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-muted-dark">{formatGameTime(game.commence_time)}</span>
                            </div>
                            <div className="flex items-center justify-between mb-2 text-sm">
                              <span className="text-white font-medium">{game.away_team}</span>
                              <span className="text-xs text-muted-dark">@</span>
                              <span className="text-white font-medium">{game.home_team}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {market.outcomes.map((outcome) => {
                                const isMyPick = isSelected && selectedOutcome?.name === outcome.name;
                                const pointStr = outcome.point != null
                                  ? ` (${outcome.point > 0 ? '+' : ''}${outcome.point})`
                                  : '';
                                return (
                                  <button
                                    key={outcome.name}
                                    onClick={() => selectOutcome(game, selectedMarket, outcome)}
                                    className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors border ${
                                      isMyPick
                                        ? 'bg-accent text-background border-accent'
                                        : 'bg-secondary text-white border-accent/20 hover:border-accent/50'
                                    }`}
                                  >
                                    <span className="block">{outcome.name}{pointStr}</span>
                                    <span className="block text-[11px] mt-0.5 opacity-80">{formatOdds(outcome.price)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Selected Pick Summary */}
                {selectedGame && selectedOutcome && (
                  <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 space-y-1">
                    <p className="text-xs text-accent font-semibold uppercase tracking-wider">Your Pick</p>
                    <p className="text-sm text-white font-bold">{challengerPick} {formatOdds(selectedOutcome.price)}</p>
                    <p className="text-xs text-muted-dark">{eventName}</p>
                    {opponentOutcome && (
                      <p className="text-xs text-muted-dark">
                        Opponent gets: <span className="text-white">{opponentOutcome.name}{opponentOutcome.point != null ? ` (${opponentOutcome.point > 0 ? '+' : ''}${opponentOutcome.point})` : ''} {formatOdds(opponentOutcome.price)}</span>
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ─── Custom Mode: Free Text ─── */}
            {createMode === 'custom' && (
              <>
                <div>
                  <label className="text-xs text-muted-dark uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                    Game / Event
                  </label>
                  <input
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g., Chiefs vs Eagles"
                    className="w-full bg-card border border-accent/20 rounded-lg px-4 py-2 text-sm text-white placeholder-muted-dark focus:border-accent/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-dark uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                    Your Pick
                  </label>
                  <input
                    type="text"
                    value={challengerPick}
                    onChange={(e) => setChallengerPick(e.target.value)}
                    placeholder="e.g., Chiefs -3.5"
                    className="w-full bg-card border border-accent/20 rounded-lg px-4 py-2 text-sm text-white placeholder-muted-dark focus:border-accent/50 focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* Stakes + Message (both modes) */}
            <div>
              <label className="text-xs text-muted-dark uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Stakes (optional — bragging rights only)
              </label>
              <input
                type="text"
                value={stakeDisplay}
                onChange={(e) => setStakeDisplay(e.target.value)}
                placeholder="e.g., Loser buys dinner"
                className="w-full bg-card border border-accent/20 rounded-lg px-4 py-2 text-sm text-white placeholder-muted-dark focus:border-accent/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-muted-dark uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Trash Talk (optional)
              </label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g., You have no chance..."
                className="w-full bg-card border border-accent/20 rounded-lg px-4 py-2 text-sm text-white placeholder-muted-dark focus:border-accent/50 focus:outline-none"
              />
            </div>

            {createError && (
              <p className="text-sm text-loss">{createError}</p>
            )}

            <button
              onClick={handleCreate}
              disabled={
                creating || !selectedUser ||
                (createMode === 'verified' ? !selectedGame || !selectedOutcome : !eventName || !challengerPick)
              }
              className="w-full flex items-center justify-center gap-2 bg-accent text-background py-3 rounded-lg font-semibold hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {createMode === 'verified' && <ShieldCheck size={16} />}
              <Send size={16} />
              {creating ? 'Sending...' : createMode === 'verified' ? 'Send Verified Challenge' : 'Send Custom Challenge'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════ Accept Challenge Modal (Custom only) ═══════ */}
      {acceptingChallenge && !acceptingChallenge.is_verified && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-secondary border border-accent/20 rounded-xl w-full max-w-md p-6 space-y-5">
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Accept Challenge</h2>
            <div className="bg-card border border-accent/20 rounded-lg p-4 space-y-2">
              <p className="text-sm text-muted-dark">
                <span className="text-white font-medium">@{acceptingChallenge.challenger?.username}</span> challenged you on:
              </p>
              <p className="text-white font-semibold">{acceptingChallenge.event_name}</p>
              <p className="text-sm text-muted-dark">
                Their pick: <span className="text-accent font-medium">{acceptingChallenge.challenger_pick}</span>
              </p>
              {acceptingChallenge.message && (
                <p className="text-sm text-muted-dark italic">&quot;{acceptingChallenge.message}&quot;</p>
              )}
              {acceptingChallenge.stake_display && (
                <p className="text-sm text-gold">Stakes: {acceptingChallenge.stake_display}</p>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-dark uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Your Pick
              </label>
              <input
                type="text"
                value={acceptPick}
                onChange={(e) => setAcceptPick(e.target.value)}
                placeholder="e.g., Eagles +3.5"
                className="w-full bg-card border border-accent/20 rounded-lg px-4 py-2 text-sm text-white placeholder-muted-dark focus:border-accent/50 focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAcceptingChallenge(null)}
                className="flex-1 py-2 bg-card border border-accent/20 rounded-lg text-muted-dark hover:text-white transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAccept(acceptingChallenge)}
                disabled={!acceptPick}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent-light transition-colors disabled:opacity-50 text-sm"
              >
                <Check size={14} />
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Settle Challenge Modal (Custom only) ═══════ */}
      {settlingChallenge && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-secondary border border-accent/20 rounded-xl w-full max-w-md p-6 space-y-5">
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Settle Challenge</h2>
            <div className="bg-card border border-accent/20 rounded-lg p-4 space-y-2">
              <p className="text-white font-semibold">{settlingChallenge.event_name}</p>
              <p className="text-sm text-muted-dark">
                @{settlingChallenge.challenger?.username}: <span className="text-accent">{settlingChallenge.challenger_pick}</span>
              </p>
              <p className="text-sm text-muted-dark">
                @{settlingChallenge.challengee?.username}: <span className="text-accent">{settlingChallenge.challengee_pick}</span>
              </p>
            </div>

            <p className="text-sm text-muted-dark text-center">Who won?</p>

            <div className="flex gap-3">
              <button
                onClick={() => handleSettle(settlingChallenge.id, settlingChallenge.challenger_id)}
                className="flex-1 py-3 bg-card border border-accent/20 rounded-lg text-white hover:border-accent/50 transition-colors text-sm font-medium"
              >
                @{settlingChallenge.challenger?.username}
              </button>
              <button
                onClick={() => handleSettle(settlingChallenge.id, settlingChallenge.challengee_id)}
                className="flex-1 py-3 bg-card border border-accent/20 rounded-lg text-white hover:border-accent/50 transition-colors text-sm font-medium"
              >
                @{settlingChallenge.challengee?.username}
              </button>
            </div>

            <button
              onClick={() => setSettlingChallenge(null)}
              className="w-full py-2 text-muted-dark hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChallengeCard({
  challenge,
  userId,
  onAccept,
  onDecline,
  onCancel,
  onSettle,
  onDownloadCard,
}: {
  challenge: Challenge;
  userId: string;
  onAccept: (c: Challenge) => void;
  onDecline: (id: string) => void;
  onCancel: (id: string) => void;
  onSettle: (c: Challenge) => void;
  onDownloadCard: (id: string) => void;
}) {
  const isChallenger = challenge.challenger_id === userId;
  const isWinner = challenge.winner_id === userId;
  const isPending = challenge.status === 'pending';
  const isAccepted = challenge.status === 'accepted';
  const isSettled = challenge.status === 'settled' || challenge.status === 'auto_settled';

  return (
    <div className={`bg-card border rounded-lg p-5 ${
      isSettled && isWinner ? 'border-win/40' :
      isSettled && !isWinner && challenge.winner_id ? 'border-loss/40' :
      isPending && !isChallenger ? 'border-gold/40' :
      'border-accent/20'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs">
              {challenge.challenger?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <span className="text-sm font-medium text-white">@{challenge.challenger?.username}</span>
          </div>
          <span className="text-xs text-muted-dark">vs</span>
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs">
              {challenge.challengee?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <span className="text-sm font-medium text-white">@{challenge.challengee?.username}</span>
          </div>
        </div>
        <StatusBadge status={challenge.status} isVerified={challenge.is_verified} />
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-dark uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            {challenge.sport.toUpperCase()}
          </span>
          <MarketLabel market={challenge.market} />
          <span className="text-sm text-white font-medium">{challenge.event_name}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-lg p-2">
            <p className="text-xs text-muted-dark">@{challenge.challenger?.username}&apos;s pick</p>
            <p className="text-sm text-white font-semibold">
              {challenge.challenger_pick}
              {challenge.challenger_odds != null && (
                <span className="text-xs text-muted-dark ml-1">({formatOdds(challenge.challenger_odds)})</span>
              )}
            </p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2">
            <p className="text-xs text-muted-dark">@{challenge.challengee?.username}&apos;s pick</p>
            <p className="text-sm text-white font-semibold">
              {challenge.challengee_pick || 'Waiting...'}
              {challenge.challengee_odds != null && challenge.challengee_pick && (
                <span className="text-xs text-muted-dark ml-1">({formatOdds(challenge.challengee_odds)})</span>
              )}
            </p>
          </div>
        </div>

        {/* Final score for auto-settled */}
        {isSettled && challenge.home_score != null && challenge.away_score != null && (
          <div className="flex items-center gap-2 bg-secondary/30 rounded-lg p-2">
            <Zap size={12} className="text-accent" />
            <span className="text-xs text-muted-dark">Final Score:</span>
            <span className="text-sm text-white font-bold">
              {challenge.away_team || 'Away'} {challenge.away_score} — {challenge.home_team || 'Home'} {challenge.home_score}
            </span>
            {challenge.settlement_method === 'auto' && (
              <span className="text-xs text-accent ml-auto">Auto-settled</span>
            )}
          </div>
        )}

        {challenge.stake_display && (
          <p className="text-xs text-gold">Stakes: {challenge.stake_display}</p>
        )}
        {challenge.message && (
          <p className="text-xs text-muted-dark italic">&quot;{challenge.message}&quot;</p>
        )}
      </div>

      {/* Winner display */}
      {isSettled && challenge.winner_id && (
        <div className={`flex items-center gap-2 mb-3 p-2 rounded-lg ${
          isWinner ? 'bg-win/10' : 'bg-loss/10'
        }`}>
          <Trophy size={14} className={isWinner ? 'text-win' : 'text-loss'} />
          <span className={`text-sm font-semibold ${isWinner ? 'text-win' : 'text-loss'}`}>
            {isWinner ? 'You won!' : `@${challenge.winner?.username} won`}
          </span>
        </div>
      )}

      {/* Push display */}
      {isSettled && !challenge.winner_id && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-gray-500/10">
          <span className="text-sm font-semibold text-gray-400">Push — no winner</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-accent/10">
        {/* Pending + I'm the challengee → Accept/Decline */}
        {isPending && !isChallenger && (
          <>
            <button
              onClick={() => onAccept(challenge)}
              className="flex items-center gap-1 px-3 py-1.5 bg-accent text-background rounded-md text-xs font-semibold hover:bg-accent-light transition-colors"
            >
              <Check size={12} />
              {challenge.is_verified ? 'Accept (auto-pick)' : 'Accept'}
            </button>
            <button
              onClick={() => onDecline(challenge.id)}
              className="flex items-center gap-1 px-3 py-1.5 bg-card border border-accent/20 text-muted-dark rounded-md text-xs font-medium hover:text-white transition-colors"
            >
              <X size={12} />
              Decline
            </button>
          </>
        )}

        {/* Pending + I'm the challenger → Cancel */}
        {isPending && isChallenger && (
          <button
            onClick={() => onCancel(challenge.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-card border border-accent/20 text-muted-dark rounded-md text-xs font-medium hover:text-white transition-colors"
          >
            <X size={12} />
            Cancel
          </button>
        )}

        {/* Accepted → Settle (custom only) or Waiting (verified) */}
        {isAccepted && !challenge.is_verified && (
          <button
            onClick={() => onSettle(challenge)}
            className="flex items-center gap-1 px-3 py-1.5 bg-accent text-background rounded-md text-xs font-semibold hover:bg-accent-light transition-colors"
          >
            <Trophy size={12} />
            Settle
          </button>
        )}
        {isAccepted && challenge.is_verified && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-md text-xs font-medium">
            <Clock size={12} />
            Waiting for game result...
          </span>
        )}

        {/* Settled → Download result card */}
        {isSettled && (
          <button
            onClick={() => onDownloadCard(challenge.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-card border border-accent/20 text-accent rounded-md text-xs font-medium hover:bg-accent/10 transition-colors"
          >
            <Download size={12} />
            Share Result Card
          </button>
        )}

        {/* Timestamp */}
        <span className="text-xs text-muted-dark ml-auto flex items-center gap-1">
          <Clock size={10} />
          {new Date(challenge.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

export default function ChallengesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>}>
      <ChallengesPageInner />
    </Suspense>
  );
}
