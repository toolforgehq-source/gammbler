'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import {
  BarChart3,
  Trophy,
  Users,
  Zap,
  Shield,
  ArrowRight,
  ChevronDown,
  Check,
  TrendingUp,
  Target,
  Share2,
  Lock,
  Star,
  Activity,
} from 'lucide-react';

const features = [
  {
    icon: BarChart3,
    title: 'Unified Dashboard',
    description: 'Every bet from every sportsbook in one place. Win rate, ROI, P/L tracked automatically across all platforms.',
    stat: '6+',
    statLabel: 'Platforms synced',
  },
  {
    icon: Target,
    title: 'Gammbler Score',
    description: 'A proprietary 0–100 rating that measures your true betting skill. Based on win rate, ROI, CLV, and consistency.',
    stat: '0-100',
    statLabel: 'Precision rating',
  },
  {
    icon: TrendingUp,
    title: 'AI Insights',
    description: 'Personalized analysis of your betting patterns. Know your edges, fix your leaks, improve your strategy.',
    stat: 'Weekly',
    statLabel: 'Performance reports',
  },
  {
    icon: Trophy,
    title: 'Leaderboards',
    description: 'Compete nationally and with friends across 10 sports. See where you actually rank among real bettors.',
    stat: '20',
    statLabel: 'Leaderboard categories',
  },
  {
    icon: Share2,
    title: 'Shareable Cards',
    description: 'Generate branded score cards to share on social media. Flex your record with verified, tamper-proof stats.',
    stat: '1-Tap',
    statLabel: 'Share to social',
  },
  {
    icon: Shield,
    title: 'Bank-Level Security',
    description: 'Encrypted sportsbook connections via SharpSports. We never see your passwords or financial data.',
    stat: '256-bit',
    statLabel: 'AES encryption',
  },
];

const platforms = [
  { name: 'DraftKings', color: '#61B252' },
  { name: 'FanDuel', color: '#1493FF' },
  { name: 'BetMGM', color: '#C4A44D' },
  { name: 'Caesars', color: '#1B3C34' },
  { name: 'ESPN Bet', color: '#CD1141' },
  { name: 'PointsBet', color: '#ED1C24' },
  { name: 'PrizePicks', color: '#6C4DFF' },
  { name: 'Underdog', color: '#FF6B35' },
];

const stats = [
  { value: '50M+', label: 'US Sports Bettors' },
  { value: '10', label: 'Sport Scores' },
  { value: '$8.99', label: 'Per Month' },
  { value: '14', label: 'Day Free Trial' },
];

const scoreTiers = [
  { name: 'Recreational', range: '0-40', color: '#9e9e9e' },
  { name: 'Developing', range: '41-60', color: '#42a5f5' },
  { name: 'Sharp', range: '61-75', color: '#4caf50' },
  { name: 'Elite', range: '76-90', color: '#FFD700' },
  { name: 'Legend', range: '91-100', color: '#ff6f00' },
];

const freeFeatures = [
  'Overall Gammbler Score',
  'Basic record (W-L)',
  'National leaderboards (view)',
  'Community feed (read only)',
  '1 sportsbook connection',
  'Manual bet entry',
];

const proFeatures = [
  'All 10 sport-specific scores',
  'Full analytics & ROI breakdown',
  'Friend & national leaderboards',
  'Personalized AI insights',
  'Unlimited sportsbook connections',
  'CSV bet import',
  'Shareable score cards',
  'Achievement badges',
  'Weekly performance reports',
];

const faqs = [
  {
    q: 'How does Gammbler connect to my sportsbooks?',
    a: 'We use SharpSports — a secure, encrypted connection to your sportsbook accounts. Gammbler never sees your sportsbook password. Your bets sync automatically in real-time.',
  },
  {
    q: 'What exactly is the Gammbler Score?',
    a: 'A proprietary 0-100 rating that measures your true betting skill. It factors in win rate (40%), ROI (40%), closing line value (10%), stake consistency (5%), volume (3%), and diversity (2%), with recency weighting so recent performance matters most.',
  },
  {
    q: 'Is my financial data visible to others?',
    a: 'Never. Dollar amounts are completely private. Only your win rate, ROI percentage, Gammbler Score, and tier are visible on leaderboards and profiles. You control what others see.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel in one tap from your settings — no hoops, no phone calls. After cancellation, you keep read-only access to your data for 30 days.',
  },
  {
    q: 'What sports are supported?',
    a: 'NFL, NBA, MLB, NHL, College Football, College Basketball, Soccer, PrizePicks props, and Daily Fantasy. Each sport has its own independent Gammbler Score, with 10 settled bets required to unlock each one.',
  },
  {
    q: 'What do I get with the free tier?',
    a: 'Free users get their overall Gammbler Score, basic win-loss record, national leaderboard access (view only), community feed (read only), one sportsbook connection, and manual bet entry. Upgrade to Pro to unlock full analytics, all 10 sport scores, friend leaderboards, and more.',
  },
];

