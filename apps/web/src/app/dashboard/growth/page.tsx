'use client';

import { useEffect, useState, useCallback } from 'react';
import { growthBrainAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  Crown,
  Zap,
  Play,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Target,
  Clock,
  BarChart3,
  Eye,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
} from 'lucide-react';

const FOUNDER_EMAIL = 'l.doeden1018@gmail.com';

interface DashboardData {
  biggestDropoff: {
    fromStage: string;
    toStage: string;
    dropoffRate: number;
    usersLost: number;
    message: string;
  } | null;
  northStar: {
    activeScoreBettors: number;
    newASBs7d: number;
    churnedASBs7d: number;
    netASBGrowth7d: number;
    viralCoefficient: number;
  };
  secondaryMetrics: {
    totalUsers: number;
    totalScoreUnlocked: number;
    totalProSubscribers: number;
    totalCreators: number;
    totalActiveCreators: number;
    active7d: number;
  };
  funnel: {
    stages: Array<{ name: string; count: number; conversionRate: number | null }>;
  };
  cohortTrend: {
    improving: boolean;
    recentASBRate: number;
    previousASBRate: number;
    changePct: number;
  };
  actionQueue: Opportunity[];
  beliefs: Belief[];
  latestSnapshot: Record<string, unknown> | null;
}

interface Opportunity {
  id: string;
  actionType: string;
  action_type: string;
  channel: string;
  whyThis: string;
  why_this: string;
  whyNow: string;
  why_now: string;
  evidence: string;
  expectedASBs: number;
  expected_asbs: string;
  pSuccess: number;
  p_success: string;
  confidence: number;
  urgency: number;
  evScore: number;
  ev_score: string;
  costDollars: number;
  cost_dollars: string;
  founderTimeMinutes: number;
  founder_time_minutes: number;
  asbsPerDollar: number | null;
  asbs_per_dollar: string | null;
  asbsPerMinute: number | null;
  asbs_per_minute: string | null;
  successCriteria: string;
  success_criteria: string;
  learningObjective: string;
  learning_objective: string;
  content: string | null;
  isExploratory: boolean;
  is_exploratory: boolean;
  status: string;
  proposedAt: string;
  proposed_at: string;
  rejection_reason: string | null;
}

interface Belief {
  key: string;
  value: number;
  sampleSize: number;
  confidence: number;
  previousValue: number | null;
  updatedReason: string | null;
  updatedAt: string;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function confidenceLabel(c: number): { text: string; color: string } {
  if (c >= 0.7) return { text: 'High', color: 'text-win' };
  if (c >= 0.5) return { text: 'Medium', color: 'text-gold' };
  return { text: 'Low', color: 'text-loss' };
}

function actionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    onboarding_nudge: 'Onboarding Nudge',
    referral_campaign: 'Referral Campaign',
    retention_outreach: 'Retention Outreach',
    creator_outreach: 'Creator Outreach',
  };
  return labels[type] || type;
}

function actionTypeColor(type: string): string {
  const colors: Record<string, string> = {
    onboarding_nudge: 'bg-accent/20 text-accent',
    referral_campaign: 'bg-gold/20 text-gold',
    retention_outreach: 'bg-loss/20 text-loss',
    creator_outreach: 'bg-blue-500/20 text-blue-400',
  };
  return colors[type] || 'bg-muted/20 text-muted';
}

function normalizeOpp(raw: Opportunity): Opportunity {
  return {
    ...raw,
    actionType: raw.actionType || raw.action_type,
    whyThis: raw.whyThis || raw.why_this,
    whyNow: raw.whyNow || raw.why_now,
    evidence: raw.evidence,
    expectedASBs: Number(raw.expectedASBs ?? raw.expected_asbs ?? 0),
    pSuccess: Number(raw.pSuccess ?? raw.p_success ?? 0),
    confidence: Number(raw.confidence ?? 0),
    urgency: Number(raw.urgency ?? 0),
    evScore: Number(raw.evScore ?? raw.ev_score ?? 0),
    costDollars: Number(raw.costDollars ?? raw.cost_dollars ?? 0),
    founderTimeMinutes: Number(raw.founderTimeMinutes ?? raw.founder_time_minutes ?? 0),
    asbsPerDollar: raw.asbsPerDollar ?? (raw.asbs_per_dollar ? Number(raw.asbs_per_dollar) : null),
    asbsPerMinute: raw.asbsPerMinute ?? (raw.asbs_per_minute ? Number(raw.asbs_per_minute) : null),
    successCriteria: raw.successCriteria || raw.success_criteria || '',
    learningObjective: raw.learningObjective || raw.learning_objective || '',
    content: raw.content,
    isExploratory: raw.isExploratory ?? raw.is_exploratory ?? false,
    status: raw.status,
    proposedAt: raw.proposedAt || raw.proposed_at || '',
    rejection_reason: raw.rejection_reason,
  };
}

