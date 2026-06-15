'use client';

import { useEffect, useState } from 'react';
import { slipsAPI, cappersAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Share2, Flame, Skull, DollarSign, Frown, Trophy,
  Plus, Eye, ExternalLink, Clock, CheckCircle, XCircle,
} from 'lucide-react';
import Link from 'next/link';

interface SlipUser {
  username: string;
  avatar_url: string | null;
}

interface Slip {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  sport: string;
  bet_type: string;
  selection: string;
  odds: string;
  stake: string;
  platform: string;
  status: string;
  event_name: string | null;
  parlay_legs: number | null;
  profit_loss: string | null;
  views_count: number;
  shares_count: number;
  shared_at: string;
  settled_at: string | null;
  user: SlipUser;
  reactions: Record<string, number>;
  user_reaction: string | null;
  is_verified_capper: boolean;
  capper_tier: 'capper' | 'verified' | 'elite' | null;
}

const REACTION_MAP: Record<string, { icon: typeof Flame; label: string }> = {
  fire: { icon: Flame, label: 'Fire' },
  skull: { icon: Skull, label: 'Dead' },
  money: { icon: DollarSign, label: 'Money' },
  clown: { icon: Frown, label: 'Clown' },
  goat: { icon: Trophy, label: 'GOAT' },
};

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  live: { color: 'text-accent', icon: Clock, label: 'LIVE' },
  won: { color: 'text-win', icon: CheckCircle, label: 'WON' },
  lost: { color: 'text-loss', icon: XCircle, label: 'LOST' },
  pushed: { color: 'text-gold', icon: CheckCircle, label: 'PUSH' },
  void: { color: 'text-muted-dark', icon: XCircle, label: 'VOID' },
};

const SPORT_LABELS: Record<string, string> = {
  overall: 'Overall', nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL',
  cfb: 'CFB', cbb: 'CBB', soccer: 'Soccer', prizepicks: 'PrizePicks', dfs: 'DFS',
};

