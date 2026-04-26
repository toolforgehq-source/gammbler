'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  BarChart3,
  Trophy,
  Users,
  Zap,
  Shield,
  ArrowRight,
  ChevronDown,
  Check,
} from 'lucide-react';

const features = [
  {
    icon: BarChart3,
    title: 'Your Record',
    description: 'Every bet across every sportsbook, unified into one clean dashboard. Win rate, ROI, P/L — all in one place.',
  },
  {
    icon: Trophy,
    title: 'Your Score',
    description: 'The Gammbler Score — a proprietary 0-100 rating based on win rate, ROI, closing line value, and consistency.',
  },
  {
    icon: Users,
    title: 'Your Reputation',
    description: 'Compete on leaderboards, earn badges, and build a verified betting identity. Show the world your edge.',
  },
];

const platforms = [
  'DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'ESPN Bet',
  'PointsBet', 'PrizePicks', 'Underdog Fantasy',
];

const faqs = [
  {
    q: 'How does Gammbler connect to my sportsbooks?',
    a: 'We use SharpSports — a secure, encrypted connection to your sportsbook accounts. Gammbler never sees your sportsbook password.',
  },
  {
    q: 'What is the Gammbler Score?',
    a: 'A proprietary 0-100 rating that measures your betting skill using win rate, ROI, closing line value, stake consistency, and volume. Each sport has its own independent score.',
  },
  {
    q: 'Is my financial data visible to others?',
    a: 'Never. Dollar amounts are private. Only your win rate, ROI percentage, and Gammbler Score are shown on leaderboards and profiles.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel in one tap from Settings. You keep read-only access to your data for 30 days.',
  },
  {
    q: 'What sports are supported?',
    a: 'NFL, NBA, MLB, NHL, CFB, CBB, Soccer, PrizePicks props, and daily fantasy. More coming soon.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-sm border-b border-accent/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Image src="/images/logo-main.png" alt="Gammbler" width={160} height={36} className="h-9 w-auto" priority />
          <div className="flex items-center gap-6">
            <Link href="/signin" className="text-sm text-muted hover:text-white transition-colors">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="bg-accent text-background px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-accent-light transition-colors"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1
            className="text-6xl md:text-8xl font-extrabold uppercase tracking-tight leading-none mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Know Your <span className="text-accent">Edge</span>
          </h1>
          <p className="text-xl text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            You bet across 6 apps with no idea how you&apos;re actually doing.
            Gammbler connects your sportsbooks and tells you the truth — your record, your score, your ranking.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="bg-accent text-background px-8 py-4 rounded-lg text-lg font-bold uppercase tracking-wider hover:bg-accent-light transition-colors flex items-center gap-2"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Start Free Trial <ArrowRight size={20} />
            </Link>
          </div>
          <p className="text-sm text-muted-dark mt-4">14 days free. No credit card required.</p>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 px-6 bg-secondary">
        <div className="max-w-4xl mx-auto text-center">
          <h2
            className="text-3xl md:text-4xl font-bold uppercase tracking-wider mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            The Problem
          </h2>
          <p className="text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            50 million Americans bet on sports across 4-6 different platforms. DraftKings, FanDuel, BetMGM, PrizePicks —
            you&apos;re everywhere with no unified view. No score. No identity. No idea if you&apos;re actually sharp or just lucky.
          </p>
        </div>
      </section>

      {/* Solution — 3 Columns */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-bold uppercase tracking-wider mb-12 text-center"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            The Solution
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-card border border-accent/20 rounded-lg p-8 text-center">
                  <div className="w-14 h-14 rounded-lg bg-accent/20 flex items-center justify-center mx-auto mb-4">
                    <Icon size={28} className="text-accent" />
                  </div>
                  <h3 className="text-xl font-bold uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                    {f.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Supported Platforms */}
      <section className="py-20 px-6 bg-secondary">
        <div className="max-w-4xl mx-auto text-center">
          <h2
            className="text-3xl font-bold uppercase tracking-wider mb-8"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Connects to Your Sportsbooks
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {platforms.map((p) => (
              <span
                key={p}
                className="bg-card border border-accent/20 px-5 py-2.5 rounded-lg text-sm text-muted font-medium"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6">
        <div className="max-w-lg mx-auto text-center">
          <h2
            className="text-3xl font-bold uppercase tracking-wider mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Simple Pricing
          </h2>
          <div className="bg-card border-2 border-accent rounded-lg p-8">
            <p className="text-5xl font-bold text-accent mb-2" style={{ fontFamily: 'var(--font-number)' }}>$8.99</p>
            <p className="text-muted-dark mb-6">/month after 14-day free trial</p>
            <ul className="space-y-3 text-left mb-8">
              {[
                'Full betting dashboard & analytics',
                'Gammbler Score across all sports',
                'Friend & national leaderboards',
                'Personalized AI insights',
                'Achievement badges',
                'Shareable score cards',
                'Weekly report cards',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-muted">
                  <Check size={16} className="text-accent flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="block w-full bg-accent text-background font-bold py-3 rounded-lg uppercase tracking-wider hover:bg-accent-light transition-colors text-center"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Start Free Trial
            </Link>
            <p className="text-xs text-muted-dark mt-3">No credit card required. Cancel anytime.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-secondary">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-3xl font-bold uppercase tracking-wider mb-10 text-center"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            FAQ
          </h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.q} className="bg-card border border-accent/20 rounded-lg group">
                <summary className="flex items-center justify-between p-5 cursor-pointer text-sm font-medium text-white">
                  {faq.q}
                  <ChevronDown size={18} className="text-muted-dark group-open:rotate-180 transition-transform" />
                </summary>
                <p className="px-5 pb-5 text-sm text-muted leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-accent/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Image src="/images/logo-main.png" alt="Gammbler" width={120} height={28} className="h-7 w-auto" />
          <div className="flex gap-6 text-sm text-muted-dark">
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/responsible-gambling" className="hover:text-white transition-colors">Responsible Gambling</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
