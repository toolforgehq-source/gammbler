'use client';

import { useState, useEffect, useRef } from 'react';
import { dfsAPI } from '@/lib/api';
import {
  Trophy, Upload, PlusCircle, Target,
} from 'lucide-react';

interface DfsScore {
  sport: string;
  score: string;
  is_unlocked: boolean;
  total_contests: number;
  roi: string;
  cash_rate: string;
  total_entry_fees_cents: number;
  total_payouts_cents: number;
}

interface DfsStats {
  total_contests: number;
  total_profit: number;
  cash_rate: number;
  by_type?: Record<string, { count: number; profit: number; cash_rate: number }>;
  by_sport?: Record<string, { count: number; profit: number }>;
}

interface DfsContest {
  id: string;
  platform: string;
  sport: string;
  contest_type: string;
  contest_name: string | null;
  entry_fee_cents: number;
  payout_cents: number;
  finish_position: number | null;
  total_entries: number | null;
  contest_date: string;
}

interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: string;
  total_contests: number;
  roi: string;
  rank: number;
  is_self?: boolean;
}

interface ScoreSnapshot {
  date: string;
  score: string;
}

interface ImportResult {
  message?: string;
  rows_imported?: number;
  rows_skipped?: number;
  error?: string;
}

const DFS_SPORTS = [
  { value: 'overall', label: 'Overall' },
  { value: 'nfl', label: 'NFL' },
  { value: 'nba', label: 'NBA' },
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
  { value: 'pga', label: 'PGA' },
  { value: 'nascar', label: 'NASCAR' },
  { value: 'soccer', label: 'Soccer' },
  { value: 'mma', label: 'MMA' },
  { value: 'cfb', label: 'NCAAF' },
  { value: 'cbb', label: 'NCAAB' },
];

const CONTEST_TYPES = [
  { value: 'cash', label: 'Cash Game' },
  { value: 'gpp', label: 'GPP / Tournament' },
  { value: 'h2h', label: 'Head-to-Head' },
  { value: 'fifty_fifty', label: '50/50 / Double Up' },
  { value: 'multiplier', label: 'Multiplier' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'other', label: 'Other' },
];

const PLATFORMS = [
  { value: 'draftkings', label: 'DraftKings' },
  { value: 'fanduel', label: 'FanDuel' },
  { value: 'yahoo', label: 'Yahoo' },
  { value: 'underdog', label: 'Underdog' },
  { value: 'prizepicks', label: 'PrizePicks' },
  { value: 'other', label: 'Other' },
];

function getTier(score: number): { label: string; color: string } {
  if (score >= 91) return { label: 'Legend', color: 'text-yellow-400' };
  if (score >= 76) return { label: 'Elite', color: 'text-purple-400' };
  if (score >= 61) return { label: 'Sharp', color: 'text-accent' };
  if (score >= 41) return { label: 'Developing', color: 'text-blue-400' };
  return { label: 'Recreational', color: 'text-muted' };
}

