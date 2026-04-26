'use client';

import { useEffect, useState } from 'react';
import { insightsAPI } from '@/lib/api';
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

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

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      insightsAPI.get().catch(() => ({ data: { insights: [] } })),
      insightsAPI.weeklyReports().catch(() => ({ data: { reports: [] } })),
    ]).then(([insightsRes, reportsRes]) => {
      setInsights(insightsRes.data.insights || []);
      setReports(reportsRes.data.reports || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
