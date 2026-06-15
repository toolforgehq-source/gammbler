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

const SPORTS = [
  { value: 'nfl', label: 'NFL' },
  { value: 'nba', label: 'NBA' },
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
  { value: 'cfb', label: 'CFB' },
  { value: 'cbb', label: 'CBB' },
  { value: 'soccer', label: 'Soccer' },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    accepted: 'bg-blue-500/20 text-blue-400',
    declined: 'bg-red-500/20 text-red-400',
    settled: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-gray-500/20 text-gray-400',
    expired: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}

function ChallengesPageInner() {
  const searchParams = useSearchParams();
  const opponentParam = searchParams.get('opponent');
  const { user } = useAuthStore();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<H2HStats>({ wins: 0, losses: 0, draws: 0, pending_received: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'pending' | 'active' | 'settled'>('all');
  const [showCreate, setShowCreate] = useState(!!opponentParam);

  // Create form state
  const [searchQuery, setSearchQuery] = useState(opponentParam || '');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [sport, setSport] = useState('nfl');
  const [eventName, setEventName] = useState('');
  const [challengerPick, setChallengerPick] = useState('');
  const [message, setMessage] = useState('');
  const [stakeDisplay, setStakeDisplay] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Accept modal
  const [acceptingChallenge, setAcceptingChallenge] = useState<Challenge | null>(null);
  const [acceptPick, setAcceptPick] = useState('');

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
        setChallenges(challengesRes.data.challenges || []);
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
      const clear = () => setSearchResults([]);
      clear();
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

  async function handleCreate() {
    if (!selectedUser || !eventName || !challengerPick) return;
    setCreating(true);
    setCreateError('');
    try {
      await challengesAPI.create({
        challengee_username: selectedUser.username,
        sport,
        event_name: eventName,
        challenger_pick: challengerPick,
        message: message || undefined,
        stake_display: stakeDisplay || undefined,
      });
      setShowCreate(false);
      setSelectedUser(null);
      setSearchQuery('');
      setEventName('');
      setChallengerPick('');
      setMessage('');
      setStakeDisplay('');
      refresh();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setCreateError(axiosErr.response?.data?.error || 'Failed to create challenge');
    } finally {
      setCreating(false);
    }
  }

  async function handleAccept() {
    if (!acceptingChallenge || !acceptPick) return;
    try {
      await challengesAPI.accept(acceptingChallenge.id, acceptPick);
      setAcceptingChallenge(null);
      setAcceptPick('');
      refresh();
    } catch {
      // ignore
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
          onClick={() => setShowCreate(true)}
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
        {challenges.length === 0 ? (
          <div className="bg-card border border-accent/20 rounded-lg p-12 text-center">
            <Target size={40} className="text-muted-dark mx-auto mb-4" />
            <p className="text-muted-dark">No challenges yet. Send one!</p>
          </div>
        ) : (
          challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              userId={user?.id || ''}
              onAccept={(c) => { setAcceptingChallenge(c); setAcceptPick(''); }}
              onDecline={handleDecline}
              onCancel={handleCancel}
              onSettle={(c) => setSettlingChallenge(c)}
              onDownloadCard={handleDownloadH2HCard}
            />
          ))
        )}
      </div>

      {/* Create Challenge Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-secondary border border-accent/20 rounded-xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>New Challenge</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-dark hover:text-white">
                <X size={20} />
              </button>
            </div>

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
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-accent/20 rounded-lg overflow-hidden z-10">
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

            {/* Game / Event */}
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

            {/* Your Pick */}
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

            {/* Bragging Rights / Stakes */}
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

            {/* Message */}
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
              disabled={creating || !selectedUser || !eventName || !challengerPick}
              className="w-full flex items-center justify-center gap-2 bg-accent text-background py-3 rounded-lg font-semibold hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <Send size={16} />
              {creating ? 'Sending...' : 'Send Challenge'}
            </button>
          </div>
        </div>
      )}

      {/* Accept Challenge Modal */}
      {acceptingChallenge && (
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
                onClick={handleAccept}
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

      {/* Settle Challenge Modal */}
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
  const isSettled = challenge.status === 'settled';

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
        <StatusBadge status={challenge.status} />
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-dark uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            {challenge.sport.toUpperCase()}
          </span>
          <span className="text-sm text-white font-medium">{challenge.event_name}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-lg p-2">
            <p className="text-xs text-muted-dark">@{challenge.challenger?.username}&apos;s pick</p>
            <p className="text-sm text-white font-semibold">{challenge.challenger_pick}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2">
            <p className="text-xs text-muted-dark">@{challenge.challengee?.username}&apos;s pick</p>
            <p className="text-sm text-white font-semibold">{challenge.challengee_pick || 'Waiting...'}</p>
          </div>
        </div>

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
              Accept
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

        {/* Accepted → Settle */}
        {isAccepted && (
          <button
            onClick={() => onSettle(challenge)}
            className="flex items-center gap-1 px-3 py-1.5 bg-accent text-background rounded-md text-xs font-semibold hover:bg-accent-light transition-colors"
          >
            <Trophy size={12} />
            Settle
          </button>
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