export default function DFSPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add' | 'import' | 'contests' | 'leaderboards'>('dashboard');
  const [scores, setScores] = useState<DfsScore[]>([]);
  const [stats, setStats] = useState<DfsStats | null>(null);
  const [contests, setContests] = useState<DfsContest[]>([]);
  const [, setLoading] = useState(true);
  const [leaderboardSport, setLeaderboardSport] = useState('overall');
  const [leaderboardType, setLeaderboardType] = useState<'national' | 'friends'>('national');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [, setScoreHistory] = useState<ScoreSnapshot[]>([]);

  // Add contest form
  const [form, setForm] = useState({
    platform: 'draftkings',
    sport: 'nfl',
    contest_type: 'cash',
    contest_name: '',
    entry_fee: '',
    payout: '',
    finish_position: '',
    total_entries: '',
    points_scored: '',
    contest_date: new Date().toISOString().slice(0, 10),
  });

  // CSV import
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPlatform, setCsvPlatform] = useState('draftkings');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    let cancelled = false;
    (async () => {
      try {
        const [scoresRes, statsRes, contestsRes, historyRes] = await Promise.all([
          dfsAPI.getScores().catch(() => ({ data: { scores: [] as DfsScore[] } })),
          dfsAPI.stats().catch(() => ({ data: null as DfsStats | null })),
          dfsAPI.listContests({ limit: '20' }).catch(() => ({ data: { contests: [] as DfsContest[] } })),
          dfsAPI.scoreHistory('overall').catch(() => ({ data: { snapshots: [] as ScoreSnapshot[] } })),
        ]);
        if (!cancelled) {
          setScores(scoresRes.data.scores || []);
          setStats(statsRes.data);
          setContests(contestsRes.data.contests || []);
          setScoreHistory(historyRes.data.snapshots || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Load DFS data error:', err);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (activeTab !== 'leaderboards') return;
    let cancelled = false;
    (async () => {
      try {
        const res = leaderboardType === 'national'
          ? await dfsAPI.nationalLeaderboard(leaderboardSport)
          : await dfsAPI.friendsLeaderboard(leaderboardSport);
        if (!cancelled) setLeaderboard(res.data.leaderboard || []);
      } catch {
        if (!cancelled) setLeaderboard([]);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, leaderboardSport, leaderboardType]);

  const handleAddContest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dfsAPI.addContest({
        platform: form.platform,
        sport: form.sport,
        contest_type: form.contest_type,
        contest_name: form.contest_name || undefined,
        entry_fee: parseFloat(form.entry_fee) || 0,
        payout: parseFloat(form.payout) || 0,
        finish_position: form.finish_position ? parseInt(form.finish_position) : undefined,
        total_entries: form.total_entries ? parseInt(form.total_entries) : undefined,
        points_scored: form.points_scored ? parseFloat(form.points_scored) : undefined,
        contest_date: form.contest_date,
      });
      setForm({
        platform: 'draftkings', sport: 'nfl', contest_type: 'cash',
        contest_name: '', entry_fee: '', payout: '', finish_position: '',
        total_entries: '', points_scored: '', contest_date: new Date().toISOString().slice(0, 10),
      });
      setActiveTab('dashboard');
      // Reload data
      const [scoresRes2, statsRes2, contestsRes2] = await Promise.all([
        dfsAPI.getScores().catch(() => ({ data: { scores: [] as DfsScore[] } })),
        dfsAPI.stats().catch(() => ({ data: null as DfsStats | null })),
        dfsAPI.listContests({ limit: '20' }).catch(() => ({ data: { contests: [] as DfsContest[] } })),
      ]);
      setScores(scoresRes2.data.scores || []);
      setStats(statsRes2.data);
      setContests(contestsRes2.data.contests || []);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: string } } };
      alert(errObj.response?.data?.error || 'Failed to add contest');
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await dfsAPI.csvImport(csvFile, csvPlatform);
      setImportResult(res.data);
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Reload data
      const [scoresRes3, statsRes3, contestsRes3] = await Promise.all([
        dfsAPI.getScores().catch(() => ({ data: { scores: [] as DfsScore[] } })),
        dfsAPI.stats().catch(() => ({ data: null as DfsStats | null })),
        dfsAPI.listContests({ limit: '20' }).catch(() => ({ data: { contests: [] as DfsContest[] } })),
      ]);
      setScores(scoresRes3.data.scores || []);
      setStats(statsRes3.data);
      setContests(contestsRes3.data.contests || []);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: string } } };
      setImportResult({ error: errObj.response?.data?.error || 'Import failed' });
    }
    setImporting(false);
  };

  const overallScore = scores.find((s) => s.sport === 'overall');
  const sportScores = scores.filter((s) => s.sport !== 'overall');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            DFS Score
          </h1>
          <p className="text-muted text-sm mt-1">Daily Fantasy Sports Performance Tracker</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('add')} className="flex items-center gap-2 px-4 py-2 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-light transition-colors">
            <PlusCircle size={16} /> Add Contest
          </button>
          <button onClick={() => setActiveTab('import')} className="flex items-center gap-2 px-4 py-2 bg-card border border-accent/30 text-accent rounded-lg text-sm font-medium hover:bg-accent/10 transition-colors">
            <Upload size={16} /> Import CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card rounded-lg p-1">
        {(['dashboard', 'contests', 'leaderboards'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wide transition-colors ${
              activeTab === tab ? 'bg-accent text-background' : 'text-muted hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* DFS Score Circle */}
          {overallScore && overallScore.is_unlocked ? (
            <div className="bg-card rounded-2xl p-8 border border-accent/20">
              <div className="flex items-start gap-8">
                <div className="text-center">
                  <p className="text-xs text-muted uppercase tracking-wider mb-2">Overall DFS Score</p>
                  <div className="relative w-36 h-36 mx-auto">
                    <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                      <circle cx="60" cy="60" r="52" fill="none" stroke="url(#dfsGrad)" strokeWidth="8"
                        strokeLinecap="round" strokeDasharray={`${(Number(overallScore.score) / 100) * 327} 327`} />
                      <defs><linearGradient id="dfsGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#4caf50" /><stop offset="100%" stopColor="#81c784" />
                      </linearGradient></defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold">{overallScore.score}</span>
                      <span className={`text-xs font-semibold ${getTier(Number(overallScore.score)).color}`}>
                        {getTier(Number(overallScore.score)).label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="bg-secondary rounded-xl p-4">
                    <p className="text-xs text-muted">Contests</p>
                    <p className="text-xl font-bold">{overallScore.total_contests}</p>
                  </div>
                  <div className="bg-secondary rounded-xl p-4">
                    <p className="text-xs text-muted">ROI</p>
                    <p className={`text-xl font-bold ${Number(overallScore.roi) >= 0 ? 'text-accent' : 'text-loss'}`}>
                      {Number(overallScore.roi) >= 0 ? '+' : ''}{(Number(overallScore.roi) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-secondary rounded-xl p-4">
                    <p className="text-xs text-muted">Cash Rate</p>
                    <p className="text-xl font-bold">{(Number(overallScore.cash_rate) * 100).toFixed(1)}%</p>
                  </div>
                  <div className="bg-secondary rounded-xl p-4">
                    <p className="text-xs text-muted">Net Profit</p>
                    <p className={`text-xl font-bold ${overallScore.total_payouts_cents - overallScore.total_entry_fees_cents >= 0 ? 'text-accent' : 'text-loss'}`}>
                      ${((overallScore.total_payouts_cents - overallScore.total_entry_fees_cents) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-2xl p-8 border border-accent/20 text-center">
              <Trophy className="w-12 h-12 text-muted mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Get Your DFS Score</h2>
              <p className="text-muted mb-4">
                Log {overallScore ? `${20 - overallScore.total_contests} more` : '20'} DFS contests to unlock your DFS Score.
                Import your contest history from DraftKings or FanDuel to get started instantly.
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setActiveTab('add')} className="px-6 py-3 bg-accent text-background rounded-lg font-medium hover:bg-accent-light transition-colors">
                  Add Contest
                </button>
                <button onClick={() => setActiveTab('import')} className="px-6 py-3 bg-card border border-accent/30 text-accent rounded-lg font-medium hover:bg-accent/10 transition-colors">
                  Import CSV
                </button>
              </div>
            </div>
          )}

          {/* Sport-Specific DFS Scores */}
          {sportScores.length > 0 && (
            <div className="bg-card rounded-2xl p-6 border border-accent/20">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Sport-Specific DFS Scores</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {sportScores.map((s) => {
                  const tier = getTier(Number(s.score));
                  return (
                    <div key={s.sport} className="bg-secondary rounded-xl p-3 text-center">
                      <p className="text-xs text-muted uppercase mb-1">
                        {DFS_SPORTS.find((ds) => ds.value === s.sport)?.label || s.sport}
                      </p>
                      {s.is_unlocked ? (
                        <>
                          <p className="text-2xl font-bold">{s.score}</p>
                          <p className={`text-xs font-semibold ${tier.color}`}>{tier.label}</p>
                          <p className="text-xs text-muted mt-1">{s.total_contests} contests</p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg text-muted">🔒</p>
                          <p className="text-xs text-muted">{s.total_contests}/20</p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          {stats && stats.total_contests > 0 && (
            <div className="bg-card rounded-2xl p-6 border border-accent/20">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Performance Breakdown</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.total_contests}</p>
                  <p className="text-xs text-muted">Total Contests</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${stats.total_profit >= 0 ? 'text-accent' : 'text-loss'}`}>
                    ${stats.total_profit.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted">Net Profit</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.cash_rate.toFixed(1)}%</p>
                  <p className="text-xs text-muted">Cash Rate</p>
                </div>
              </div>

              {/* By Contest Type */}
              {stats.by_type && Object.keys(stats.by_type).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-xs text-muted uppercase mb-3">By Contest Type</h4>
                  <div className="space-y-2">
                    {Object.entries(stats.by_type).map(([type, data]) => {
                      const d = data as { payouts?: number; fees?: number; count: number };
                      const profit = ((d.payouts || 0) - (d.fees || 0)) / 100;
                      return (
                        <div key={type} className="flex items-center justify-between bg-secondary rounded-lg px-4 py-2">
                          <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-muted">{d.count} contests</span>
                            <span className={`text-sm font-medium ${profit >= 0 ? 'text-accent' : 'text-loss'}`}>
                              {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Contest Tab */}
      {activeTab === 'add' && (
        <div className="bg-card rounded-2xl p-6 border border-accent/20">
          <h2 className="text-lg font-bold mb-4">Add DFS Contest</h2>
          <form onSubmit={handleAddContest} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1">Platform</label>
                <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
                  className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-sm">
                  {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Sport</label>
                <select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })}
                  className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-sm">
                  {DFS_SPORTS.filter((s) => s.value !== 'overall').map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1">Contest Type</label>
                <select value={form.contest_type} onChange={(e) => setForm({ ...form, contest_type: e.target.value })}
                  className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-sm">
                  {CONTEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Contest Name (optional)</label>
                <input type="text" value={form.contest_name} onChange={(e) => setForm({ ...form, contest_name: e.target.value })}
                  className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-sm" placeholder="e.g. NFL $5 Double Up" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1">Entry Fee ($)</label>
                <input type="number" step="0.01" min="0" value={form.entry_fee} onChange={(e) => setForm({ ...form, entry_fee: e.target.value })}
                  className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-sm" placeholder="5.00" required />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Payout ($)</label>
                <input type="number" step="0.01" min="0" value={form.payout} onChange={(e) => setForm({ ...form, payout: e.target.value })}
                  className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-sm" placeholder="10.00" required />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1">Finish Position</label>
                <input type="number" min="1" value={form.finish_position} onChange={(e) => setForm({ ...form, finish_position: e.target.value })}
                  className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 5" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Total Entries</label>
                <input type="number" min="1" value={form.total_entries} onChange={(e) => setForm({ ...form, total_entries: e.target.value })}
                  className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 100" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Points Scored</label>
                <input type="number" step="0.01" value={form.points_scored} onChange={(e) => setForm({ ...form, points_scored: e.target.value })}
                  className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 185.4" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Contest Date</label>
              <input type="date" value={form.contest_date} onChange={(e) => setForm({ ...form, contest_date: e.target.value })}
                className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-sm" required />
            </div>

            <div className="flex gap-3">
              <button type="submit" className="flex-1 py-3 bg-accent text-background rounded-lg font-medium hover:bg-accent-light transition-colors">
                Add Contest
              </button>
              <button type="button" onClick={() => setActiveTab('dashboard')} className="px-6 py-3 bg-secondary text-muted rounded-lg hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Import CSV Tab */}
      {activeTab === 'import' && (
        <div className="bg-card rounded-2xl p-6 border border-accent/20">
          <h2 className="text-lg font-bold mb-2">Import DFS Contest History</h2>
          <p className="text-sm text-muted mb-6">
            Upload your contest history CSV from DraftKings or FanDuel. Your DFS Score will be calculated automatically from your full history.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted mb-1">Platform</label>
              <select value={csvPlatform} onChange={(e) => setCsvPlatform(e.target.value)}
                className="w-full bg-secondary border border-accent/20 rounded-lg px-3 py-2 text-sm">
                {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted mb-2">CSV File</label>
              <div className="border-2 border-dashed border-accent/30 rounded-xl p-8 text-center hover:border-accent/50 transition-colors">
                <Upload className="w-8 h-8 text-muted mx-auto mb-2" />
                <input ref={fileInputRef} type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="w-full text-sm" />
                {csvFile && <p className="text-sm text-accent mt-2">{csvFile.name}</p>}
              </div>
            </div>

            <div className="bg-secondary rounded-xl p-4">
              <h4 className="text-sm font-semibold mb-2">How to export your contest history:</h4>
              <div className="text-xs text-muted space-y-2">
                <p><strong className="text-white">DraftKings:</strong> Go to My Contests → Contest History → Download CSV</p>
                <p><strong className="text-white">FanDuel:</strong> Go to My Entries → Transaction History → Export to CSV</p>
              </div>
            </div>

            {importResult && (
              <div className={`rounded-xl p-4 ${importResult.error ? 'bg-loss/20 border border-loss/30' : 'bg-accent/20 border border-accent/30'}`}>
                {importResult.error ? (
                  <p className="text-sm text-loss">{importResult.error}</p>
                ) : (
                  <p className="text-sm text-accent">
                    {importResult.message}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleCsvImport} disabled={!csvFile || importing}
                className="flex-1 py-3 bg-accent text-background rounded-lg font-medium hover:bg-accent-light transition-colors disabled:opacity-50">
                {importing ? 'Importing...' : 'Import Contests'}
              </button>
              <button onClick={() => setActiveTab('dashboard')} className="px-6 py-3 bg-secondary text-muted rounded-lg hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contests Tab */}
      {activeTab === 'contests' && (
        <div className="bg-card rounded-2xl p-6 border border-accent/20">
          <h2 className="text-lg font-bold mb-4">Contest History</h2>
          {contests.length === 0 ? (
            <p className="text-muted text-center py-8">No contests yet. Add one or import from CSV.</p>
          ) : (
            <div className="space-y-2">
              {contests.map((c) => {
                const profit = (c.payout_cents - c.entry_fee_cents) / 100;
                return (
                  <div key={c.id} className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                        <Target size={14} className="text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{c.contest_name || `${c.sport.toUpperCase()} ${c.contest_type.replace('_', ' ')}`}</p>
                        <p className="text-xs text-muted">
                          {PLATFORMS.find((p) => p.value === c.platform)?.label} · {new Date(c.contest_date).toLocaleDateString()}
                          {c.finish_position && ` · ${c.finish_position}${c.total_entries ? `/${c.total_entries}` : ''}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${profit >= 0 ? 'text-accent' : 'text-loss'}`}>
                        {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted">${(c.entry_fee_cents / 100).toFixed(2)} entry</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Leaderboards Tab */}
      {activeTab === 'leaderboards' && (
        <div className="bg-card rounded-2xl p-6 border border-accent/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">DFS Leaderboards</h2>
            <div className="flex gap-2">
              <select value={leaderboardSport} onChange={(e) => setLeaderboardSport(e.target.value)}
                className="bg-secondary border border-accent/20 rounded-lg px-3 py-1.5 text-sm">
                {DFS_SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <div className="flex bg-secondary rounded-lg">
                <button onClick={() => setLeaderboardType('national')}
                  className={`px-3 py-1.5 text-xs rounded-lg ${leaderboardType === 'national' ? 'bg-accent text-background' : 'text-muted'}`}>
                  National
                </button>
                <button onClick={() => setLeaderboardType('friends')}
                  className={`px-3 py-1.5 text-xs rounded-lg ${leaderboardType === 'friends' ? 'bg-accent text-background' : 'text-muted'}`}>
                  Friends
                </button>
              </div>
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-muted text-center py-8">No DFS leaderboard data yet.</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => {
                const tier = getTier(Number(entry.score));
                return (
                  <div key={entry.user_id} className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                    entry.is_self ? 'bg-accent/10 border border-accent/30' : 'bg-secondary'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center text-sm font-bold text-muted">
                        {entry.rank || '—'}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold">
                        {entry.username?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{entry.username}{entry.is_self ? ' (you)' : ''}</p>
                        <p className="text-xs text-muted">
                          {entry.total_contests} contests · ROI: {(Number(entry.roi) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{entry.score}</p>
                      <p className={`text-xs font-semibold ${tier.color}`}>{tier.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
