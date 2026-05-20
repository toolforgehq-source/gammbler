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
  Crown,
  Flame,
  Medal,
  Heart,
} from 'lucide-react';

const leaderboardData = [
  { rank: 1, name: 'SharpShooter_MJ', score: 94.2, tier: 'Legend', tierColor: '#ff6f00', record: '847-412', roi: '+18.4%', sport: 'NFL' },
  { rank: 2, name: 'VegasVault', score: 91.8, tier: 'Legend', tierColor: '#ff6f00', record: '623-298', roi: '+16.1%', sport: 'NBA' },
  { rank: 3, name: 'TheLineKing', score: 89.7, tier: 'Elite', tierColor: '#FFD700', record: '1,204-589', roi: '+14.8%', sport: 'NFL' },
  { rank: 4, name: 'ParlayPete', score: 86.3, tier: 'Elite', tierColor: '#FFD700', record: '512-267', roi: '+12.3%', sport: 'MLB' },
  { rank: 5, name: 'ChalkEater99', score: 84.1, tier: 'Elite', tierColor: '#FFD700', record: '935-491', roi: '+11.7%', sport: 'NBA' },
  { rank: 6, name: 'EdgeHunterX', score: 81.9, tier: 'Elite', tierColor: '#FFD700', record: '388-213', roi: '+10.2%', sport: 'NHL' },
  { rank: 7, name: 'SteamChaser', score: 79.4, tier: 'Elite', tierColor: '#FFD700', record: '741-403', roi: '+9.8%', sport: 'NFL' },
];

const friendLeaderboard = [
  { rank: 1, name: 'You', score: 78.4, tier: 'Elite', tierColor: '#FFD700', record: '234-118', roi: '+9.2%', isYou: true },
  { rank: 2, name: 'Mike_Bets', score: 72.1, tier: 'Sharp', tierColor: '#4caf50', record: '189-112', roi: '+7.1%' },
  { rank: 3, name: 'DanTheMan', score: 68.4, tier: 'Sharp', tierColor: '#4caf50', record: '312-198', roi: '+5.4%' },
  { rank: 4, name: 'JennyPicks', score: 61.2, tier: 'Sharp', tierColor: '#4caf50', record: '145-98', roi: '+3.8%' },
  { rank: 5, name: 'CousinVinny', score: 44.7, tier: 'Developing', tierColor: '#42a5f5', record: '87-94', roi: '-2.1%' },
];

const sportScores = [
  { sport: 'NFL', score: 82.1, tier: 'Elite', color: '#FFD700' },
  { sport: 'NBA', score: 74.6, tier: 'Sharp', color: '#4caf50' },
  { sport: 'MLB', score: 69.3, tier: 'Sharp', color: '#4caf50' },
  { sport: 'NHL', score: 58.2, tier: 'Developing', color: '#42a5f5' },
  { sport: 'NCAAF', score: 77.8, tier: 'Elite', color: '#FFD700' },
  { sport: 'NCAAB', score: 63.5, tier: 'Sharp', color: '#4caf50' },
  { sport: 'Soccer', score: 51.4, tier: 'Developing', color: '#42a5f5' },
  { sport: 'MMA', score: 45.9, tier: 'Developing', color: '#42a5f5' },
  { sport: 'Props', score: 71.2, tier: 'Sharp', color: '#4caf50' },
  { sport: 'DFS', score: 66.8, tier: 'Sharp', color: '#4caf50' },
];

