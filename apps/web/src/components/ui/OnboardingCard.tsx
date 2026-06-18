'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Upload, Wifi, PenLine, ChevronRight, X, Info } from 'lucide-react';

interface OnboardingCardProps {
  settledBetCount: number;
  betsNeeded: number;
  emailVerified?: boolean;
  onResendVerification?: () => void;
}

const SCORE_TIERS = [
  { min: 90, label: 'Legend', color: '#ff6f00' },
  { min: 80, label: 'Elite', color: '#FFD700' },
  { min: 70, label: 'Sharp', color: '#22c55e' },
  { min: 60, label: 'Developing', color: '#60a5fa' },
  { min: 0, label: 'Recreational', color: '#9e9e9e' },
];

export default function OnboardingCard({ settledBetCount, betsNeeded, emailVerified, onResendVerification }: OnboardingCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  if (dismissed) return null;

  const progress = Math.min((settledBetCount / betsNeeded) * 100, 100);
  const isUnlocked = settledBetCount >= betsNeeded;

  if (isUnlocked) return null;

  return (
    <div className="bg-card border border-accent/20 rounded-lg p-6 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 text-muted-dark hover:text-white transition-colors"
      >
        <X size={16} />
      </button>

      <h2 className="text-lg font-bold uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-display)' }}>
        Get Your Gammbler Score
      </h2>
      <p className="text-sm text-muted-dark mb-6">Three ways to build your score. Pick the fastest for you.</p>

      {/* Email verification banner */}
      {emailVerified === false && (
        <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 mb-4 flex items-center justify-between">
          <p className="text-sm text-gold">Verify your email to secure your account</p>
          {onResendVerification && (
            <button onClick={onResendVerification} className="text-xs text-gold font-semibold hover:text-gold/80 transition-colors">
              Resend
            </button>
          )}
        </div>
      )}

      {/* Three paths */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Link
          href="/dashboard/settings"
          className="bg-accent/10 border border-accent/30 rounded-lg p-4 hover:bg-accent/20 transition-colors group"
        >
          <div className="flex items-center gap-2 mb-2">
            <Wifi size={18} className="text-accent" />
            <span className="text-xs font-bold text-accent uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              Fastest
            </span>
          </div>
          <p className="text-sm font-semibold text-white mb-1">Connect Sportsbook</p>
          <p className="text-xs text-muted-dark">Import all your bets instantly</p>
          <ChevronRight size={14} className="text-accent mt-2 group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/dashboard/add-bet"
          className="bg-background border border-accent/20 rounded-lg p-4 hover:bg-card transition-colors group"
        >
          <div className="flex items-center gap-2 mb-2">
            <Upload size={18} className="text-muted-dark" />
            <span className="text-xs font-bold text-muted-dark uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              Quick
            </span>
          </div>
          <p className="text-sm font-semibold text-white mb-1">Upload CSV <span className="text-[10px] text-gold">(Pro)</span></p>
          <p className="text-xs text-muted-dark">Bulk import from a spreadsheet</p>
          <ChevronRight size={14} className="text-muted-dark mt-2 group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/dashboard/add-bet"
          className="bg-background border border-accent/20 rounded-lg p-4 hover:bg-card transition-colors group"
        >
          <div className="flex items-center gap-2 mb-2">
            <PenLine size={18} className="text-muted-dark" />
            <span className="text-xs font-bold text-muted-dark uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
              Manual
            </span>
          </div>
          <p className="text-sm font-semibold text-white mb-1">Add Bets</p>
          <p className="text-xs text-muted-dark">Enter bets one at a time</p>
          <ChevronRight size={14} className="text-muted-dark mt-2 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-white font-medium">Score Unlock Progress</p>
          <p className="text-sm font-bold text-accent" style={{ fontFamily: 'var(--font-number)' }}>
            {settledBetCount}/{betsNeeded} bets
          </p>
        </div>
        <div className="w-full h-3 bg-background rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent/60 to-accent rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-dark mt-1">
          {betsNeeded - settledBetCount} more settled bet{betsNeeded - settledBetCount !== 1 ? 's' : ''} to unlock your Gammbler Score
        </p>
      </div>

      {/* Score explainer */}
      <button
        onClick={() => setShowScoreInfo(!showScoreInfo)}
        className="flex items-center gap-2 text-xs text-muted-dark hover:text-accent transition-colors"
      >
        <Info size={14} />
        How Your Score Works
      </button>

      {showScoreInfo && (
        <div className="mt-3 bg-background border border-accent/10 rounded-lg p-4">
          <div className="grid grid-cols-5 gap-2 mb-4">
            {SCORE_TIERS.map((tier) => (
              <div key={tier.label} className="text-center">
                <p className="text-lg font-bold" style={{ color: tier.color, fontFamily: 'var(--font-number)' }}>
                  {tier.min}+
                </p>
                <p className="text-xs" style={{ color: tier.color }}>{tier.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-dark leading-relaxed">
            Your Gammbler Score (0–100) measures real betting performance. It factors in{' '}
            <span className="text-white">ROI</span>,{' '}
            <span className="text-white">consistency</span>,{' '}
            <span className="text-white">volume</span>,{' '}
            <span className="text-white">recency</span>, and{' '}
            <span className="text-white">closing line value</span>.
            Recent bets matter more. Win streaks help, losing streaks hurt. The more you bet, the more accurate your score becomes.
          </p>
        </div>
      )}
    </div>
  );
}
