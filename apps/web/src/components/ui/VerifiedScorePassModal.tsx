'use client';

import { useState } from 'react';
import { X, Upload, ShieldCheck, Crown, Zap, CheckCircle } from 'lucide-react';
import { stripeAPI } from '@/lib/api';

interface VerifiedScorePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCsvUpload: () => void;
}

export default function VerifiedScorePassModal({ isOpen, onClose, onCsvUpload }: VerifiedScorePassModalProps) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVerifiedPass = async () => {
    setLoading('verified');
    try {
      const res = await stripeAPI.createVerifiedPassCheckout();
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch {
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleUpgradePro = async () => {
    setLoading('pro');
    try {
      const res = await stripeAPI.createCheckout();
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch {
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-accent/30 rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-2 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              Choose How You&apos;d Like to Build Your Score
            </h2>
            <p className="text-sm text-muted-dark mt-1">
              Your betting score is always free. Pick the method that works for you.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-dark hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Option 1: CSV Upload (Free) */}
          <button
            onClick={() => { onClose(); onCsvUpload(); }}
            className="w-full text-left bg-secondary/50 border border-accent/10 rounded-xl p-5 hover:border-accent/30 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Upload size={20} className="text-accent" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    Upload CSV
                  </h3>
                  <span className="text-xs bg-win/20 text-win px-2 py-0.5 rounded-full font-semibold">FREE</span>
                </div>
                <p className="text-sm text-muted-dark mt-1">
                  Export your betting history from any sportsbook and upload it here.
                </p>
              </div>
            </div>
          </button>

          {/* Option 2: Verified Score Pass ($4.99) — Highlighted */}
          <button
            onClick={handleVerifiedPass}
            disabled={loading === 'verified'}
            className="w-full text-left bg-accent/5 border-2 border-accent rounded-xl p-5 hover:bg-accent/10 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-accent text-background text-xs font-bold px-3 py-1 rounded-bl-lg" style={{ fontFamily: 'var(--font-display)' }}>
              RECOMMENDED
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={20} className="text-accent" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-accent" style={{ fontFamily: 'var(--font-display)' }}>
                    Verified Score Pass
                  </h3>
                  <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-semibold">$4.99</span>
                  <span className="text-xs text-muted-dark">one-time</span>
                </div>
                <p className="text-sm text-white font-medium mt-1">
                  Get Your Verified Betting Score Instantly
                </p>
                <ul className="mt-2 space-y-1">
                  <li className="text-sm text-muted-dark flex items-center gap-2">
                    <Zap size={14} className="text-accent flex-shrink-0" />
                    Instant sportsbook connection
                  </li>
                  <li className="text-sm text-muted-dark flex items-center gap-2">
                    <CheckCircle size={14} className="text-accent flex-shrink-0" />
                    Verified score badge on your profile
                  </li>
                  <li className="text-sm text-muted-dark flex items-center gap-2">
                    <CheckCircle size={14} className="text-accent flex-shrink-0" />
                    Sync bets from your sportsbook
                  </li>
                </ul>
                {loading === 'verified' && (
                  <p className="text-xs text-accent mt-2 animate-pulse">Redirecting to checkout...</p>
                )}
              </div>
            </div>
          </button>

          {/* Option 3: Upgrade to Pro ($8.99/mo) */}
          <button
            onClick={handleUpgradePro}
            disabled={loading === 'pro'}
            className="w-full text-left bg-secondary/50 border border-accent/10 rounded-xl p-5 hover:border-accent/30 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                <Crown size={20} className="text-gold" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    Upgrade to Pro
                  </h3>
                  <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full font-semibold">$8.99/mo</span>
                </div>
                <p className="text-sm text-muted-dark mt-1">
                  Includes sportsbook sync + all premium features
                </p>
                <ul className="mt-2 space-y-1">
                  <li className="text-sm text-muted-dark flex items-center gap-2">
                    <CheckCircle size={14} className="text-gold flex-shrink-0" />
                    Everything in Verified Score Pass
                  </li>
                  <li className="text-sm text-muted-dark flex items-center gap-2">
                    <CheckCircle size={14} className="text-gold flex-shrink-0" />
                    Sport-specific rankings &amp; analytics
                  </li>
                  <li className="text-sm text-muted-dark flex items-center gap-2">
                    <CheckCircle size={14} className="text-gold flex-shrink-0" />
                    All future premium features
                  </li>
                </ul>
                {loading === 'pro' && (
                  <p className="text-xs text-gold mt-2 animate-pulse">Redirecting to checkout...</p>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <p className="text-xs text-muted-dark text-center">
            Your score is always free to calculate. These options unlock different ways to track your bets.
          </p>
        </div>
      </div>
    </div>
  );
}