function formatOdds(odds: string): string {
  const val = parseFloat(odds);
  return val > 0 ? `+${val}` : String(val);
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function SlipsPage() {
  const { user } = useAuthStore();
  const [slips, setSlips] = useState<Slip[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchSlips();
  }, [sportFilter, statusFilter]);

  async function fetchSlips() {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (sportFilter) params.sport = sportFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await slipsAPI.feed(params);
      setSlips(res.data.slips || []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }

  async function handleReaction(slipId: string, reaction: string) {
    try {
      await slipsAPI.react(slipId, reaction);
      fetchSlips();
    } catch {
      // handled
    }
  }

  async function handleTail(slipId: string) {
    try {
      await cappersAPI.tail(slipId);
      alert('Bet tailed! Check your sportsbook to place the same bet.');
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string; subscribe?: boolean } } })?.response?.data;
      if (errData?.subscribe) {
        alert('Subscribe to this capper to tail their bets.');
      } else {
        alert(errData?.error || 'Failed to tail');
      }
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            LIVE BET SLIPS
          </h1>
          <p className="text-muted-dark text-sm mt-1">Watch bets resolve in real-time</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent-light transition-colors shrink-0"
        >
          <Plus size={18} />
          <span style={{ fontFamily: 'var(--font-display)' }} className="text-sm sm:text-base">SHARE A BET</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className="bg-card border border-accent/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
        >
          <option value="">All Sports</option>
          {Object.entries(SPORT_LABELS).filter(([k]) => k !== 'overall').map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-card border border-accent/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
        >
          <option value="">All Status</option>
          <option value="live">Live</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      {/* Create Slip Modal */}
      {showCreate && (
        <CreateSlipModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchSlips(); }}
        />
      )}

      {/* Slips Feed */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : slips.length === 0 ? (
        <div className="bg-card border border-accent/20 rounded-lg p-12 text-center">
          <Share2 size={48} className="mx-auto text-muted-dark mb-4" />
          <p className="text-muted-dark text-lg">No bet slips yet</p>
          <p className="text-muted-dark text-sm mt-1">Be the first to share a bet!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {slips.map((slip) => (
            <SlipCard
              key={slip.id}
              slip={slip}
              currentUserId={user?.id}
              onReact={handleReaction}
              onTail={handleTail}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlipCard({
  slip,
  currentUserId,
  onReact,
  onTail,
}: {
  slip: Slip;
  currentUserId?: string;
  onReact: (slipId: string, reaction: string) => void;
  onTail: (slipId: string) => void;
}) {
  const statusCfg = STATUS_CONFIG[slip.status] || STATUS_CONFIG.live;
  const StatusIcon = statusCfg.icon;
  const oddsStr = formatOdds(slip.odds);
  const pl = slip.profit_loss ? parseFloat(slip.profit_loss) : null;

  return (
    <div className="bg-card border border-accent/20 rounded-lg p-5 hover:border-accent/40 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/30 flex items-center justify-center text-accent font-bold text-sm">
            {slip.user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/dashboard/profile?user=${slip.user.username}`} className="text-white font-medium hover:text-accent transition-colors">
                @{slip.user.username}
              </Link>
              {slip.capper_tier === 'elite' && (
                <span className="px-2 py-0.5 bg-gold/20 text-gold text-xs font-semibold rounded-full">ELITE CAPPER</span>
              )}
              {slip.capper_tier === 'verified' && (
                <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs font-semibold rounded-full">VERIFIED</span>
              )}
              {slip.capper_tier === 'capper' && (
                <span className="px-2 py-0.5 bg-secondary text-muted text-xs font-semibold rounded-full">CAPPER</span>
              )}
            </div>
            <p className="text-xs text-muted-dark">{timeAgo(slip.shared_at)}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${statusCfg.color} ${slip.status === 'live' ? 'bg-accent/10 animate-pulse' : slip.status === 'won' ? 'bg-win/10' : slip.status === 'lost' ? 'bg-loss/10' : 'bg-gold/10'}`}>
          <StatusIcon size={14} />
          {statusCfg.label}
        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          {slip.title}
        </h3>
        <p className="text-muted mt-1">{slip.selection}</p>
        {slip.event_name && (
          <p className="text-muted-dark text-sm mt-1">{slip.event_name}</p>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-6 mb-4">
        <div>
          <span className="text-xs text-muted-dark uppercase tracking-wider">Odds</span>
          <p className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-number)' }}>{oddsStr}</p>
        </div>
        <div>
          <span className="text-xs text-muted-dark uppercase tracking-wider">Stake</span>
          <p className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-number)' }}>${parseFloat(slip.stake).toFixed(0)}</p>
        </div>
        {pl !== null && (
          <div>
            <span className="text-xs text-muted-dark uppercase tracking-wider">P/L</span>
            <p className={`font-bold text-lg ${pl >= 0 ? 'text-win' : 'text-loss'}`} style={{ fontFamily: 'var(--font-number)' }}>
              {pl >= 0 ? '+' : ''}{pl.toFixed(2)}
            </p>
          </div>
        )}
        <div>
          <span className="text-xs text-muted-dark uppercase tracking-wider">Sport</span>
          <p className="text-accent text-sm font-semibold">{SPORT_LABELS[slip.sport] || slip.sport.toUpperCase()}</p>
        </div>
        {slip.parlay_legs && (
          <div>
            <span className="text-xs text-muted-dark uppercase tracking-wider">Legs</span>
            <p className="text-gold font-bold text-lg" style={{ fontFamily: 'var(--font-number)' }}>{slip.parlay_legs}</p>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="flex gap-2 mb-4">
        <span className="px-2 py-1 bg-accent/10 text-accent text-xs rounded-full">{slip.bet_type.replace('_', ' ').toUpperCase()}</span>
        <span className="px-2 py-1 bg-secondary text-muted-dark text-xs rounded-full">{slip.platform.toUpperCase()}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-accent/10">
        <div className="flex gap-2">
          {Object.entries(REACTION_MAP).map(([key, { icon: Icon }]) => {
            const count = slip.reactions[key] || 0;
            const isActive = slip.user_reaction === key;
            return (
              <button
                key={key}
                onClick={() => onReact(slip.id, key)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                  isActive ? 'bg-accent/20 text-accent' : 'bg-secondary text-muted-dark hover:text-white'
                }`}
              >
                <Icon size={14} />
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-dark flex items-center gap-1">
            <Eye size={12} /> {slip.views_count}
          </span>
          {slip.capper_tier && slip.status === 'live' && slip.user_id !== currentUserId && (
            <button
              onClick={() => onTail(slip.id)}
              className="px-3 py-1.5 bg-gold text-background rounded-lg text-xs font-bold hover:bg-gold/80 transition-colors"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              TAIL THIS
            </button>
          )}
          <Link
            href={`/dashboard/slips/${slip.id}`}
            className="text-xs text-accent hover:text-accent-light flex items-center gap-1"
          >
            <ExternalLink size={12} /> View
          </Link>
        </div>
      </div>
    </div>
  );
}

function CreateSlipModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    sport: 'nfl',
    bet_type: 'spread',
    selection: '',
    odds: '',
    stake: '',
    platform: 'draftkings',
    event_name: '',
    parlay_legs: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await slipsAPI.create({
        title: form.title,
        description: form.description || undefined,
        sport: form.sport,
        bet_type: form.bet_type,
        selection: form.selection,
        odds: parseFloat(form.odds),
        stake: parseFloat(form.stake),
        platform: form.platform,
        event_name: form.event_name || undefined,
        parlay_legs: form.parlay_legs ? parseInt(form.parlay_legs) : undefined,
      });
      onCreated();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string } } })?.response?.data;
      setError(errData?.error || 'Failed to create slip');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-accent/20 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>SHARE A BET SLIP</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted-dark uppercase tracking-wider mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Chiefs -3.5 Lock of the Week"
              className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-dark uppercase tracking-wider mb-1">Sport</label>
              <select
                value={form.sport}
                onChange={(e) => setForm({ ...form, sport: e.target.value })}
                className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
              >
                {['nfl','nba','mlb','nhl','cfb','cbb','soccer','prizepicks','dfs'].map(s => (
                  <option key={s} value={s}>{SPORT_LABELS[s] || s.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-dark uppercase tracking-wider mb-1">Bet Type</label>
              <select
                value={form.bet_type}
                onChange={(e) => setForm({ ...form, bet_type: e.target.value })}
                className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
              >
                {['spread','moneyline','over_under','parlay','prop','player_prop','teaser','futures','other'].map(t => (
                  <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-dark uppercase tracking-wider mb-1">Selection</label>
            <input
              type="text"
              value={form.selection}
              onChange={(e) => setForm({ ...form, selection: e.target.value })}
              placeholder="e.g. Kansas City Chiefs -3.5"
              className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-muted-dark uppercase tracking-wider mb-1">Event</label>
            <input
              type="text"
              value={form.event_name}
              onChange={(e) => setForm({ ...form, event_name: e.target.value })}
              placeholder="e.g. Chiefs vs Bills - Sunday 1:00 PM"
              className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-dark uppercase tracking-wider mb-1">Odds</label>
              <input
                type="number"
                value={form.odds}
                onChange={(e) => setForm({ ...form, odds: e.target.value })}
                placeholder="-110"
                className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-dark uppercase tracking-wider mb-1">Stake ($)</label>
              <input
                type="number"
                value={form.stake}
                onChange={(e) => setForm({ ...form, stake: e.target.value })}
                placeholder="100"
                className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-dark uppercase tracking-wider mb-1">Parlay Legs</label>
              <input
                type="number"
                value={form.parlay_legs}
                onChange={(e) => setForm({ ...form, parlay_legs: e.target.value })}
                placeholder="—"
                className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-dark uppercase tracking-wider mb-1">Platform</label>
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
            >
              {['draftkings','fanduel','betmgm','caesars','espn_bet','pointsbet','prizepicks','underdog','other'].map(p => (
                <option key={p} value={p}>{p.replace('_', ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted-dark uppercase tracking-wider mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Why you like this bet..."
              rows={2}
              className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent resize-none"
            />
          </div>

          {error && <p className="text-loss text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-accent/20 rounded-lg text-muted hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
            >
              {submitting ? 'Sharing...' : 'Share Bet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
