'use client';

import { useEffect, useState } from 'react';
import { insightsAPI, betsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, Lock, Zap } from 'lucide-react';
import Link from 'next/link';

interface Insight {
  id: string;
  title: string;
  description: string;
  impact: string;
  category: string;
}

interface WeeklyReport {
  id: string;
  period_start: string;
  period_end: string;
  report_data: Record<string, unknown>;
  created_at: string;
}

interface SportRecord {
  wins: number;
  losses: number;
  pushes: number;
}

const SPORT_LABELS: Record<string, string> = {
  nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL',
  cfb: 'CFB', cbb: 'CBB', soccer: 'Soccer',
  prizepicks: 'PrizePicks', dfs: 'DFS',
};

function computeWinRate(record: SportRecord): number {
  const total = record.wins + record.losses;
  if (total === 0) return 0;
  return record.wins / total;
}

export default function InsightsPage() {
  const { user } = useAuthStore();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [bySport, setBySport] = useState<Record<string, SportRecord>>({});
  const isFree = user?.tier === 'free' || (!user?.tier && user?.subscription_status !== 'active' && user?.subscription_status !== 'trialing');

  useEffect(() => {
    const fetches: Promise<unknown>[] = [
      betsAPI.stats().then(res => {
        if (res.data?.by_sport) setBySport(res.data.by_sport);
      }).catch(() => {}),
    ];

    if (!isFree) {
      fetches.push(
        insightsAPI.get().then(res => setInsights(res.data.insights || [])).catch(() => {}),
        insightsAPI.weeklyReports().then(res => setReports(res.data.reports || [])).catch(() => {}),
      );
    }

    Promise.all(fetches).finally(() => setLoading(false));
  }, [isFree]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Compute strongest/weakest sport for free user teaser
  const sportEntries = Object.entries(bySport)
    .filter(([, record]) => record.wins + record.losses >= 3)
    .map(([sport, record]) => ({ sport, winRate: computeWinRate(record), total: record.wins + record.losses }))
    .sort((a, b) => b.winRate - a.winRate);

  const strongestSport = sportEntries.length > 0 ? sportEntries[0] : null;
  const weakestSport = sportEntries.length > 1 ? sportEntries[sportEntries.length - 1] : null;

  if (isFree) {
    const hasEnoughData = sportEntries.length >= 2;
    const teaserInsightCount = Math.max(3, Math.min(5, sportEntries.length + 1));

    return (
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Sport Strength Summary */}
        {hasEnoughData && strongestSport && weakestSport && (
          <div className="bg-card border border-accent/20 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <Zap size={20} className="text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Your Betting Strengths</h3>
                <p className="text-xs text-muted-dark mt-0.5">Based on your recent betting history</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-win/5 border border-win/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={16} className="text-win" />
                  <span className="text-xs uppercase tracking-wider text-muted-dark" style={{ fontFamily: 'var(--font-display)' }}>Strongest</span>
                </div>
                <p className="text-xl font-bold text-win" style={{ fontFamily: 'var(--font-display)' }}>
                  {SPORT_LABELS[strongestSport.sport] || strongestSport.sport.toUpperCase()}
                </p>
                <p className="text-xs text-muted-dark mt-1">{strongestSport.total} bets tracked</p>
              </div>
              <div className="bg-loss/5 border border-loss/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown size={16} className="text-loss" />
                  <span className="text-xs uppercase tracking-wider text-muted-dark" style={{ fontFamily: 'var(--font-display)' }}>Weakest</span>
                </div>
                <p className="text-xl font-bold text-loss" style={{ fontFamily: 'var(--font-display)' }}>
                  {SPORT_LABELS[weakestSport.sport] || weakestSport.sport.toUpperCase()}
                </p>
                <p className="text-xs text-muted-dark mt-1">{weakestSport.total} bets tracked</p>
              </div>
            </div>
          </div>
        )}

        {/* Locked Insight Cards (Teaser) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg uppercase tracking-wider font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Personalized Insights
            </h2>
            <span className="text-xs text-accent bg-accent/10 px-3 py-1 rounded-full font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              PRO
            </span>
          </div>

          <div className="bg-card border border-accent/20 rounded-lg p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
              <Lock size={24} className="text-accent" />
            </div>
            <p className="text-lg font-bold text-white">
              {teaserInsightCount} actionable insights waiting
            </p>
            <p className="text-sm text-muted-dark max-w-md mx-auto">
              Unlock AI-powered analysis of your betting patterns, specific recommendations to improve your score, and weekly performance reports.
            </p>
          </div>

          {/* Blurred preview cards */}
          <div className="space-y-3 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background z-10" />
            {[
              { title: 'Bet type performance analysis', impact: 'high' },
              { title: 'Optimal stake sizing recommendations', impact: 'medium' },
              { title: 'Weekly trend patterns detected', impact: 'medium' },
            ].map((preview, i) => (
              <div
                key={i}
                className="bg-card border border-accent/10 rounded-lg p-5 blur-[6px] select-none pointer-events-none"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    preview.impact === 'high' ? 'bg-loss/20' : 'bg-accent/20'
                  }`}>
                    <AlertTriangle size={16} className={preview.impact === 'high' ? 'text-loss' : 'text-accent'} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">{preview.title}</p>
                    <p className="text-xs text-muted-dark">Detailed analysis and actionable recommendations based on your betting patterns...</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof + CTA */}
          <div className="bg-accent/5 border border-accent/30 rounded-lg p-5 text-center space-y-3">
            <p className="text-sm text-muted-dark">
              Bettors who use Personalized Insights improve their Gammbler Score by an average of <span className="text-accent font-bold">8.3 points</span>
            </p>
            <Link
              href="/dashboard/settings"
              className="inline-block bg-accent text-background font-bold px-8 py-3 rounded-lg uppercase tracking-wider text-sm hover:bg-accent-light transition-colors"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>

        {/* Locked Weekly Reports */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg uppercase tracking-wider font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Weekly Reports
            </h2>
            <span className="text-xs text-accent bg-accent/10 px-3 py-1 rounded-full font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              PRO
            </span>
          </div>
          <div className="bg-card border border-accent/10 rounded-lg p-6 text-center">
            <BarChart3 size={32} className="text-muted-dark mx-auto mb-3" />
            <p className="text-sm text-muted-dark">
              Weekly performance reports delivered every Monday. Upgrade to Pro to unlock.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Pro user view (unchanged)
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Insights */}
      <div>
        <h2 className="text-lg uppercase tracking-wider font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          Personalized Insights
        </h2>
        {insights.length === 0 ? (
          <div className="text-center py-12 bg-card border border-accent/20 rounded-lg">
            <BarChart3 size={32} className="text-muted-dark mx-auto mb-3" />
            <p className="text-muted-dark text-sm">Need at least 20 settled bets to generate insights.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className={`bg-card border rounded-lg p-6 ${
                  insight.impact === 'high' ? 'border-loss/40' : 'border-accent/20'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    insight.impact === 'high' ? 'bg-loss/20' : 'bg-accent/20'
                  }`}>
                    {insight.impact === 'high' ? (
                      <AlertTriangle size={20} className="text-loss" />
                    ) : (
                      <TrendingUp size={20} className="text-accent" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">{insight.title}</h3>
                    <p className="text-sm text-muted-dark leading-relaxed">{insight.description}</p>
                    <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${
                      insight.impact === 'high' ? 'bg-loss/20 text-loss' :
                      insight.impact === 'medium' ? 'bg-accent/20 text-accent' :
                      'bg-muted-dark/20 text-muted-dark'
                    }`}>
                      {insight.impact} impact
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Reports */}
      <div>
        <h2 className="text-lg uppercase tracking-wider font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          Weekly Reports
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-dark">No weekly reports yet. Reports are generated every Monday morning.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="bg-card border border-accent/20 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">
                    {new Date(report.period_start).toLocaleDateString()} — {new Date(report.period_end).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-dark mt-1">
                    Generated {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