export default function GrowthBrainPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [initRunning, setInitRunning] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedOpportunity, setExpandedOpportunity] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<string>('all');
  const [historyOpps, setHistoryOpps] = useState<Opportunity[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [beliefsExpanded, setBeliefsExpanded] = useState(true);
  const [whyNotExpanded, setWhyNotExpanded] = useState(false);
  const [rejectedOpps, setRejectedOpps] = useState<Opportunity[]>([]);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await growthBrainAPI.dashboard();
      setDashboard(res.data);
      setLastRefresh(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (status?: string) => {
    setHistoryLoading(true);
    try {
      const params: Record<string, string> = { limit: '50' };
      if (status && status !== 'all') params.status = status;
      const res = await growthBrainAPI.opportunities(params);
      setHistoryOpps((res.data.opportunities || []).map(normalizeOpp));
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchRejected = useCallback(async () => {
    try {
      const res = await growthBrainAPI.opportunities({ status: 'rejected', limit: '20' });
      setRejectedOpps((res.data.opportunities || []).map(normalizeOpp));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (user?.email !== FOUNDER_EMAIL) {
      router.push('/dashboard');
      return;
    }
    fetchDashboard();
    fetchHistory();
    fetchRejected();
  }, [user, router, fetchDashboard, fetchHistory, fetchRejected]);

  useEffect(() => {
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleRunCycle = async () => {
    setCycleRunning(true);
    setActionMessage(null);
    try {
      const res = await growthBrainAPI.runCycle();
      const r = res.data.result;
      setActionMessage({
        type: 'success',
        text: `Brain cycle complete. Generated: ${r.onboarding} onboarding, ${r.referral} referral, ${r.retention} retention opportunities.`,
      });
      await fetchDashboard();
      await fetchHistory(historyTab);
    } catch {
      setActionMessage({ type: 'error', text: 'Failed to run brain cycle.' });
    } finally {
      setCycleRunning(false);
    }
  };

  const handleInitialize = async () => {
    setInitRunning(true);
    setActionMessage(null);
    try {
      await growthBrainAPI.initialize();
      setActionMessage({ type: 'success', text: 'Brain initialized. Beliefs seeded from historical data.' });
      await fetchDashboard();
    } catch {
      setActionMessage({ type: 'error', text: 'Failed to initialize brain.' });
    } finally {
      setInitRunning(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await growthBrainAPI.approveOpportunity(id);
      setActionMessage({ type: 'success', text: 'Opportunity approved.' });
      await fetchDashboard();
      await fetchHistory(historyTab);
    } catch {
      setActionMessage({ type: 'error', text: 'Failed to approve.' });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await growthBrainAPI.rejectOpportunity(id, rejectReason || 'No reason provided');
      setRejectingId(null);
      setRejectReason('');
      setActionMessage({ type: 'success', text: 'Opportunity rejected. Brain will learn from this.' });
      await fetchDashboard();
      await fetchHistory(historyTab);
      await fetchRejected();
    } catch {
      setActionMessage({ type: 'error', text: 'Failed to reject.' });
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await growthBrainAPI.executeOpportunity(id);
      setActionMessage({ type: 'success', text: 'Opportunity executed. Outcome tracking started.' });
      await fetchDashboard();
      await fetchHistory(historyTab);
    } catch {
      setActionMessage({ type: 'error', text: 'Failed to execute.' });
    }
  };

  if (user?.email !== FOUNDER_EMAIL) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="text-center py-16">
        <Brain size={48} className="text-gold mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>Growth Brain Offline</h2>
        <p className="text-muted-dark mb-6">Unable to load dashboard data. Make sure the API is running.</p>
        <button onClick={fetchDashboard} className="px-6 py-3 bg-gold text-background rounded-lg font-semibold hover:bg-gold/90 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  const proposedActions = dashboard.actionQueue.filter(a => a.status === 'proposed');
  const approvedActions = dashboard.actionQueue.filter(a => a.status === 'approved');

  const highBeliefs = dashboard.beliefs.filter(b => b.confidence >= 0.7);
  const medBeliefs = dashboard.beliefs.filter(b => b.confidence >= 0.5 && b.confidence < 0.7);
  const lowBeliefs = dashboard.beliefs.filter(b => b.confidence < 0.5);
  const changedBeliefs = dashboard.beliefs.filter(b => b.previousValue !== null);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Brain size={28} className="text-gold" />
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              GROWTH BRAIN
            </h1>
            <p className="text-xs text-muted-dark">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleInitialize}
            disabled={initRunning}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-accent/20 text-muted hover:text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {initRunning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            INITIALIZE
          </button>
          <button
            onClick={handleRunCycle}
            disabled={cycleRunning}
            className="flex items-center gap-2 px-4 py-2 bg-gold text-background rounded-lg text-xs font-semibold hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {cycleRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            RUN BRAIN CYCLE
          </button>
          <button
            onClick={fetchDashboard}
            className="p-2 text-muted-dark hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Action Message */}
      {actionMessage && (
        <div className={`p-3 rounded-lg text-sm flex items-center justify-between ${
          actionMessage.type === 'success' ? 'bg-win/10 text-win border border-win/20' : 'bg-loss/10 text-loss border border-loss/20'
        }`}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ═══════════════════ SECTION 1: COMPANY HEALTH ═══════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Active Scored Bettors"
          value={dashboard.northStar.activeScoreBettors}
          icon={<Target size={16} className="text-gold" />}
          highlight
        />
        <MetricCard
          label="7-Day ASB Growth"
          value={dashboard.northStar.netASBGrowth7d >= 0 ? `+${dashboard.northStar.netASBGrowth7d}` : `${dashboard.northStar.netASBGrowth7d}`}
          icon={dashboard.northStar.netASBGrowth7d >= 0 ? <TrendingUp size={16} className="text-win" /> : <TrendingDown size={16} className="text-loss" />}
          valueColor={dashboard.northStar.netASBGrowth7d >= 0 ? 'text-win' : 'text-loss'}
          subtitle={`+${dashboard.northStar.newASBs7d} new, -${dashboard.northStar.churnedASBs7d} churned`}
        />
        <MetricCard
          label="Active Creators"
          value={dashboard.secondaryMetrics.totalActiveCreators}
          icon={<Crown size={16} className="text-accent" />}
          subtitle={`${dashboard.secondaryMetrics.totalCreators} total`}
        />
        <MetricCard
          label="Total Users"
          value={dashboard.secondaryMetrics.totalUsers}
          icon={<Users size={16} className="text-accent" />}
          subtitle={`${dashboard.secondaryMetrics.totalScoreUnlocked} scored`}
        />
        <MetricCard
          label="Pro Subscribers"
          value={dashboard.secondaryMetrics.totalProSubscribers}
          icon={<Crown size={16} className="text-gold" />}
        />
        <MetricCard
          label="Viral Coeff (K)"
          value={dashboard.northStar.viralCoefficient.toFixed(3)}
          icon={<Zap size={16} className="text-accent" />}
          subtitle={dashboard.northStar.viralCoefficient >= 1 ? 'Exponential!' : dashboard.northStar.viralCoefficient >= 0.5 ? 'Good' : 'Needs work'}
        />
      </div>

      {/* ═══════════════ SECTION 2: BIGGEST FUNNEL BOTTLENECK ═══════════ */}
      {dashboard.biggestDropoff && (
        <div className="bg-loss/5 border border-loss/30 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={24} className="text-loss flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-sm uppercase tracking-wider text-loss font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                BIGGEST FUNNEL BOTTLENECK
              </h2>
              <p className="text-white text-sm leading-relaxed">
                {dashboard.biggestDropoff.message}
              </p>
              <div className="flex items-center gap-6 mt-3">
                <div>
                  <span className="text-xs text-muted-dark">Drop-off Rate</span>
                  <p className="text-lg font-bold text-loss" style={{ fontFamily: 'var(--font-number)' }}>
                    {(100 - dashboard.biggestDropoff.dropoffRate).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-dark">Users Lost</span>
                  <p className="text-lg font-bold text-loss" style={{ fontFamily: 'var(--font-number)' }}>
                    {dashboard.biggestDropoff.usersLost}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-dark">Stage</span>
                  <p className="text-sm font-semibold text-white">
                    {dashboard.biggestDropoff.fromStage} <ArrowRight size={12} className="inline text-loss" /> {dashboard.biggestDropoff.toStage}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Funnel Visualization */}
      <div className="bg-card border border-accent/20 rounded-lg p-5">
        <h3 className="text-xs uppercase tracking-wider text-muted-dark font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          CONVERSION FUNNEL
        </h3>
        <div className="flex items-end gap-2">
          {dashboard.funnel.stages.map((stage, i) => {
            const maxCount = dashboard.funnel.stages[0]?.count || 1;
            const height = Math.max((stage.count / maxCount) * 120, 20);
            const isDropoff = dashboard.biggestDropoff &&
              stage.name === dashboard.biggestDropoff.toStage;
            return (
              <div key={stage.name} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-number)' }}>
                  {stage.count}
                </span>
                <div
                  className={`w-full rounded-t transition-all ${
                    isDropoff ? 'bg-loss/60' : 'bg-accent/40'
                  }`}
                  style={{ height: `${height}px` }}
                />
                <span className="text-[10px] text-muted-dark text-center leading-tight">
                  {stage.name}
                </span>
                {stage.conversionRate !== null && (
                  <span className={`text-[10px] font-semibold ${
                    isDropoff ? 'text-loss' : 'text-muted'
                  }`}>
                    {stage.conversionRate}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {dashboard.cohortTrend && (
          <div className="mt-4 pt-3 border-t border-accent/10 flex items-center gap-2 text-xs">
            <BarChart3 size={12} className="text-muted-dark" />
            <span className="text-muted-dark">Cohort trend:</span>
            <span className={dashboard.cohortTrend.improving ? 'text-win' : 'text-loss'}>
              {dashboard.cohortTrend.improving ? 'Improving' : 'Declining'}
            </span>
            {dashboard.cohortTrend.recentASBRate > 0 && (
              <span className="text-muted-dark">
                (Recent: {(dashboard.cohortTrend.recentASBRate * 100).toFixed(1)}% ASB rate)
              </span>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════ SECTION 3: TOP RECOMMENDED ACTIONS ═════════════ */}
      <div>
        <h2 className="text-sm uppercase tracking-wider text-muted-dark font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
          TOP RECOMMENDED ACTIONS
          {proposedActions.length > 0 && (
            <span className="ml-2 text-gold">({proposedActions.length})</span>
          )}
        </h2>

        {/* Approved actions waiting for execution */}
        {approvedActions.length > 0 && (
          <div className="mb-4 space-y-3">
            <p className="text-xs text-win font-semibold uppercase tracking-wide">Ready to Execute</p>
            {approvedActions.map(opp => (
              <div key={opp.id} className="bg-win/5 border border-win/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${actionTypeColor(opp.actionType)}`}>
                      {actionTypeLabel(opp.actionType)}
                    </span>
                    <span className="text-xs text-win font-semibold">APPROVED</span>
                  </div>
                  <button
                    onClick={() => handleExecute(opp.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-win text-background rounded text-xs font-bold hover:bg-win/90 transition-colors"
                  >
                    <Play size={12} /> EXECUTE
                  </button>
                </div>
                <p className="text-sm text-white">{opp.whyThis}</p>
                {opp.content && (
                  <div className="mt-2 p-2 bg-background/50 rounded text-xs text-muted-dark">
                    <p className="font-semibold text-muted mb-1">Content:</p>
                    <p className="whitespace-pre-wrap">{opp.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Proposed actions */}
        {proposedActions.length === 0 ? (
          <div className="bg-card border border-accent/20 rounded-lg p-8 text-center">
            <Brain size={32} className="text-muted-dark mx-auto mb-3" />
            <p className="text-sm text-muted-dark">No pending recommendations. Run the brain cycle to generate new opportunities.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proposedActions.map((opp, i) => (
              <div key={opp.id} className="bg-card border border-accent/20 rounded-lg overflow-hidden">
                {/* Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-accent/5 transition-colors"
                  onClick={() => setExpandedOpportunity(expandedOpportunity === opp.id ? null : opp.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-dark font-bold" style={{ fontFamily: 'var(--font-number)' }}>
                        #{i + 1}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${actionTypeColor(opp.actionType)}`}>
                        {actionTypeLabel(opp.actionType)}
                      </span>
                      {opp.isExploratory && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400">
                          EXPLORATORY
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-xs text-muted-dark">EV Score</span>
                        <p className="text-sm font-bold text-gold" style={{ fontFamily: 'var(--font-number)' }}>
                          {opp.evScore.toFixed(4)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-dark">Expected ASBs</span>
                        <p className="text-sm font-bold text-accent" style={{ fontFamily: 'var(--font-number)' }}>
                          {opp.expectedASBs.toFixed(2)}
                        </p>
                      </div>
                      {expandedOpportunity === opp.id ? <ChevronUp size={16} className="text-muted-dark" /> : <ChevronDown size={16} className="text-muted-dark" />}
                    </div>
                  </div>
                  <p className="text-sm text-white mt-2">{opp.whyThis}</p>
                </div>

                {/* Expanded details */}
                {expandedOpportunity === opp.id && (
                  <div className="border-t border-accent/10 p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <DetailItem label="Why Now" value={opp.whyNow} />
                      <DetailItem label="Evidence" value={opp.evidence} />
                      <DetailItem label="Success Criteria" value={opp.successCriteria} />
                      <DetailItem label="Learning Objective" value={opp.learningObjective} />
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      <MiniStat label="P(Success)" value={formatPercent(opp.pSuccess)} />
                      <MiniStat label="Confidence" value={formatPercent(opp.confidence)} color={confidenceLabel(opp.confidence).color} />
                      <MiniStat label="Urgency" value={formatPercent(opp.urgency)} />
                      <MiniStat label="Cost" value={`$${opp.costDollars.toFixed(0)}`} />
                      <MiniStat label="Founder Time" value={`${opp.founderTimeMinutes}m`} icon={<Clock size={10} />} />
                      <MiniStat label="ASBs/$" value={opp.asbsPerDollar ? opp.asbsPerDollar.toFixed(3) : 'N/A'} />
                    </div>

                    {opp.content && (
                      <div className="p-3 bg-background/50 rounded-lg">
                        <p className="text-[10px] uppercase tracking-wider text-muted-dark font-bold mb-1">Generated Content</p>
                        <p className="text-xs text-muted whitespace-pre-wrap">{opp.content}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => handleApprove(opp.id)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-win text-background rounded-lg text-xs font-bold hover:bg-win/90 transition-colors"
                      >
                        <ThumbsUp size={14} /> APPROVE
                      </button>
                      {rejectingId === opp.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Why reject? (Brain learns from this)"
                            className="flex-1 px-3 py-2 bg-background border border-loss/30 rounded-lg text-xs text-white placeholder:text-muted-dark focus:outline-none focus:border-loss"
                            autoFocus
                          />
                          <button
                            onClick={() => handleReject(opp.id)}
                            className="px-3 py-2 bg-loss text-white rounded-lg text-xs font-bold hover:bg-loss/90"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            className="px-2 py-2 text-muted-dark hover:text-white"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRejectingId(opp.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-card border border-loss/30 text-loss rounded-lg text-xs font-bold hover:bg-loss/10 transition-colors"
                        >
                          <ThumbsDown size={14} /> REJECT
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════ SECTION 4: WHAT THE BRAIN LEARNED ══════════════ */}
      <div className="bg-card border border-accent/20 rounded-lg overflow-hidden">
        <button
          onClick={() => setBeliefsExpanded(!beliefsExpanded)}
          className="w-full flex items-center justify-between p-5 hover:bg-accent/5 transition-colors"
        >
          <h2 className="text-sm uppercase tracking-wider text-muted-dark font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            WHAT THE BRAIN LEARNED
            <span className="ml-2 text-accent">({dashboard.beliefs.length} beliefs)</span>
          </h2>
          {beliefsExpanded ? <ChevronUp size={16} className="text-muted-dark" /> : <ChevronDown size={16} className="text-muted-dark" />}
        </button>

        {beliefsExpanded && (
          <div className="border-t border-accent/10 p-5 space-y-5">
            {/* Changed beliefs */}
            {changedBeliefs.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gold uppercase tracking-wide mb-2">Beliefs That Changed</h3>
                <div className="space-y-2">
                  {changedBeliefs.map(b => (
                    <div key={b.key} className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2">
                      <span className="text-xs text-white font-mono">{b.key}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-dark">{formatPercent(b.previousValue!)}</span>
                        <ArrowRight size={10} className={b.value > (b.previousValue ?? 0) ? 'text-win' : 'text-loss'} />
                        <span className={`text-xs font-bold ${b.value > (b.previousValue ?? 0) ? 'text-win' : 'text-loss'}`}>
                          {formatPercent(b.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* High confidence */}
            {highBeliefs.length > 0 && (
              <BeliefGroup label="High Confidence" beliefs={highBeliefs} color="text-win" />
            )}

            {/* Medium confidence */}
            {medBeliefs.length > 0 && (
              <BeliefGroup label="Medium Confidence" beliefs={medBeliefs} color="text-gold" />
            )}

            {/* Low confidence — needs more evidence */}
            {lowBeliefs.length > 0 && (
              <BeliefGroup label="Low Confidence (needs more evidence)" beliefs={lowBeliefs} color="text-loss" />
            )}

            {dashboard.beliefs.length === 0 && (
              <p className="text-sm text-muted-dark text-center py-4">
                No beliefs yet. Click &quot;Initialize&quot; to seed beliefs from historical data.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════ SECTION 5: OPPORTUNITY HISTORY ═════════════════ */}
      <div className="bg-card border border-accent/20 rounded-lg p-5">
        <h2 className="text-sm uppercase tracking-wider text-muted-dark font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          OPPORTUNITY HISTORY
        </h2>

        {/* Tab bar */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {['all', 'proposed', 'approved', 'rejected', 'executed', 'completed'].map(tab => (
            <button
              key={tab}
              onClick={() => { setHistoryTab(tab); fetchHistory(tab); }}
              className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors whitespace-nowrap ${
                historyTab === tab
                  ? 'bg-accent/20 text-accent'
                  : 'text-muted-dark hover:text-white hover:bg-card'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {historyLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-dark" />
          </div>
        ) : historyOpps.length === 0 ? (
          <p className="text-sm text-muted-dark text-center py-8">No opportunities found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-accent/10">
                  <th className="text-left py-2 px-2 text-muted-dark font-semibold uppercase tracking-wide">Type</th>
                  <th className="text-left py-2 px-2 text-muted-dark font-semibold uppercase tracking-wide">Action</th>
                  <th className="text-right py-2 px-2 text-muted-dark font-semibold uppercase tracking-wide">EV</th>
                  <th className="text-right py-2 px-2 text-muted-dark font-semibold uppercase tracking-wide">Expected</th>
                  <th className="text-center py-2 px-2 text-muted-dark font-semibold uppercase tracking-wide">Status</th>
                  <th className="text-right py-2 px-2 text-muted-dark font-semibold uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody>
                {historyOpps.map(opp => (
                  <tr key={opp.id} className="border-b border-accent/5 hover:bg-accent/5">
                    <td className="py-2 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${actionTypeColor(opp.actionType)}`}>
                        {actionTypeLabel(opp.actionType)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-white max-w-[300px] truncate">{opp.whyThis}</td>
                    <td className="py-2 px-2 text-right font-bold text-gold" style={{ fontFamily: 'var(--font-number)' }}>
                      {opp.evScore.toFixed(4)}
                    </td>
                    <td className="py-2 px-2 text-right text-accent" style={{ fontFamily: 'var(--font-number)' }}>
                      {opp.expectedASBs.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <StatusBadge status={opp.status} />
                    </td>
                    <td className="py-2 px-2 text-right text-muted-dark">
                      {new Date(opp.proposedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════ SECTION 6: WHY NOT LOG ═════════════════════════ */}
      <div className="bg-card border border-accent/20 rounded-lg overflow-hidden">
        <button
          onClick={() => setWhyNotExpanded(!whyNotExpanded)}
          className="w-full flex items-center justify-between p-5 hover:bg-accent/5 transition-colors"
        >
          <h2 className="text-sm uppercase tracking-wider text-muted-dark font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            {whyNotExpanded ? <Eye size={16} /> : <EyeOff size={16} />}
            WHY NOT LOG
            <span className="text-muted-dark">({rejectedOpps.length})</span>
          </h2>
          {whyNotExpanded ? <ChevronUp size={16} className="text-muted-dark" /> : <ChevronDown size={16} className="text-muted-dark" />}
        </button>

        {whyNotExpanded && (
          <div className="border-t border-accent/10 p-5">
            {rejectedOpps.length === 0 ? (
              <p className="text-sm text-muted-dark text-center py-4">
                No rejected opportunities yet. As you reject actions, they&apos;ll appear here with reasons.
              </p>
            ) : (
              <div className="space-y-3">
                {rejectedOpps.map(opp => (
                  <div key={opp.id} className="bg-background/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${actionTypeColor(opp.actionType)}`}>
                        {actionTypeLabel(opp.actionType)}
                      </span>
                      <span className="text-[10px] text-muted-dark">
                        {new Date(opp.proposedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-white mb-1">{opp.whyThis}</p>
                    <p className="text-xs text-loss">
                      Rejected: {opp.rejection_reason || 'No reason provided'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function MetricCard({ label, value, icon, subtitle, highlight, valueColor }: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  subtitle?: string;
  highlight?: boolean;
  valueColor?: string;
}) {
  return (
    <div className={`rounded-lg p-4 ${highlight ? 'bg-gold/10 border border-gold/30' : 'bg-card border border-accent/20'}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-muted-dark font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          {label}
        </span>
      </div>
      <p className={`text-2xl font-bold ${valueColor || (highlight ? 'text-gold' : 'text-white')}`} style={{ fontFamily: 'var(--font-number)' }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-[10px] text-muted-dark mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-dark font-bold mb-0.5">{label}</p>
      <p className="text-xs text-muted leading-relaxed">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-background/50 rounded px-2 py-1.5 text-center">
      <p className="text-[10px] text-muted-dark">{label}</p>
      <p className={`text-xs font-bold ${color || 'text-white'} flex items-center justify-center gap-1`} style={{ fontFamily: 'var(--font-number)' }}>
        {icon}{value}
      </p>
    </div>
  );
}

function BeliefGroup({ label, beliefs, color }: { label: string; beliefs: Belief[]; color: string }) {
  return (
    <div>
      <h3 className={`text-xs font-bold ${color} uppercase tracking-wide mb-2`}>{label}</h3>
      <div className="space-y-1.5">
        {beliefs.map(b => (
          <div key={b.key} className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white font-mono">{b.key}</span>
              <span className="text-[10px] text-muted-dark">(n={b.sampleSize})</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white" style={{ fontFamily: 'var(--font-number)' }}>
                {formatPercent(b.value)}
              </span>
              <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    b.confidence >= 0.7 ? 'bg-win' : b.confidence >= 0.5 ? 'bg-gold' : 'bg-loss'
                  }`}
                  style={{ width: `${b.confidence * 100}%` }}
                />
              </div>
              <span className={`text-[10px] ${color}`}>
                {(b.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    proposed: 'bg-blue-500/20 text-blue-400',
    approved: 'bg-win/20 text-win',
    rejected: 'bg-loss/20 text-loss',
    executed: 'bg-gold/20 text-gold',
    measuring: 'bg-accent/20 text-accent',
    completed: 'bg-win/20 text-win',
    expired: 'bg-muted/20 text-muted-dark',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${styles[status] || 'bg-muted/20 text-muted-dark'}`}>
      {status}
    </span>
  );
}
