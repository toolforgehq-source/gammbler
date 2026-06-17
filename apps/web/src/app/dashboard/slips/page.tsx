'use client';

import { useEffect, useState } from 'react';
import { slipsAPI, betsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Share2, Flame, Skull, DollarSign, Frown, Trophy,
  Plus, Clock, CheckCircle, XCircle, Download, Link2,
  TrendingUp, TrendingDown, Filter, BarChart3,
} from 'lucide-react';
import Link from 'next/link';

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
  user?: { username: string; avatar_url: string | null };
  reactions?: Record<string, number>;
  user_reaction?: string | null;
  is_verified_capper?: boolean;
  capper_tier?: 'capper' | 'verified' | 'elite' | null;
}

interface BetRecord {
  id: string;
  sport: string;
  bet_type: string;
  selection: string;
  odds: string;
  stake: string;
  platform: string;
  result: string;
  profit_loss: string | null;
  event_name: string | null;
  parlay_legs: number | null;
  created_at: string;
  settled_at: string | null;
  is_pregame_verified: boolean;
  trust_status?: 'synced_verified' | 'manually_validated' | 'manual_unverified';
}

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: typeof Clock; label: string }> = {
  pending: { color: 'text-accent', bgColor: 'bg-accent/10', icon: Clock, label: 'PENDING' },
  live: { color: 'text-accent', bgColor: 'bg-accent/10', icon: Clock, label: 'LIVE' },
  win: { color: 'text-win', bgColor: 'bg-win/10', icon: CheckCircle, label: 'WON' },
  won: { color: 'text-win', bgColor: 'bg-win/10', icon: CheckCircle, label: 'WON' },
  loss: { color: 'text-loss', bgColor: 'bg-loss/10', icon: XCircle, label: 'LOST' },
  lost: { color: 'text-loss', bgColor: 'bg-loss/10', icon: XCircle, label: 'LOST' },
  push: { color: 'text-gold', bgColor: 'bg-gold/10', icon: CheckCircle, label: 'PUSH' },
  pushed: { color: 'text-gold', bgColor: 'bg-gold/10', icon: CheckCircle, label: 'PUSH' },
  void: { color: 'text-muted-dark', bgColor: 'bg-muted-dark/10', icon: XCircle, label: 'VOID' },
};