const scoreTiers = [
  { name: 'Recreational', range: '0-40', color: '#9e9e9e' },
  { name: 'Developing', range: '41-60', color: '#42a5f5' },
  { name: 'Sharp', range: '61-75', color: '#4caf50' },
  { name: 'Elite', range: '76-90', color: '#FFD700' },
  { name: 'Legend', range: '91-100', color: '#ff6f00' },
];

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
    description: 'A proprietary 0-100 rating that measures your true betting skill. Based on win rate, ROI, CLV, and consistency.',
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
    q: 'What sports are supported?',
    a: 'NFL, NBA, MLB, NHL, College Football, College Basketball, Soccer, MMA, PrizePicks props, and Daily Fantasy. Each sport has its own independent Gammbler Score, with 10 settled bets required to unlock each one.',
  },
  {
    q: 'What do I get for free?',
    a: 'Free users get their overall Gammbler Score, basic win-loss record, national leaderboard access (view only), community feed (read only), one sportsbook connection, and manual bet entry. Upgrade to Pro to unlock full analytics, all 10 sport scores, friend leaderboards, shareable cards, and more.',
  },
  {
    q: 'What does Pro unlock?',
    a: 'Pro gives you all 10 sport-specific scores, full ROI analytics, AI-powered insights, friend leaderboards, shareable score cards, achievement badges, unlimited sportsbook connections, CSV import, and weekly performance reports — everything you need to prove your edge.',
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

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown size={14} className="text-[#FFD700]" />;
  if (rank === 2) return <Medal size={14} className="text-[#C0C0C0]" />;
  if (rank === 3) return <Medal size={14} className="text-[#CD7F32]" />;
  return <span className="text-xs text-[#6b6b6b] font-bold" style={{ fontFamily: 'var(--font-number)' }}>{rank}</span>;
}

