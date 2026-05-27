'use client';

import { useEffect, useState } from 'react';
import { scoresAPI, betsAPI, insightsAPI, shareableAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { TrendingUp, TrendingDown, BarChart3, ChevronRight, Lock, Download } from 'lucide-react';
import Link from 'next/link';
import UpgradeBanner from '@/components/ui/UpgradeBanner';

interface Score {
  sport: string;
  score: string | null;
  is_unlocked: boolean;
  settled_bet_count: number;
  score_change_today?: string;
  win_rate?: string;
  roi?: string;
  locked?: boolean;
}

interface Stats {
  record: { wins: number; losses: number; pushes: number };
  roi: number;
  total_profit_loss: number;
  current_streak: { count: number; type: string };
  pending_count: number;
  by_sport: Record<string, { wins: number; losses: number; pushes: number }>;
  by_bet_type: Record<string, { wins: number; losses: number; pushes: number }>;
}

interface Insight {
  id: string;
  title: string;
  description: string;
  impact: string;
}

const SPORT_LABELS: Record<string, string> = {
  overall: 'Overall',
  nfl: 'NFL',
  nba: 'NBA',
  mlb: 'MLB',
  nhl: 'NHL',
  cfb: 'CFB',
  cbb: 'CBB',
  soccer: 'Soccer',
  prizepicks: 'PrizePicks',
  dfs: 'DFS',
};

const SPORT_ICONS: Record<string, string> = {
  nfl: '🏈',
  nba: '🏀',
  mlb: '⚾',
  nhl: '🏒',
  cfb: '🏟️',
  cbb: '🏀',
  soccer: '⚽',
  prizepicks: '🎯',
  dfs: '🏆',
};

function getScoreColor(score: number): string {
  if (score <= 40) return 'text-loss';
  if (score <= 60) return 'text-gold';
  if (score <= 75) return 'text-accent-light';
  if (score <= 90) return 'text-accent';
  return 'text-gold';
}

function getTierName(score: number): string {
  if (score <= 40) return 'Recreational';
  if (score <= 60) return 'Developing';
  if (score <= 75) return 'Sharp';
  if (score <= 90) return 'Elite';
  return 'Legend';
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [scores, setScores] = useState<Score[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [timeFilter, setTimeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<'free' | 'pro'>(user?.tier || 'free');
  const [cardStatus, setCardStatus] = useState<{ unlimited: boolean; cards_remaining: number | null } | null>(null);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [cardError, setCardError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [scoresRes, statsRes, insightsRes] = await Promise.all([
          scoresAPI.getAll().catch(() => ({ data: { scores: [], tier: 'free' } })),
          betsAPI.stats({ time: timeFilter }).catch(() => ({ data: null })),
          insightsAPI.get().catch(() => ({ data: { insights: [] } })),
        ]);
        setScores(scoresRes.data.scores || []);
        setStats(statsRes.data);
        setInsights(insightsRes.data?.insights || []);
        if (scoresRes.data.tier) setTier(scoresRes.data.tier);
      } catch {
        // handled by individual catches
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [timeFilter]);

  useEffect(() => {
    shareableAPI.cardStatus()
      .then(res => setCardStatus(res.data))
      .catch(() => {});
  }, []);

  const handleGenerateCard = async () => {
    setGeneratingCard(true);
    setCardError('');
    try {
      const res = await shareableAPI.generateCard('overall');
      const blob = new Blob([res.data], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gammbler-score.png`;
      a.click();
      URL.revokeObjectURL(url);
      // Refresh card status after generation
      shareableAPI.cardStatus().then(r => setCardStatus(r.data)).catch(() => {});
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: Blob } })?.response?.data;
      if (errData instanceof Blob) {
        const text = await errData.text();
        try { setCardError(JSON.parse(text).message || 'Failed to generate card'); } catch { setCardError('Failed to generate card'); }
      } else {
        setCardError('Failed to generate card');
      }
    } finally {
      setGeneratingCard(false);
    }
  };

  const overallScore = scores.find((s) => s.sport === 'overall');
  const sportScores = scores.filter((s) => s.sport !== 'overall');
  const scoreVal = overallScore?.score ? parseFloat(overallScore.score) : 0;
  const scoreChange = overallScore ? parseFloat(overallScore.score_change_today || '0') : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Overall Score Card */}
      <div className="bg-card border border-accent/20 rounded-lg p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Gammbler Score
            </p>
            {overallScore?.is_unlocked ? (
              <>
                <p className={`text-7xl font-bold ${getScoreColor(scoreVal)}`} style={{ fontFamily: 'var(--font-number)' }}>
                  {scoreVal.toFixed(1)}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`inline-flex items-center gap-1 text-sm ${scoreChange >= 0 ? 'text-win' : 'text-loss'}`}>
                    {scoreChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {scoreChange >= 0 ? '+' : ''}{scoreChange.toFixed(1)} this week
                  </span>
                  <span className="text-sm text-muted-dark">•</span>
                  <span className={`text-sm font-semibold ${getScoreColor(scoreVal)}`}>
                    {getTierName(scoreVal)}
                  </span>
                </div>
              </>
            ) : (
              <div>
                <p className="text-3xl font-bold text-muted-dark" style={{ fontFamily: 'var(--font-number)' }}>
                  Not enough data yet
                </p>
                <p className="text-sm text-muted-dark mt-1">
                  {overallScore?.settled_bet_count || 0}/10 bets needed
                </p>
                <div className="w-48 h-2 bg-background rounded-full mt-2">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${((overallScore?.settled_bet_count || 0) / 10) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-32 h-32 rounded-full border-4 border-accent/30 flex items-center justify-center">
              <span className={`text-4xl font-bold ${getScoreColor(scoreVal)}`} style={{ fontFamily: 'var(--font-number)' }}>
                {overallScore?.is_unlocked ? scoreVal.toFixed(0) : '?'}
              </span>
            </div>
            {overallScore?.is_unlocked && (
              <button
                onClick={handleGenerateCard}
                disabled={generatingCard || (cardStatus !== null && !cardStatus.unlimited && cardStatus.cards_remaining === 0)}
                className="flex items-center gap-2 px-4 py-2 bg-accent/20 text-accent rounded-lg text-xs font-semibold hover:bg-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <Download size={14} />
                {generatingCard ? 'GENERATING...' : 'SHARE SCORE'}
              </button>
            )}
            {cardStatus && !cardStatus.unlimited && (
              <p className="text-xs text-muted-dark">
                {cardStatus.cards_remaining === 0
                  ? 'Monthly card used — upgrade for unlimited'
                  : `${cardStatus.cards_remaining} free card this month`}
              </p>
            )}
            {cardError && <p className="text-xs text-loss">{cardError}</p>}
          </div>
        </div>
      </div>

      {/* Sport Scores Row */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {sportScores.map((s) => {
            const val = s.score ? parseFloat(s.score) : 0;
            const isLocked = s.locked;
            return (
              <div
                key={s.sport}
                className={`bg-card border rounded-lg p-4 min-w-[140px] ${
                  isLocked ? 'border-accent/10 opacity-60' : !s.is_unlocked ? 'border-accent/20 opacity-50' : 'border-accent/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{SPORT_ICONS[s.sport] || '🎲'}</span>
                  <span className="text-xs uppercase tracking-wider text-muted-dark font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                    {SPORT_LABELS[s.sport] || s.sport}
                  </span>
                  {isLocked && <Lock size={12} className="text-accent ml-auto" />}
                </div>
                {isLocked ? (
                  <p className="text-xs text-accent">Pro only</p>
                ) : s.is_unlocked ? (
                  <p className={`text-2xl font-bold ${getScoreColor(val)}`} style={{ fontFamily: 'var(--font-number)' }}>
                    {val.toFixed(1)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-dark">
                    {s.settled_bet_count}/10 bets needed
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {tier === 'free' && (
          <div className="mt-3">
            <UpgradeBanner feature="Unlock all 10 sport-specific scores" compact />
          </div>
        )}
      </div>

      {/* Quick Stats Row */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-card border border-accent/20 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wider text-muted-dark mb-1" style={{ fontFamily: 'var(--font-display)' }}>Record</p>
            <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-number)' }}>
              <span className="text-win">{stats.record.wins}</span>
              <span className="text-muted-dark">-</span>
              <span className="text-loss">{stats.record.losses}</span>
              <span className="text-muted-dark">-</span>
              <span className="text-muted">{stats.record.pushes}</span>
            </p>
          </div>
          <div className="bg-card border border-accent/20 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wider text-muted-dark mb-1" style={{ fontFamily: 'var(--font-display)' }}>ROI</p>
            <p className={`text-2xl font-bold ${stats.roi >= 0 ? 'text-win' : 'text-loss'}`} style={{ fontFamily: 'var(--font-number)' }}>
              {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
            </p>
          </div>
          <div className="bg-card border border-accent/20 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wider text-muted-dark mb-1" style={{ fontFamily: 'var(--font-display)' }}>Profit/Loss</p>
            <p className={`text-2xl font-bold ${stats.total_profit_loss >= 0 ? 'text-win' : 'text-loss'}`} style={{ fontFamily: 'var(--font-number)' }}>
              {stats.total_profit_loss >= 0 ? '+' : ''}${Math.abs(stats.total_profit_loss).toFixed(2)}
            </p>
          </div>
          <div className="bg-card border border-accent/20 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wider text-muted-dark mb-1" style={{ fontFamily: 'var(--font-display)' }}>Streak</p>
            <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-number)' }}>
              <span className={stats.current_streak.type === 'win' ? 'text-win' : 'text-loss'}>
                {stats.current_streak.count}
              </span>
              <span className="text-sm text-muted-dark ml-1">
                {stats.current_streak.type === 'win' ? 'W' : 'L'}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Time Filter */}
      <div className="flex gap-2">
        {['all', 'year', 'month', 'week'].map((t) => (
          <button
            key={t}
            onClick={() => setTimeFilter(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors uppercase tracking-wide ${
              timeFilter === t
                ? 'bg-accent text-background'
                : 'bg-card text-muted hover:text-white border border-accent/20'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t === 'all' ? 'All Time' : t === 'year' ? 'This Year' : t === 'month' ? 'This Month' : 'This Week'}
          </button>
        ))}
      </div>

      {/* Insights */}
      {tier === 'free' ? (
        <Link href="/dashboard/insights" className="block bg-card border border-accent/20 rounded-lg p-5 hover:border-accent/40 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <BarChart3 size={20} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Personalized Insights Waiting</p>
                <p className="text-xs text-muted-dark mt-0.5">See which sports you&apos;re strongest and weakest in — then unlock the full analysis with Pro</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-accent" />
          </div>
        </Link>
      ) : insights.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg uppercase tracking-wider font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Insights
            </h2>
            <Link href="/dashboard/insights" className="text-sm text-accent hover:text-accent-light flex items-center gap-1">
              View All <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.slice(0, 4).map((insight) => (
              <div
                key={insight.id}
                className={`bg-card border rounded-lg p-5 ${
                  insight.impact === 'high' ? 'border-loss/40' : 'border-accent/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    insight.impact === 'high' ? 'bg-loss/20' : 'bg-accent/20'
                  }`}>
                    <BarChart3 size={16} className={insight.impact === 'high' ? 'text-loss' : 'text-accent'} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">{insight.title}</p>
                    <p className="text-xs text-muted-dark leading-relaxed">{insight.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Breakdown by Sport */}
      {stats && Object.keys(stats.by_sport).length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg uppercase tracking-wider font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            By Sport
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.by_sport).map(([sport, data]) => (
              <div key={sport} className="bg-card border border-accent/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span>{SPORT_ICONS[sport] || '🎲'}</span>
                  <span className="text-xs uppercase tracking-wider text-muted-dark font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                    {SPORT_LABELS[sport] || sport}
                  </span>
                </div>
                <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-number)' }}>
                  <span className="text-win">{data.wins}</span>
                  <span className="text-muted-dark">-</span>
                  <span className="text-loss">{data.losses}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