function useIntersectionObserver() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const el = ref.current;
    if (el) {
      const targets = el.querySelectorAll('.reveal');
      targets.forEach((t) => observer.observe(t));
      return () => targets.forEach((t) => observer.unobserve(t));
    }
  }, []);

  return ref;
}

export default function HomePage() {
  const observerRef = useIntersectionObserver();

  return (
    <div ref={observerRef} className="min-h-screen overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/[0.04]" style={{ background: 'rgba(10, 15, 11, 0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/images/logo-main.png" alt="Gammbler" width={160} height={36} className="h-8 w-auto" priority />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/signin" className="text-sm text-[#9e9e9e] hover:text-white transition-colors duration-300 hidden sm:block">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="btn-glow text-white px-5 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 px-6 dot-grid">
        {/* Background orbs */}
        <div className="hero-orb w-[600px] h-[600px] -top-40 -left-40 bg-[#4caf50]/[0.04]" style={{ animation: 'pulse-glow 8s ease-in-out infinite' }} />
        <div className="hero-orb w-[500px] h-[500px] top-20 -right-40 bg-[#4caf50]/[0.03]" style={{ animation: 'pulse-glow 10s ease-in-out infinite 2s' }} />
        <div className="hero-orb w-[300px] h-[300px] bottom-0 left-1/3 bg-[#4caf50]/[0.02]" style={{ animation: 'pulse-glow 6s ease-in-out infinite 4s' }} />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.02] mb-8">
            <span className="w-2 h-2 rounded-full bg-[#4caf50] animate-pulse" />
            <span className="text-xs text-[#9e9e9e] uppercase tracking-widest font-medium" style={{ fontFamily: 'var(--font-display)' }}>
              The Sports Betting Identity Platform
            </span>
          </div>

          <h1
            className="animate-fade-up delay-100 text-5xl sm:text-7xl md:text-[5.5rem] lg:text-[6.5rem] font-black uppercase tracking-tight leading-[0.9] mb-8"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Know Your{' '}
            <span className="text-gradient">Edge</span>
          </h1>

          <p className="animate-fade-up delay-200 text-lg md:text-xl text-[#9e9e9e] max-w-2xl mx-auto mb-12 leading-relaxed">
            You bet across 6 apps with no idea how you&apos;re actually doing.
            Gammbler connects your sportsbooks and tells you the truth — your record, your score, your ranking.
          </p>

          <div className="animate-fade-up delay-300 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="btn-glow text-white px-10 py-4 rounded-xl text-lg font-bold uppercase tracking-wider flex items-center gap-3 w-full sm:w-auto justify-center"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Start Free Trial <ArrowRight size={20} />
            </Link>
            <Link
              href="#how-it-works"
              className="btn-outline text-white px-10 py-4 rounded-xl text-lg font-bold uppercase tracking-wider flex items-center gap-3 w-full sm:w-auto justify-center"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              See How It Works
            </Link>
          </div>

          <p className="animate-fade-up delay-400 text-sm text-[#6b6b6b] mt-6">
            14 days free &middot; No credit card required &middot; Cancel anytime
          </p>
        </div>

        {/* Score preview floating element */}
        <div className="animate-fade-up delay-600 max-w-xs mx-auto mt-16 relative">
          <div className="glass-card rounded-2xl p-6 text-center">
            <p className="text-xs text-[#9e9e9e] uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-display)' }}>Your Gammbler Score</p>
            <div className="relative w-28 h-28 mx-auto mb-3">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(76,175,80,0.1)" strokeWidth="6" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="#4caf50" strokeWidth="6" strokeLinecap="round" className="score-ring" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold text-gradient stat-glow" style={{ fontFamily: 'var(--font-number)' }}>78.4</span>
              </div>
            </div>
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-display)', background: 'rgba(76,175,80,0.15)', color: '#4caf50' }}
            >
              Elite
            </span>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="section-divider" />
      <section className="py-12 px-6" style={{ background: 'rgba(14, 22, 16, 0.5)' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
              <p className="text-3xl md:text-4xl font-bold text-gradient stat-glow mb-1" style={{ fontFamily: 'var(--font-number)' }}>{s.value}</p>
              <p className="text-xs text-[#6b6b6b] uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="section-divider" />

      {/* Problem / Solution */}
      <section id="how-it-works" className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Problem */}
          <div className="max-w-3xl mx-auto text-center mb-20 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            <p className="text-xs text-[#4caf50] uppercase tracking-[0.2em] mb-4 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              The Problem
            </p>
            <h2
              className="text-3xl md:text-5xl font-bold uppercase tracking-tight leading-tight mb-6"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              50 Million Bettors.{' '}
              <span className="text-[#6b6b6b]">Zero Visibility.</span>
            </h2>
            <p className="text-lg text-[#9e9e9e] leading-relaxed">
              DraftKings, FanDuel, BetMGM, PrizePicks — you&apos;re everywhere with no unified view.
              No score. No identity. No idea if you&apos;re actually sharp or just lucky.
            </p>
          </div>

          {/* Score tiers visualization */}
          <div className="max-w-3xl mx-auto mb-20 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            <p className="text-xs text-[#4caf50] uppercase tracking-[0.2em] mb-6 font-semibold text-center" style={{ fontFamily: 'var(--font-display)' }}>
              Gammbler Score Tiers
            </p>
            <div className="flex gap-2 md:gap-3">
              {scoreTiers.map((tier) => (
                <div
                  key={tier.name}
                  className="flex-1 glass-card rounded-xl p-3 md:p-4 text-center"
                >
                  <div
                    className="w-3 h-3 rounded-full mx-auto mb-2"
                    style={{ background: tier.color, boxShadow: `0 0 12px ${tier.color}40` }}
                  />
                  <p className="text-xs md:text-sm font-bold text-white mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                    {tier.name}
                  </p>
                  <p className="text-[10px] md:text-xs text-[#6b6b6b]" style={{ fontFamily: 'var(--font-number)' }}>
                    {tier.range}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Features grid */}
          <div className="text-center mb-14 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            <p className="text-xs text-[#4caf50] uppercase tracking-[0.2em] mb-4 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              The Solution
            </p>
            <h2
              className="text-3xl md:text-5xl font-bold uppercase tracking-tight leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Everything You Need.{' '}
              <span className="text-gradient">One Platform.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="glass-card rounded-2xl p-7 group reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0"
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(76,175,80,0.1)' }}>
                      <Icon size={22} className="text-[#4caf50]" />
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gradient" style={{ fontFamily: 'var(--font-number)' }}>{f.stat}</p>
                      <p className="text-[10px] text-[#6b6b6b] uppercase tracking-wider">{f.statLabel}</p>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold uppercase tracking-wide mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                    {f.title}
                  </h3>
                  <p className="text-sm text-[#9e9e9e] leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Platforms */}
      <div className="section-divider" />
      <section className="py-24 px-6" style={{ background: 'rgba(14, 22, 16, 0.3)' }}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            <p className="text-xs text-[#4caf50] uppercase tracking-[0.2em] mb-4 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Integrations
            </p>
            <h2
              className="text-3xl md:text-5xl font-bold uppercase tracking-tight leading-tight mb-4"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Connects to Your{' '}
              <span className="text-gradient">Sportsbooks</span>
            </h2>
            <p className="text-[#9e9e9e] mb-12 max-w-xl mx-auto">
              Automatic sync via SharpSports. Your bets appear instantly — no manual entry required.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            {platforms.map((p) => (
              <div
                key={p.name}
                className="platform-badge bg-[#111a13] px-6 py-3.5 rounded-xl flex items-center gap-3 cursor-default"
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color, boxShadow: `0 0 8px ${p.color}60` }} />
                <span className="text-sm font-medium text-white">{p.name}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#6b6b6b] mt-8">
            + CSV import for any platform &middot; Manual entry always available
          </p>
        </div>
      </section>
      <div className="section-divider" />

      {/* Pricing */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            <p className="text-xs text-[#4caf50] uppercase tracking-[0.2em] mb-4 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Pricing
            </p>
            <h2
              className="text-3xl md:text-5xl font-bold uppercase tracking-tight leading-tight mb-4"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Start Free.{' '}
              <span className="text-gradient">Go Pro When Ready.</span>
            </h2>
            <p className="text-[#9e9e9e] max-w-xl mx-auto">
              Get your score for free. Upgrade when you want the full picture.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            {/* Free */}
            <div className="glass-card rounded-2xl p-8 md:p-10">
              <div className="mb-8">
                <h3 className="text-2xl font-bold uppercase tracking-wide mb-1" style={{ fontFamily: 'var(--font-display)' }}>Free</h3>
                <p className="text-[#6b6b6b] text-sm">Forever. No credit card needed.</p>
              </div>
              <div className="mb-8">
                <span className="text-5xl font-bold text-white" style={{ fontFamily: 'var(--font-number)' }}>$0</span>
                <span className="text-[#6b6b6b] text-sm ml-1">/month</span>
              </div>
              <ul className="space-y-3.5 mb-10">
                {freeFeatures.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-[#9e9e9e]">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(76,175,80,0.1)' }}>
                      <Check size={12} className="text-[#4caf50]" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="btn-outline block w-full text-white font-bold py-4 rounded-xl uppercase tracking-wider text-center text-sm"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div className="pricing-pro rounded-2xl p-8 md:p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#4caf50]/[0.05] rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold uppercase tracking-wide mb-1" style={{ fontFamily: 'var(--font-display)' }}>Pro</h3>
                    <p className="text-[#6b6b6b] text-sm">14-day free trial included</p>
                  </div>
                  <span
                    className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                    style={{ fontFamily: 'var(--font-display)', background: 'rgba(76,175,80,0.15)', color: '#4caf50' }}
                  >
                    Most Popular
                  </span>
                </div>
                <div className="mb-8">
                  <span className="text-5xl font-bold text-gradient stat-glow" style={{ fontFamily: 'var(--font-number)' }}>$8.99</span>
                  <span className="text-[#6b6b6b] text-sm ml-1">/month</span>
                </div>
                <p className="text-xs text-[#4caf50] font-semibold mb-4">Everything in Free, plus:</p>
                <ul className="space-y-3.5 mb-10">
                  {proFeatures.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-[#9e9e9e]">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(76,175,80,0.15)' }}>
                        <Check size={12} className="text-[#4caf50]" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="btn-glow block w-full text-white font-bold py-4 rounded-xl uppercase tracking-wider text-center text-sm"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Start Free Trial
                </Link>
                <p className="text-[10px] text-[#6b6b6b] mt-4 text-center">No credit card required &middot; Cancel anytime</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <div className="section-divider" />
      <section className="py-24 px-6" style={{ background: 'rgba(14, 22, 16, 0.3)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            <p className="text-xs text-[#4caf50] uppercase tracking-[0.2em] mb-4 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Questions
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold uppercase tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Frequently Asked
            </h2>
          </div>
          <div className="space-y-3 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            {faqs.map((faq) => (
              <details key={faq.q} className="glass-card rounded-xl group">
                <summary className="flex items-center justify-between p-5 md:p-6 cursor-pointer text-sm font-medium text-white hover:text-[#4caf50] transition-colors">
                  {faq.q}
                  <ChevronDown size={18} className="text-[#6b6b6b] group-open:rotate-180 transition-transform duration-300 flex-shrink-0 ml-4" />
                </summary>
                <p className="px-5 md:px-6 pb-5 md:pb-6 text-sm text-[#9e9e9e] leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <div className="section-divider" />
      <section className="py-24 md:py-32 px-6 relative dot-grid">
        <div className="hero-orb w-[400px] h-[400px] top-0 left-1/2 -translate-x-1/2 bg-[#4caf50]/[0.04]" />
        <div className="max-w-3xl mx-auto text-center relative z-10 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
          <h2
            className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-[0.95] mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Ready to Know{' '}
            <span className="text-gradient">Your Edge</span>?
          </h2>
          <p className="text-lg text-[#9e9e9e] mb-10 max-w-xl mx-auto">
            Join the platform built for serious bettors. Your score is waiting.
          </p>
          <Link
            href="/signup"
            className="btn-glow inline-flex items-center gap-3 text-white px-12 py-5 rounded-xl text-lg font-bold uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Get Started Free <ArrowRight size={20} />
          </Link>
          <p className="text-xs text-[#6b6b6b] mt-6">No credit card required &middot; Pro starts at $8.99/mo</p>
        </div>
      </section>

      {/* Footer */}
      <div className="section-divider" />
      <footer className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Image src="/images/logo-main.png" alt="Gammbler" width={120} height={28} className="h-7 w-auto opacity-60" />
            <div className="flex flex-wrap justify-center gap-6 text-sm text-[#6b6b6b]">
              <Link href="/about" className="hover:text-white transition-colors duration-300">About</Link>
              <Link href="/privacy" className="hover:text-white transition-colors duration-300">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors duration-300">Terms</Link>
              <Link href="/responsible-gambling" className="hover:text-white transition-colors duration-300">Responsible Gambling</Link>
            </div>
          </div>
          <p className="text-center text-[10px] text-[#6b6b6b]/60 mt-8">
            &copy; {new Date().getFullYear()} Gammbler Inc. All rights reserved. Gammbler is not a sportsbook and does not accept wagers.
          </p>
        </div>
      </footer>
    </div>
  );
}