export default function HomePage() {
  const observerRef = useIntersectionObserver();

  return (
    <div ref={observerRef} className="min-h-screen overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/[0.04]" style={{ background: 'rgba(10, 15, 11, 0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/images/logo-main.png" alt="Gammbler" width={180} height={40} className="h-10 w-auto" priority />
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
              Join Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ========== HERO — Social/Competitive Lead ========== */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 px-6 dot-grid">
        <div className="hero-orb w-[600px] h-[600px] -top-40 -left-40 bg-[#4caf50]/[0.04]" style={{ animation: 'pulse-glow 8s ease-in-out infinite' }} />
        <div className="hero-orb w-[500px] h-[500px] top-20 -right-40 bg-[#4caf50]/[0.03]" style={{ animation: 'pulse-glow 10s ease-in-out infinite 2s' }} />
        <div className="hero-orb w-[300px] h-[300px] bottom-0 left-1/3 bg-[#4caf50]/[0.02]" style={{ animation: 'pulse-glow 6s ease-in-out infinite 4s' }} />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
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
              Every Bettor Gets a Score.{' '}
              <span className="text-gradient">Where Do You Rank?</span>
            </h1>

            <p className="animate-fade-up delay-200 text-lg md:text-xl text-[#9e9e9e] max-w-2xl mx-auto mb-12 leading-relaxed">
              Gammbler gives every sports bettor a verified score across every sportsbook. Compete on national leaderboards, challenge your friends, and share your stats on social media.
            </p>

            <div className="animate-fade-up delay-300 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="btn-glow text-white px-10 py-4 rounded-xl text-lg font-bold uppercase tracking-wider flex items-center gap-3 w-full sm:w-auto justify-center"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Get Your Score <ArrowRight size={20} />
              </Link>
              <Link
                href="#leaderboards"
                className="btn-outline text-white px-10 py-4 rounded-xl text-lg font-bold uppercase tracking-wider flex items-center gap-3 w-full sm:w-auto justify-center"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                View Leaderboards
              </Link>
            </div>
          </div>

          {/* Hero Leaderboard Preview */}
          <div className="animate-fade-up delay-500 max-w-3xl mx-auto">
            <div className="glass-card rounded-2xl overflow-hidden" style={{ cursor: 'default' }}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-[#4caf50]" />
                  <span className="text-xs text-[#9e9e9e] uppercase tracking-widest font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                    National Leaderboard — Live
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4caf50] animate-pulse" />
                  <span className="text-[10px] text-[#4caf50] uppercase tracking-wider font-semibold">Live</span>
                </div>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {leaderboardData.slice(0, 5).map((entry) => (
                  <div
                    key={entry.rank}
                    className="flex items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="w-8 flex items-center justify-center">
                      <RankIcon rank={entry.rank} />
                    </div>
                    <div className="flex-1 ml-3">
                      <span className="text-sm font-semibold text-white">{entry.name}</span>
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold" style={{ background: `${entry.tierColor}20`, color: entry.tierColor, fontFamily: 'var(--font-display)' }}>
                        {entry.tier}
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center gap-6 mr-6">
                      <div className="text-right">
                        <p className="text-xs text-[#6b6b6b] uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>Record</p>
                        <p className="text-sm text-[#9e9e9e]" style={{ fontFamily: 'var(--font-number)' }}>{entry.record}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#6b6b6b] uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>ROI</p>
                        <p className="text-sm text-[#66bb6a]" style={{ fontFamily: 'var(--font-number)' }}>{entry.roi}</p>
                      </div>
                    </div>
                    <div className="text-right min-w-[60px]">
                      <p className="text-xl font-bold text-gradient stat-glow" style={{ fontFamily: 'var(--font-number)' }}>{entry.score}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3 border-t border-white/[0.06] text-center">
                <span className="text-xs text-[#6b6b6b]">Your rank is waiting &middot; </span>
                <Link href="/signup" className="text-xs text-[#4caf50] font-semibold hover:underline">Join and find out →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SCORE SECTION ========== */}
      <div className="section-divider" />
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            <p className="text-xs text-[#4caf50] uppercase tracking-[0.2em] mb-4 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Your Betting Identity
            </p>
            <h2
              className="text-3xl md:text-5xl font-bold uppercase tracking-tight leading-tight mb-4"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              One Score to{' '}
              <span className="text-gradient">Rule Them All</span>
            </h2>
            <p className="text-[#9e9e9e] max-w-2xl mx-auto">
              Your Gammbler Score is a 0-100 rating that measures your true betting skill — across every sportsbook, every sport, displayed to one decimal point for bragging rights. Every score is shareable.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Overall Score Card */}
            <div className="reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
              <div className="glass-card rounded-2xl p-8 text-center" style={{ cursor: 'default' }}>
                <p className="text-xs text-[#9e9e9e] uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-display)' }}>Overall Gammbler Score</p>
                <div className="relative w-40 h-40 mx-auto mb-5">
                  <svg className="w-40 h-40 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(76,175,80,0.1)" strokeWidth="5" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#4caf50" strokeWidth="5" strokeLinecap="round" className="score-ring" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-bold text-gradient stat-glow" style={{ fontFamily: 'var(--font-number)' }}>78.4</span>
                  </div>
                </div>
                <span
                  className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
                  style={{ fontFamily: 'var(--font-display)', background: 'rgba(255,215,0,0.15)', color: '#FFD700' }}
                >
                  Elite
                </span>
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/[0.06]">
                  <div>
                    <p className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-number)' }}>234-118</p>
                    <p className="text-[10px] text-[#6b6b6b] uppercase tracking-wider">Record</p>
                  </div>
                  <div className="w-px h-8 bg-white/[0.06]" />
                  <div>
                    <p className="text-lg font-bold text-[#66bb6a]" style={{ fontFamily: 'var(--font-number)' }}>+9.2%</p>
                    <p className="text-[10px] text-[#6b6b6b] uppercase tracking-wider">ROI</p>
                  </div>
                  <div className="w-px h-8 bg-white/[0.06]" />
                  <div>
                    <p className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-number)' }}>352</p>
                    <p className="text-[10px] text-[#6b6b6b] uppercase tracking-wider">Total Bets</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-center gap-2">
                  <Share2 size={14} className="text-[#4caf50]" />
                  <span className="text-xs text-[#4caf50] font-semibold">Share on social media</span>
                </div>
              </div>

              {/* Score Tiers */}
              <div className="mt-6">
                <p className="text-xs text-[#6b6b6b] uppercase tracking-[0.2em] mb-3 text-center" style={{ fontFamily: 'var(--font-display)' }}>
                  Score Tiers
                </p>
                <div className="flex gap-2">
                  {scoreTiers.map((tier) => (
                    <div key={tier.name} className="flex-1 glass-card rounded-lg p-2.5 text-center" style={{ cursor: 'default' }}>
                      <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1.5" style={{ background: tier.color, boxShadow: `0 0 10px ${tier.color}40` }} />
                      <p className="text-[10px] font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>{tier.name}</p>
                      <p className="text-[9px] text-[#6b6b6b]" style={{ fontFamily: 'var(--font-number)' }}>{tier.range}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sport-Specific Scores */}
            <div className="reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0" style={{ transitionDelay: '150ms' }}>
              <div className="glass-card rounded-2xl overflow-hidden" style={{ cursor: 'default' }}>
                <div className="px-6 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Target size={16} className="text-[#4caf50]" />
                    <span className="text-xs text-[#9e9e9e] uppercase tracking-widest font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                      Sport-Specific Scores
                    </span>
                  </div>
                  <p className="text-[10px] text-[#6b6b6b] mt-1">Every sport. Every score. To the decimal.</p>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {sportScores.map((s) => (
                    <div key={s.sport} className="flex items-center px-6 py-3 hover:bg-white/[0.02] transition-colors">
                      <span className="text-sm font-bold text-white w-16" style={{ fontFamily: 'var(--font-display)' }}>{s.sport}</span>
                      <div className="flex-1 mx-4">
                        <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{ width: `${s.score}%`, background: `linear-gradient(90deg, ${s.color}80, ${s.color})` }}
                          />
                        </div>
                      </div>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mr-3"
                        style={{ background: `${s.color}20`, color: s.color, fontFamily: 'var(--font-display)' }}
                      >
                        {s.tier}
                      </span>
                      <span className="text-lg font-bold text-white min-w-[48px] text-right" style={{ fontFamily: 'var(--font-number)' }}>{s.score}</span>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-3 border-t border-white/[0.06] flex items-center justify-center gap-2">
                  <Share2 size={12} className="text-[#4caf50]" />
                  <span className="text-[10px] text-[#4caf50] font-semibold">Each score individually shareable</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== LEADERBOARDS SECTION ========== */}
      <div className="section-divider" />
      <section id="leaderboards" className="py-24 md:py-32 px-6" style={{ background: 'rgba(14, 22, 16, 0.3)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            <p className="text-xs text-[#4caf50] uppercase tracking-[0.2em] mb-4 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Compete
            </p>
            <h2
              className="text-3xl md:text-5xl font-bold uppercase tracking-tight leading-tight mb-4"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              The Competition is{' '}
              <span className="text-gradient">Already Here</span>
            </h2>
            <p className="text-[#9e9e9e] max-w-2xl mx-auto">
              National rankings across every sport. Private friend leaderboards to settle debates forever. Are you actually better than your buddies — or just louder?
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* National Leaderboard */}
            <div className="reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
              <div className="glass-card rounded-2xl overflow-hidden" style={{ cursor: 'default' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Trophy size={16} className="text-[#FFD700]" />
                    <span className="text-xs text-[#9e9e9e] uppercase tracking-widest font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                      National — Overall
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4caf50] animate-pulse" />
                    <span className="text-[10px] text-[#4caf50] uppercase tracking-wider font-semibold">Live</span>
                  </div>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {leaderboardData.map((entry) => (
                    <div key={entry.rank} className="flex items-center px-6 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="w-7 flex items-center justify-center">
                        <RankIcon rank={entry.rank} />
                      </div>
                      <div className="flex-1 ml-2.5">
                        <span className="text-sm font-semibold text-white">{entry.name}</span>
                      </div>
                      <div className="hidden sm:block text-right mr-4">
                        <span className="text-xs text-[#9e9e9e]" style={{ fontFamily: 'var(--font-number)' }}>{entry.record}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-gradient stat-glow" style={{ fontFamily: 'var(--font-number)' }}>{entry.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-3 border-t border-white/[0.06] text-center">
                  <span className="text-xs text-[#6b6b6b]">Updated in real-time across all sports</span>
                </div>
              </div>
            </div>

            {/* Friend Leaderboard */}
            <div className="reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0" style={{ transitionDelay: '150ms' }}>
              <div className="glass-card rounded-2xl overflow-hidden" style={{ cursor: 'default' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-[#4caf50]" />
                    <span className="text-xs text-[#9e9e9e] uppercase tracking-widest font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                      Friends — NFL
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)', background: 'rgba(76,175,80,0.15)', color: '#4caf50' }}>
                    Pro
                  </span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {friendLeaderboard.map((entry) => (
                    <div
                      key={entry.rank}
                      className="flex items-center px-6 py-3 hover:bg-white/[0.02] transition-colors"
                      style={entry.isYou ? { background: 'rgba(76,175,80,0.05)', borderLeft: '2px solid #4caf50' } : {}}
                    >
                      <div className="w-7 flex items-center justify-center">
                        <RankIcon rank={entry.rank} />
                      </div>
                      <div className="flex-1 ml-2.5">
                        <span className={`text-sm font-semibold ${entry.isYou ? 'text-[#4caf50]' : 'text-white'}`}>
                          {entry.name}
                          {entry.isYou && <Flame size={12} className="inline ml-1.5 text-[#FFD700]" />}
                        </span>
                      </div>
                      <div className="hidden sm:flex items-center gap-4 mr-4">
                        <span className="text-xs text-[#9e9e9e]" style={{ fontFamily: 'var(--font-number)' }}>{entry.record}</span>
                        <span className={`text-xs ${entry.roi.startsWith('+') ? 'text-[#66bb6a]' : 'text-[#ef5350]'}`} style={{ fontFamily: 'var(--font-number)' }}>{entry.roi}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-number)', color: entry.tierColor }}>{entry.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-3 border-t border-white/[0.06] text-center">
                  <span className="text-xs text-[#6b6b6b]">Settle the debate — invite your friends</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== LEAGUES SECTION ========== */}
      <div className="section-divider" />
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            <p className="text-xs text-[#4caf50] uppercase tracking-[0.2em] mb-4 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Betting Leagues
            </p>
            <h2
              className="text-3xl md:text-5xl font-bold uppercase tracking-tight leading-tight mb-4"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Start a League.{' '}
              <span className="text-gradient">Settle It For Good.</span>
            </h2>
            <p className="text-[#9e9e9e] max-w-2xl mx-auto">
              Create a private league, invite your crew, and compete over an entire season. Weekly scores, standings, and bragging rights — like fantasy football, but for betting.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            {/* League Standings Mockup */}
            <div className="glass-card rounded-2xl overflow-hidden" style={{ cursor: 'default' }}>
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-display)' }}>SUNDAY DEGEN LEAGUE</p>
                  <p className="text-[10px] text-[#6b6b6b] mt-0.5">2025 NFL Season • Week 12 of 18</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#4caf50]/20 text-[#4caf50]" style={{ fontFamily: 'var(--font-display)' }}>
                  In Progress
                </span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {[
                  { rank: 1, name: 'You', score: 81.2, weekScore: 87.4, bets: 8, streak: 4, isYou: true },
                  { rank: 2, name: 'Mike_Bets', score: 76.8, weekScore: 72.1, bets: 6, streak: 2 },
                  { rank: 3, name: 'DanTheMan', score: 74.1, weekScore: 68.9, bets: 5, streak: 0 },
                  { rank: 4, name: 'JennyPicks', score: 69.4, weekScore: 74.3, bets: 4, streak: 1 },
                  { rank: 5, name: 'CousinVinny', score: 52.3, weekScore: 41.2, bets: 2, streak: 0 },
                ].map((member) => (
                  <div key={member.rank} className={`px-6 py-3.5 flex items-center gap-4 ${member.isYou ? 'bg-[#4caf50]/[0.08]' : ''}`}>
                    <span className={`w-6 text-center text-sm font-bold ${member.rank <= 3 ? 'text-[#FFD700]' : 'text-[#6b6b6b]'}`} style={{ fontFamily: 'var(--font-number)' }}>
                      {member.rank}
                    </span>
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${member.isYou ? 'text-[#4caf50]' : 'text-white'}`}>
                        {member.name}
                        {member.isYou && <span className="text-[10px] text-[#4caf50] ml-1">(You)</span>}
                      </span>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-[#6b6b6b]">{member.bets} bets this week</span>
                        {member.streak > 0 && (
                          <span className="text-[10px] text-[#ff6f00] flex items-center gap-0.5">
                            <Flame size={9} />{member.streak}wk streak
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-number)' }}>
                        {member.score}
                      </span>
                      <p className="text-[10px] text-[#6b6b6b]">This wk: <span className="text-[#81c784]">{member.weekScore}</span></p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3 border-t border-white/[0.06] text-center">
                <span className="text-xs text-[#6b6b6b]">Min 1 bet/week to stay ranked • Season avg determines winner</span>
              </div>
            </div>

            {/* League Features */}
            <div className="space-y-5">
              <div className="glass-card rounded-xl p-5" style={{ cursor: 'default' }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#4caf50]/20 flex items-center justify-center flex-shrink-0">
                    <Trophy size={20} className="text-[#4caf50]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm mb-1" style={{ fontFamily: 'var(--font-display)' }}>SEASON-LONG COMPETITION</h3>
                    <p className="text-xs text-[#9e9e9e]">Pick a sport, set your season dates, and compete week by week. The most consistent bettor wins — not the luckiest.</p>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-5" style={{ cursor: 'default' }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#FFD700]/20 flex items-center justify-center flex-shrink-0">
                    <Medal size={20} className="text-[#FFD700]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm mb-1" style={{ fontFamily: 'var(--font-display)' }}>WEEKLY SCORES, NOT LUCK</h3>
                    <p className="text-xs text-[#9e9e9e]">Your league score is the average of your weekly scores. Miss a week? That&apos;s a zero. No coasting on one hot week.</p>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-5" style={{ cursor: 'default' }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#42a5f5]/20 flex items-center justify-center flex-shrink-0">
                    <Users size={20} className="text-[#42a5f5]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm mb-1" style={{ fontFamily: 'var(--font-display)' }}>INVITE YOUR CREW</h3>
                    <p className="text-xs text-[#9e9e9e]">Share a code, they join instantly. Up to 20 members per league. Finally settle who&apos;s actually the best bettor in your friend group.</p>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-5" style={{ cursor: 'default' }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#ff6f00]/20 flex items-center justify-center flex-shrink-0">
                    <Crown size={20} className="text-[#ff6f00]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm mb-1" style={{ fontFamily: 'var(--font-display)' }}>END-OF-SEASON AWARDS</h3>
                    <p className="text-xs text-[#9e9e9e]">MVP, Most Improved, Best Week, Worst Beat — shareable trophies that live on your profile forever.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-12 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-background font-bold text-sm uppercase tracking-wider hover:scale-[1.02] transition-all"
              style={{ fontFamily: 'var(--font-display)', background: 'linear-gradient(135deg, #4caf50, #81c784)' }}
            >
              Start a League <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ========== SHARE SECTION ========== */}
      <div className="section-divider" />
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            <p className="text-xs text-[#4caf50] uppercase tracking-[0.2em] mb-4 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Flex Your Stats
            </p>
            <h2
              className="text-3xl md:text-5xl font-bold uppercase tracking-tight leading-tight mb-4"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Share Your Score.{' '}
              <span className="text-gradient">Prove Your Edge.</span>
            </h2>
            <p className="text-[#9e9e9e] max-w-2xl mx-auto">
              Generate a branded, verified score card and drop it on Twitter/X, Instagram, or your group chat. No more fake screenshots — your stats are verified and tamper-proof.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            {/* Score Card Mockup */}
            <div className="lg:col-span-1">
              <div className="glass-card rounded-2xl p-6 text-center relative overflow-hidden" style={{ cursor: 'default' }}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#4caf50] to-transparent" />
                <Image src="/images/logo-main.png" alt="Gammbler" width={100} height={24} className="h-5 w-auto mx-auto mb-4 opacity-60" />
                <div className="relative w-24 h-24 mx-auto mb-3">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(76,175,80,0.1)" strokeWidth="6" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#4caf50" strokeWidth="6" strokeLinecap="round" className="score-ring" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold text-gradient stat-glow" style={{ fontFamily: 'var(--font-number)' }}>78.4</span>
                  </div>
                </div>
                <p className="text-sm font-bold text-white mb-0.5">SharpShooter_MJ</p>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3" style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700', fontFamily: 'var(--font-display)' }}>
                  Elite
                </span>
                <div className="flex items-center justify-center gap-4 text-xs mb-3">
                  <span className="text-[#9e9e9e]"><span className="text-white font-bold" style={{ fontFamily: 'var(--font-number)' }}>234-118</span> Record</span>
                  <span className="text-[#66bb6a]"><span className="font-bold" style={{ fontFamily: 'var(--font-number)' }}>+9.2%</span> ROI</span>
                </div>
                <div className="border-t border-white/[0.06] pt-3 mt-1">
                  <p className="text-[9px] text-[#6b6b6b] uppercase tracking-wider">Verified by Gammbler</p>
                </div>
              </div>
            </div>

            {/* Social sharing context */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* Twitter/X mockup */}
              <div className="glass-card rounded-2xl p-6" style={{ cursor: 'default' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center">
                    <span className="text-sm font-bold text-white">MJ</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">SharpShooter_MJ</p>
                    <p className="text-[10px] text-[#6b6b6b]">@sharpshooter_mj</p>
                  </div>
                  <div className="ml-auto">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#9e9e9e">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                </div>
                <p className="text-sm text-[#e0e0e0] mb-3">
                  78.4 Elite on Gammbler 🔥 234-118 on the season. Where are you ranked? 
                  <span className="text-[#4caf50]"> gammbler.com</span>
                </p>
                <div className="flex items-center gap-6 text-xs text-[#6b6b6b]">
                  <span className="flex items-center gap-1"><Heart size={12} /> 847</span>
                  <span className="flex items-center gap-1"><Share2 size={12} /> 234</span>
                  <span>12.4K views</span>
                </div>
              </div>

              {/* Instagram mockup */}
              <div className="glass-card rounded-2xl p-6" style={{ cursor: 'default' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] flex items-center justify-center">
                    <span className="text-sm font-bold text-white">MJ</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">sharpshooter_mj</p>
                    <p className="text-[10px] text-[#6b6b6b]">Instagram Story</p>
                  </div>
                </div>
                <p className="text-sm text-[#e0e0e0]">
                  Posted their Gammbler card to their story — <span className="text-white font-semibold">3,241 views</span> and <span className="text-[#4caf50] font-semibold">47 new signups</span> from the link
                </p>
              </div>

              <p className="text-xs text-[#6b6b6b] text-center">
                Branded score cards &middot; Verified stats &middot; Tamper-proof &middot; One-tap share
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FEATURES ========== */}
      <div className="section-divider" />
      <section className="py-24 md:py-32 px-6" style={{ background: 'rgba(14, 22, 16, 0.3)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            <p className="text-xs text-[#4caf50] uppercase tracking-[0.2em] mb-4 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Everything You Need
            </p>
            <h2
              className="text-3xl md:text-5xl font-bold uppercase tracking-tight leading-tight mb-4"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Built for{' '}
              <span className="text-gradient">Serious Bettors</span>
            </h2>
            <p className="text-[#9e9e9e] max-w-xl mx-auto">
              Sportsbook sync, analytics, insights, and more — all backing up the score and leaderboard experience.
            </p>
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

          {/* Platforms */}
          <div className="mt-16 text-center reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
            <p className="text-xs text-[#4caf50] uppercase tracking-[0.2em] mb-6 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Connects to Your Sportsbooks
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {platforms.map((p) => (
                <div key={p.name} className="platform-badge bg-[#111a13] px-5 py-3 rounded-xl flex items-center gap-2.5 cursor-default">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color, boxShadow: `0 0 8px ${p.color}60` }} />
                  <span className="text-sm font-medium text-white">{p.name}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#6b6b6b] mt-6">+ CSV import for any platform &middot; Manual entry always available</p>
          </div>
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <div className="section-divider" />
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
              Free Forever.{' '}
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
                <p className="text-[#6b6b6b] text-sm">Free forever. No strings attached.</p>
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
                    <p className="text-[#6b6b6b] text-sm">Unlock everything.</p>
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
                  Upgrade to Pro
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FAQ ========== */}
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

      {/* ========== FINAL CTA ========== */}
      <div className="section-divider" />
      <section className="py-24 md:py-32 px-6 relative dot-grid">
        <div className="hero-orb w-[400px] h-[400px] top-0 left-1/2 -translate-x-1/2 bg-[#4caf50]/[0.04]" />
        <div className="max-w-3xl mx-auto text-center relative z-10 reveal opacity-0 transition-all duration-700 translate-y-4 [&.is-visible]:opacity-100 [&.is-visible]:translate-y-0">
          <h2
            className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-[0.95] mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            The Leaderboard is Live.{' '}
            <span className="text-gradient">Where Do You Rank?</span>
          </h2>
          <p className="text-lg text-[#9e9e9e] mb-10 max-w-xl mx-auto">
            Join thousands of bettors who already know their score. Get yours in 60 seconds.
          </p>
          <Link
            href="/signup"
            className="btn-glow inline-flex items-center gap-3 text-white px-12 py-5 rounded-xl text-lg font-bold uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Get Your Score <ArrowRight size={20} />
          </Link>
          <p className="text-xs text-[#6b6b6b] mt-6">Free forever &middot; Pro starts at $8.99/mo</p>
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
