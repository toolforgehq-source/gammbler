'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { slipsAPI, cappersAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Share2, Flame, Skull, DollarSign, Frown, Trophy,
  ArrowLeft, Eye, Clock, CheckCircle, XCircle, Download,
  Copy, Trash2, Timer,
} from 'lucide-react';
import Link from 'next/link';

interface SlipDetail {
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
  user: {
    username: string;
    avatar_url: string | null;
    score: string | null;
  };
  reactions: Record<string, number>;
  user_reaction: string | null;
}

const REACTION_MAP: Record<string, { icon: typeof Flame; label: string }> = {
  fire: { icon: Flame, label: 'Fire' },
  skull: { icon: Skull, label: 'Dead' },
  money: { icon: DollarSign, label: 'Money' },
  clown: { icon: Frown, label: 'Clown' },
  goat: { icon: Trophy, label: 'GOAT' },
};

const SPORT_LABELS: Record<string, string> = {
  overall: 'Overall', nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL',
  cfb: 'CFB', cbb: 'CBB', soccer: 'Soccer', prizepicks: 'PrizePicks', dfs: 'DFS',
};

export default function SlipDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [slip, setSlip] = useState<SlipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [settleResult, setSettleResult] = useState('');

  useEffect(() => {
    fetchSlip();
  }, [id]);

  async function fetchSlip() {
    try {
      const res = await slipsAPI.get(id as string);
      setSlip(res.data.slip);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }

  async function handleReact(reaction: string) {
    if (!slip) return;
    try {
      await slipsAPI.react(slip.id, reaction);
      fetchSlip();
    } catch {
      // handled
    }
  }

  async function handleSettle() {
    if (!slip || !settleResult) return;
    setSettling(true);
    try {
      await slipsAPI.settle(slip.id, { result: settleResult });
      fetchSlip();
      setSettleResult('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to settle');
    } finally {
      setSettling(false);
    }
  }

  async function handleDelete() {
    if (!slip || !confirm('Delete this bet slip?')) return;
    try {
      await slipsAPI.delete(slip.id);
      router.push('/dashboard/slips');
    } catch {
      // handled
    }
  }

  async function handleShare() {
    if (!slip) return;
    const url = `${window.location.origin}/dashboard/slips/${slip.id}`;
    try {
      await navigator.clipboard.writeText(url);
      await slipsAPI.share(slip.id);
      alert('Link copied to clipboard!');
    } catch {
      // handled
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!slip) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-dark text-lg">Slip not found</p>
        <Link href="/dashboard/slips" className="text-accent mt-4 inline-block">Back to Slips</Link>
      </div>
    );
  }

  const oddsVal = parseFloat(slip.odds);
  const oddsStr = oddsVal > 0 ? `+${oddsVal}` : String(oddsVal);
  const stakeVal = parseFloat(slip.stake);
  const pl = slip.profit_loss ? parseFloat(slip.profit_loss) : null;
  const isOwner = user?.id === slip.user_id;
  const scoreVal = slip.user.score ? parseFloat(slip.user.score) : null;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back */}
      <Link href="/dashboard/slips" className="text-muted-dark hover:text-white flex items-center gap-1 text-sm">
        <ArrowLeft size={16} /> Back to Slips
      </Link>

      {/* Main Card */}
      <div className="bg-card border border-accent/20 rounded-xl p-6">
        {/* Status banner */}
        <div className={`flex items-center justify-between mb-5 pb-4 border-b border-accent/10`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center text-accent font-bold">
              {slip.user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <Link href={`/dashboard/profile?user=${slip.user.username}`} className="text-white font-medium hover:text-accent">
                @{slip.user.username}
              </Link>
              {scoreVal !== null && (
                <p className="text-xs text-muted-dark">Score: {scoreVal.toFixed(1)}</p>
              )}
            </div>
          </div>
          <div className={`px-4 py-1.5 rounded-full font-bold text-sm ${
            slip.status === 'live' ? 'bg-accent/10 text-accent animate-pulse'
            : slip.status === 'won' ? 'bg-win/10 text-win'
            : slip.status === 'lost' ? 'bg-loss/10 text-loss'
            : 'bg-gold/10 text-gold'
          }`}>
            {slip.status === 'live' && <Clock size={14} className="inline mr-1" />}
            {slip.status === 'won' && <CheckCircle size={14} className="inline mr-1" />}
            {slip.status === 'lost' && <XCircle size={14} className="inline mr-1" />}
            {slip.status.toUpperCase()}
          </div>
        </div>

        {/* Content */}
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          {slip.title}
        </h1>
        <p className="text-lg text-muted mb-1">{slip.selection}</p>
        {slip.event_name && <p className="text-muted-dark">{slip.event_name}</p>}
        {slip.description && <p className="text-muted-dark mt-3 text-sm">{slip.description}</p>}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-dark uppercase tracking-wider">Odds</p>
            <p className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-number)' }}>{oddsStr}</p>
          </div>
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-dark uppercase tracking-wider">Stake</p>
            <p className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-number)' }}>${stakeVal.toFixed(2)}</p>
          </div>
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-dark uppercase tracking-wider">Sport</p>
            <p className="text-accent font-semibold">{SPORT_LABELS[slip.sport] || slip.sport.toUpperCase()}</p>
          </div>
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-dark uppercase tracking-wider">P/L</p>
            <p className={`text-xl font-bold ${pl === null ? 'text-muted-dark' : pl >= 0 ? 'text-win' : 'text-loss'}`} style={{ fontFamily: 'var(--font-number)' }}>
              {pl === null ? '—' : `${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}`}
            </p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex gap-2 mt-4">
          <span className="px-2 py-1 bg-accent/10 text-accent text-xs rounded-full">{slip.bet_type.replace('_', ' ').toUpperCase()}</span>
          <span className="px-2 py-1 bg-secondary text-muted-dark text-xs rounded-full">{slip.platform.toUpperCase()}</span>
          {slip.parlay_legs && (
            <span className="px-2 py-1 bg-gold/10 text-gold text-xs rounded-full">{slip.parlay_legs}-LEG PARLAY</span>
          )}
        </div>

        {/* Reactions */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-accent/10">
          <div className="flex gap-2">
            {Object.entries(REACTION_MAP).map(([key, { icon: Icon }]) => {
              const count = slip.reactions[key] || 0;
              const isActive = slip.user_reaction === key;
              return (
                <button
                  key={key}
                  onClick={() => handleReact(key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    isActive ? 'bg-accent/20 text-accent' : 'bg-secondary text-muted-dark hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  {count > 0 && <span>{count}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <span className="text-xs text-muted-dark flex items-center gap-1"><Eye size={12} /> {slip.views_count}</span>
          <span className="text-xs text-muted-dark flex items-center gap-1"><Share2 size={12} /> {slip.shares_count}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent-light transition-colors"
          >
            <Copy size={16} /> Copy Link
          </button>
          <a
            href={slipsAPI.cardUrl(slip.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-accent/20 text-muted rounded-lg hover:text-white hover:border-accent/40 transition-colors"
          >
            <Download size={16} /> Download Card
          </a>
          {isOwner && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 border border-loss/20 text-loss rounded-lg hover:bg-loss/10 transition-colors ml-auto"
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>

        {/* Auto-settle notice (live slips) */}
        {slip.status === 'live' && (
          <div className="mt-6 pt-4 border-t border-accent/10">
            <div className="flex items-center gap-2 text-sm text-accent">
              <Timer size={16} />
              <span>This bet will be settled automatically when the game ends</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