const SPORT_LABELS: Record<string, string> = {
  nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL',
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
  const [view, setView] = useState<'bets' | 'slips'>('bets');
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [stats, setStats] = useState<{ wins: number; losses: number; pushes: number; pending: number; totalPL: number; roi: number } | null>(null);

  useEffect(() => {
    if (view === 'bets') {
      fetchBets();
    } else {
      fetchSlips();
    }
  }, [view, statusFilter, sportFilter]);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchBets() {
    try {
      setLoading(true);
      const params: Record<string, string> = { limit: '50' };
      if (sportFilter) params.sport = sportFilter;
      if (statusFilter) params.result = statusFilter;
      const res = await betsAPI.list(params);
      setBets(res.data.bets || []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }

  async function fetchSlips() {
    try {
      setLoading(true);
      const res = await slipsAPI.mine();
      setSlips(res.data.slips || []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await betsAPI.stats();
      const data = res.data;
      setStats({
        wins: data.record.wins,
        losses: data.record.losses,
        pushes: data.record.pushes,
        pending: data.pending_count,
        totalPL: data.total_profit_loss,
        roi: data.roi,
      });
    } catch {
      // handled
    }
  }

  async function handleSettle(betId: string, result: string) {
    try {
      await betsAPI.settle(betId, result);
      fetchBets();
      fetchStats();
    } catch {
      // handled
    }
  }

  async function handleShareSlip(betId: string, bet: BetRecord) {
    try {
      await slipsAPI.create({
        title: bet.selection,
        sport: bet.sport,
        bet_type: bet.bet_type,
        selection: bet.selection,
        odds: parseFloat(bet.odds),
        stake: parseFloat(bet.stake),
        platform: bet.platform,
        event_name: bet.event_name || undefined,
        parlay_legs: bet.parlay_legs || undefined,
        bet_id: betId,
      });
      alert('Bet shared to community!');
    } catch {
      alert('Failed to share bet');
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            MY BETS
          </h1>
          <p className="text-muted-dark text-sm mt-1">Track your bets, settle results, and share wins</p>
        </div>
        <Link
          href="/dashboard/add-bet"
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent-light transition-colors shrink-0"
        >
          <Plus size={18} />
          <span style={{ fontFamily: 'var(--font-display)' }} className="text-sm sm:text-base">ADD BET</span>
        </Link>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-accent/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-dark uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>Record</p>
            <p className="text-white font-bold text-lg mt-1" style={{ fontFamily: 'var(--font-number)' }}>
              {stats.wins}-{stats.losses}-{stats.pushes}
            </p>
          </div>
          <div className="bg-card border border-accent/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-dark uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>P/L</p>
            <p className={`font-bold text-lg mt-1 ${stats.totalPL >= 0 ? 'text-win' : 'text-loss'}`} style={{ fontFamily: 'var(--font-number)' }}>
              {stats.totalPL >= 0 ? '+' : ''}${stats.totalPL.toFixed(2)}
            </p>
          </div>
          <div className="bg-card border border-accent/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-dark uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>ROI</p>
            <p className={`font-bold text-lg mt-1 ${stats.roi >= 0 ? 'text-win' : 'text-loss'}`} style={{ fontFamily: 'var(--font-number)' }}>
              {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
            </p>
          </div>
          <div className="bg-card border border-accent/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-dark uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>Pending</p>
            <p className="text-accent font-bold text-lg mt-1" style={{ fontFamily: 'var(--font-number)' }}>
              {stats.pending}
            </p>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setView('bets')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              view === 'bets' ? 'bg-accent text-background' : 'bg-card text-muted border border-accent/20'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            MY BETS
          </button>
          <button
            onClick={() => setView('slips')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              view === 'slips' ? 'bg-accent text-background' : 'bg-card text-muted border border-accent/20'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            SHARED SLIPS
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 ml-auto flex-wrap">
          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            className="bg-card border border-accent/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
          >
            <option value="">All Sports</option>
            {Object.entries(SPORT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          {view === 'bets' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-card border border-accent/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="win">Won</option>
              <option value="loss">Lost</option>
              <option value="push">Push</option>
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'bets' ? (
        bets.length === 0 ? (
          <div className="bg-card border border-accent/20 rounded-lg p-12 text-center">
            <BarChart3 size={48} className="mx-auto text-muted-dark mb-4" />
            <p className="text-muted-dark text-lg">No bets yet</p>
            <p className="text-muted-dark text-sm mt-1">Add your first bet to start tracking your performance</p>
            <Link
              href="/dashboard/add-bet"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-accent text-background rounded-lg font-semibold"
            >
              <Plus size={16} /> Add Bet
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bets.map((bet) => {
              const statusCfg = STATUS_CONFIG[bet.result] || STATUS_CONFIG.pending;
              const StatusIcon = statusCfg.icon;
              const pl = bet.profit_loss ? parseFloat(bet.profit_loss) : null;
              const isPending = bet.result === 'pending';

              return (
                <div key={bet.id} className="bg-card border border-accent/20 rounded-lg p-4 hover:border-accent/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusCfg.color} ${statusCfg.bgColor}`}>
                          <StatusIcon size={10} />
                          {statusCfg.label}
                        </span>
                        <span className="text-[10px] text-muted-dark uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                          {bet.sport.toUpperCase()}
                        </span>
                        {bet.trust_status === 'synced_verified' ? (
                          <span className="text-[10px] text-accent flex items-center gap-0.5">✓ Synced</span>
                        ) : bet.trust_status === 'manually_validated' ? (
                          <span className="text-[10px] text-accent flex items-center gap-0.5">✓ Validated</span>
                        ) : bet.trust_status === 'manual_unverified' ? (
                          <span className="text-[10px] text-yellow-400 flex items-center gap-0.5">⚠ Unverified</span>
                        ) : bet.is_pregame_verified ? (
                          <span className="text-[10px] text-accent">Verified</span>
                        ) : null}
                      </div>
                      <p className="text-white font-medium text-sm truncate">{bet.selection}</p>
                      {bet.event_name && (
                        <p className="text-xs text-muted-dark mt-0.5 truncate">{bet.event_name}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-accent font-bold text-sm" style={{ fontFamily: 'var(--font-number)' }}>
                        {formatOdds(bet.odds)}
                      </p>
                      <p className="text-xs text-muted-dark">${parseFloat(bet.stake).toFixed(0)}</p>
                      {pl !== null && !isPending && (
                        <p className={`text-xs font-bold ${pl >= 0 ? 'text-win' : 'text-loss'}`} style={{ fontFamily: 'var(--font-number)' }}>
                          {pl >= 0 ? '+' : ''}{pl.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-accent/10">
                    <span className="text-[10px] text-muted-dark">{timeAgo(bet.created_at)}</span>
                    <div className="flex items-center gap-2">
                      {isPending && (
                        <>
                          <button
                            onClick={() => handleSettle(bet.id, 'win')}
                            className="px-2 py-1 text-[10px] font-bold text-win bg-win/10 rounded hover:bg-win/20 transition-colors"
                          >
                            WON
                          </button>
                          <button
                            onClick={() => handleSettle(bet.id, 'loss')}
                            className="px-2 py-1 text-[10px] font-bold text-loss bg-loss/10 rounded hover:bg-loss/20 transition-colors"
                          >
                            LOST
                          </button>
                          <button
                            onClick={() => handleSettle(bet.id, 'push')}
                            className="px-2 py-1 text-[10px] font-bold text-gold bg-gold/10 rounded hover:bg-gold/20 transition-colors"
                          >
                            PUSH
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleShareSlip(bet.id, bet)}
                        className="px-2 py-1 text-[10px] font-bold text-accent bg-accent/10 rounded hover:bg-accent/20 transition-colors flex items-center gap-1"
                      >
                        <Share2 size={10} /> SHARE
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Shared Slips View */
        slips.length === 0 ? (
          <div className="bg-card border border-accent/20 rounded-lg p-12 text-center">
            <Share2 size={48} className="mx-auto text-muted-dark mb-4" />
            <p className="text-muted-dark text-lg">No shared slips yet</p>
            <p className="text-muted-dark text-sm mt-1">Share a bet to the community for reactions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {slips.map((slip) => {
              const statusCfg = STATUS_CONFIG[slip.status] || STATUS_CONFIG.live;
              const StatusIcon = statusCfg.icon;
              const pl = slip.profit_loss ? parseFloat(slip.profit_loss) : null;

              return (
                <div key={slip.id} className="bg-card border border-accent/20 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusCfg.color} ${statusCfg.bgColor}`}>
                          <StatusIcon size={10} />
                          {statusCfg.label}
                        </span>
                        <span className="text-[10px] text-muted-dark uppercase tracking-wider">
                          {slip.sport.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-white font-medium text-sm">{slip.title}</p>
                      <p className="text-xs text-muted-dark mt-0.5">{slip.selection}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-accent font-bold text-sm" style={{ fontFamily: 'var(--font-number)' }}>
                        {formatOdds(slip.odds)}
                      </p>
                      <p className="text-xs text-muted-dark">${parseFloat(slip.stake).toFixed(0)}</p>
                      {pl !== null && (
                        <p className={`text-xs font-bold ${pl >= 0 ? 'text-win' : 'text-loss'}`} style={{ fontFamily: 'var(--font-number)' }}>
                          {pl >= 0 ? '+' : ''}{pl.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-accent/10">
                    <span className="text-[10px] text-muted-dark">
                      {slip.views_count} views · {slip.shares_count} shares · {timeAgo(slip.shared_at)}
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/slips/${slip.id}`); }}
                      className="px-2 py-1 text-[10px] font-bold text-accent bg-accent/10 rounded hover:bg-accent/20 transition-colors flex items-center gap-1"
                    >
                      <Link2 size={10} /> COPY LINK
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
