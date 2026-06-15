'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Trophy,
  Target,
  Swords,
  Users,
  Crown,
  Medal,
  TrendingUp,
  Flame,
  Star,
  Zap,
  BarChart3,
} from 'lucide-react';

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



function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return n.toLocaleString();
  return String(n);
}

const leaderboardPreview = [
  { rank: 1, name: 'SharpShooter_MJ', score: 94.2, tier: 'Legend', color: '#ff6f00', sport: 'NFL' },
  { rank: 2, name: 'VegasVault', score: 91.8, tier: 'Legend', color: '#ff6f00', sport: 'NBA' },
  { rank: 3, name: 'TheLineKing', score: 89.7, tier: 'Elite', color: '#FFD700', sport: 'NFL' },
  { rank: 4, name: 'ParlayPete', score: 86.3, tier: 'Elite', color: '#FFD700', sport: 'MLB' },
  { rank: 5, name: 'ChalkEater99', score: 84.1, tier: 'Elite', color: '#FFD700', sport: 'NBA' },
  { rank: 6, name: 'EdgeHunterX', score: 81.9, tier: 'Elite', color: '#FFD700', sport: 'NHL' },
  { rank: 7, name: 'You', score: '??', tier: '???', color: '#9e9e9e', sport: '—', isYou: true },
];

export default function HomePage() {
  const observerRef = useIntersectionObserver();
  const [stats, setStats] = useState({ users: 0, bets: 0, challenges: 0, leagues: 0 });

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    fetch(`${API_URL}/stats/public`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  const demoRank = Math.max(1, Math.ceil(stats.users * 0.15));
  const heroStats = [
    { label: 'Betting Score', value: '84.7', sublabel: 'Elite', color: '#FFD700' },
    { label: 'National Rank', value: `#${demoRank.toLocaleString()}`, sublabel: `of ${formatNumber(stats.users)}`, color: '#4caf50' },
    { label: 'NFL Score', value: '91.2', sublabel: 'Legend', color: '#ff6f00' },
    { label: 'H2H Record', value: '23-7', sublabel: '.767 Win %', color: '#4caf50' },
    { label: 'League Standing', value: '#2', sublabel: 'of 12', color: '#FFD700' },
  ];

  const socialProof = [
    { value: formatNumber(stats.users), label: 'Verified Bettors' },
    { value: formatNumber(stats.bets), label: 'Bets Tracked' },
    { value: formatNumber(stats.challenges), label: 'H2H Challenges' },
    { value: formatNumber(stats.leagues), label: 'League Matchups' },
  ];

  return (
    <div ref={observerRef} className="min-h-screen overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/[0.04]" style={{ background: 'rgba(10, 15, 11, 0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/images/logo-main.png" alt="Gammbler" width={220} height={48} className="h-12 w-auto" priority />
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
              Get My Score
            </Link>
          </div>
        </div>
      </nav>

      {/* ========== HERO ========== */}
      <section className="relative pt-32 pb-8 md:pt-40 md:pb-16 px-6 dot-grid">
        <div className="hero-orb w-[600px] h-[600px] -top-40 -left-40 bg-[#4caf50]/[0.04]" style={{ animation: 'pulse-glow 8s ease-in-out infinite' }} />
        <div className="hero-orb w-[500px] h-[500px] top-20 -right-40 bg-[#4caf50]/[0.03]" style={{ animation: 'pulse-glow 10s ease-in-out infinite 2s' }} />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h1
              className="animate-fade-up text-4xl sm:text-6xl md:text-[5rem] lg:text-[6rem] font-black uppercase tracking-tight leading-[0.9] mb-6"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              How Good of a Sports Bettor{' '}
              <span className="text-gradient">Are You?</span>
            </h1>

            <p className="animate-fade-up delay-100 text-lg md:text-xl text-[#9e9e9e] max-w-2xl mx-auto mb-10 leading-relaxed">
              Get your Gammbler Score, see where you rank nationally, challenge friends, join betting leagues, and prove you&apos;re better than the competition.
            </p>

            <div className="animate-fade-up delay-200 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="btn-glow text-white px-10 py-4 rounded-xl text-lg font-bold uppercase tracking-wider flex items-center gap-3 w-full sm:w-auto justify-center"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Get My Score <ArrowRight size={20} />
              </Link>
              <Link
                href="#rankings"
                className="text-[#9e9e9e] hover:text-white border border-white/[0.1] hover:border-white/[0.2] px-8 py-4 rounded-xl text-lg font-bold uppercase tracking-wider flex items-center gap-3 w-full sm:w-auto justify-center transition-all duration-300"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                See the Rankings
              </Link>
            </div>
          </div>

          {/* Hero Score Dashboard Visual */}
          <div className="animate-fade-up delay-300 max-w-3xl mx-auto">
            <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 md:p-8" style={{ backdropFilter: 'blur(10px)' }}>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {heroStats.map((stat, i) => (
                  <div key={i} className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <p className="text-[10px] uppercase tracking-widest text-[#6b6b6b] mb-1">{stat.label}</p>
                    <p className="text-2xl md:text-3xl font-black" style={{ fontFamily: 'var(--font-number)', color: stat.color }}>{stat.value}</p>
                    <p className="text-xs mt-1" style={{ color: stat.color }}>{stat.sublabel}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-[11px] text-[#6b6b6b] mt-4 italic">What would YOUR dashboard look like?</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SOCIAL PROOF BANNER ========== */}
      <section className="py-8 px-6 border-y border-white/[0.04] bg-white/[0.01]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {socialProof.map((item, i) => (
            <div key={i} className="text-center">
              <p className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: 'var(--font-number)' }}>{item.value}</p>
              <p className="text-xs text-[#6b6b6b] uppercase tracking-wider mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ========== SECTION 1: EVERY BETTOR GETS A SCORE ========== */}
      <section className="py-20 md:py-32 px-6">
        <div className="max-w-5xl mx-auto reveal">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#4caf50]/20 bg-[#4caf50]/5 mb-6">
                <Target size={14} className="text-[#4caf50]" />
                <span className="text-xs text-[#4caf50] uppercase tracking-widest font-medium">Your Score</span>
              </div>
              <h2
                className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-[0.95] mb-6"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Every Bettor Gets{' '}
                <span className="text-gradient">a Score.</span>
              </h2>
              <p className="text-[#9e9e9e] text-lg leading-relaxed mb-4">
                Not opinions. Not followers. Not hype.
              </p>
              <p className="text-[#9e9e9e] leading-relaxed mb-8">
                A real score based on actual betting performance. Track your progress, build credibility, and see how you stack up against bettors nationwide.
              </p>
              <Link
                href="/signup"
                className="btn-glow inline-flex items-center gap-3 text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Get Your Score <ArrowRight size={18} />
              </Link>
            </div>

            {/* Score Visual */}
            <div className="relative">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
                <div className="w-40 h-40 mx-auto rounded-full border-4 border-[#FFD700] flex items-center justify-center mb-4 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-[#FFD700]/20 animate-ping" style={{ animationDuration: '3s' }} />
                  <div>
                    <p className="text-5xl font-black text-[#FFD700]" style={{ fontFamily: 'var(--font-number)' }}>84.7</p>
                    <p className="text-sm text-[#FFD700] font-bold uppercase">Elite</p>
                  </div>
                </div>
                <p className="text-[#9e9e9e] text-sm">Based on win rate, ROI, consistency & volume</p>
                <div className="mt-6 grid grid-cols-5 gap-2">
                  {[
                    { tier: 'Rec', range: '0-40', color: '#9e9e9e' },
                    { tier: 'Dev', range: '41-60', color: '#42a5f5' },
                    { tier: 'Sharp', range: '61-75', color: '#4caf50' },
                    { tier: 'Elite', range: '76-90', color: '#FFD700' },
                    { tier: 'Legend', range: '91+', color: '#ff6f00' },
                  ].map((t, i) => (
                    <div key={i} className="text-center">
                      <div className="h-1.5 rounded-full mb-1" style={{ backgroundColor: t.color }} />
                      <p className="text-[9px] font-bold" style={{ color: t.color }}>{t.tier}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ========== SECTION 2: SEE WHERE YOU RANK ========== */}
      <section id="rankings" className="py-20 md:py-32 px-6">
        <div className="max-w-5xl mx-auto reveal">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Leaderboard Visual */}
            <div className="order-2 md:order-1">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                  <Trophy size={14} className="text-[#FFD700]" />
                  <span className="text-xs text-[#9e9e9e] uppercase tracking-widest font-medium">National Rankings</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {leaderboardPreview.map((user) => (
                    <div key={user.rank} className={`flex items-center px-4 py-3 gap-3 ${user.isYou ? 'bg-[#4caf50]/5 border border-[#4caf50]/20 rounded-lg mx-2 my-2' : ''}`}>
                      <span className="w-6 text-center">
                        {user.rank === 1 && <Crown size={14} className="text-[#FFD700] mx-auto" />}
                        {user.rank === 2 && <Medal size={14} className="text-[#C0C0C0] mx-auto" />}
                        {user.rank === 3 && <Medal size={14} className="text-[#CD7F32] mx-auto" />}
                        {user.rank > 3 && <span className="text-xs text-[#6b6b6b] font-bold">{user.rank}</span>}
                      </span>
                      <span className={`flex-1 text-sm font-medium ${user.isYou ? 'text-[#4caf50]' : 'text-white'}`}>
                        {user.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded" style={{ color: user.color, backgroundColor: `${user.color}15` }}>
                        {user.sport}
                      </span>
                      <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-number)', color: user.color }}>
                        {user.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FFD700]/20 bg-[#FFD700]/5 mb-6">
                <Trophy size={14} className="text-[#FFD700]" />
                <span className="text-xs text-[#FFD700] uppercase tracking-widest font-medium">Leaderboards</span>
              </div>
              <h2
                className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-[0.95] mb-6"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                See Where{' '}
                <span className="text-gradient">You Rank.</span>
              </h2>
              <p className="text-[#9e9e9e] text-lg leading-relaxed mb-4">
                Compete against bettors across the country.
              </p>
              <p className="text-[#9e9e9e] leading-relaxed mb-4">
                Climb national leaderboards. Dominate your favorite sports. Prove your edge.
              </p>
              <ul className="space-y-3 mb-8">
                {['National Rankings', 'Sport-Specific Rankings', 'Friends Leaderboard', 'DFS Rankings'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[#9e9e9e]">
                    <TrendingUp size={16} className="text-[#4caf50]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="btn-glow inline-flex items-center gap-3 text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                See My Rank <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ========== SECTION 3: CHALLENGE FRIENDS ========== */}
      <section className="py-20 md:py-32 px-6">
        <div className="max-w-5xl mx-auto reveal">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#f44336]/20 bg-[#f44336]/5 mb-6">
                <Swords size={14} className="text-[#f44336]" />
                <span className="text-xs text-[#f44336] uppercase tracking-widest font-medium">H2H Challenges</span>
              </div>
              <h2
                className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-[0.95] mb-6"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Challenge Friends.{' '}
                <span className="text-gradient">Settle Debates.</span>
              </h2>
              <p className="text-[#9e9e9e] text-lg leading-relaxed mb-4">
                Think you&apos;re the sharpest bettor in your group?
              </p>
              <p className="text-[#9e9e9e] leading-relaxed mb-4">
                Prove it. Create head-to-head challenges, compete all season, and settle every argument with results.
              </p>
              <p className="text-white font-bold mb-8">
                No more trash talk without receipts.
              </p>
              <Link
                href="/signup"
                className="btn-glow inline-flex items-center gap-3 text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Challenge Someone <ArrowRight size={18} />
              </Link>
            </div>

            {/* H2H Visual */}
            <div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-center flex-1">
                    <div className="w-14 h-14 rounded-full bg-[#4caf50]/10 border-2 border-[#4caf50] flex items-center justify-center mx-auto mb-2">
                      <span className="text-lg font-black text-[#4caf50]">Y</span>
                    </div>
                    <p className="text-sm font-bold text-white">You</p>
                    <p className="text-xs text-[#4caf50]">84.7 Elite</p>
                  </div>
                  <div className="text-center px-4">
                    <Swords size={24} className="text-[#f44336] mx-auto mb-1" />
                    <p className="text-xs text-[#6b6b6b] uppercase tracking-wider">VS</p>
                  </div>
                  <div className="text-center flex-1">
                    <div className="w-14 h-14 rounded-full bg-[#f44336]/10 border-2 border-[#f44336] flex items-center justify-center mx-auto mb-2">
                      <span className="text-lg font-black text-[#f44336]">M</span>
                    </div>
                    <p className="text-sm font-bold text-white">Mike_Bets</p>
                    <p className="text-xs text-[#f44336]">72.1 Sharp</p>
                  </div>
                </div>
                <div className="text-center py-3 rounded-xl bg-[#4caf50]/5 border border-[#4caf50]/20">
                  <p className="text-xs text-[#6b6b6b] uppercase tracking-wider mb-1">Your H2H Record</p>
                  <p className="text-2xl font-black text-[#4caf50]" style={{ fontFamily: 'var(--font-number)' }}>23 - 7</p>
                  <p className="text-xs text-[#4caf50]">.767 Win Rate</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ========== SECTION 4: LEAGUES ========== */}
      <section className="py-20 md:py-32 px-6">
        <div className="max-w-5xl mx-auto reveal">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* League Visual */}
            <div className="order-2 md:order-1">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame size={14} className="text-[#ff6f00]" />
                    <span className="text-xs text-[#9e9e9e] uppercase tracking-widest font-medium">NFL Season League</span>
                  </div>
                  <span className="text-xs text-[#6b6b6b]">Week 14</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {[
                    { rank: 1, name: 'SharpShooter_MJ', avg: '88.4', streak: 'W5' },
                    { rank: 2, name: 'You', avg: '84.7', streak: 'W3', isYou: true },
                    { rank: 3, name: 'DanTheMan', avg: '79.2', streak: 'L1' },
                    { rank: 4, name: 'Mike_Bets', avg: '72.1', streak: 'W1' },
                    { rank: 5, name: 'CousinVinny', avg: '61.3', streak: 'L4' },
                  ].map((user) => (
                    <div key={user.rank} className={`flex items-center px-4 py-3 gap-3 ${user.isYou ? 'bg-[#4caf50]/5' : ''}`}>
                      <span className="w-6 text-center text-xs font-bold" style={{ color: user.rank <= 3 ? '#FFD700' : '#6b6b6b' }}>
                        #{user.rank}
                      </span>
                      <span className={`flex-1 text-sm font-medium ${user.isYou ? 'text-[#4caf50]' : 'text-white'}`}>
                        {user.name}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${user.streak.startsWith('W') ? 'text-[#4caf50] bg-[#4caf50]/10' : 'text-[#f44336] bg-[#f44336]/10'}`}>
                        {user.streak}
                      </span>
                      <span className="text-sm font-bold text-white" style={{ fontFamily: 'var(--font-number)' }}>
                        {user.avg}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-white/[0.06] text-center">
                  <p className="text-xs text-[#6b6b6b]">1 point behind #1 &middot; 4 weeks remaining</p>
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#ff6f00]/20 bg-[#ff6f00]/5 mb-6">
                <Flame size={14} className="text-[#ff6f00]" />
                <span className="text-xs text-[#ff6f00] uppercase tracking-widest font-medium">Betting Leagues</span>
              </div>
              <h2
                className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-[0.95] mb-6"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Fantasy Football{' '}
                <span className="text-gradient">for Sports Bettors.</span>
              </h2>
              <p className="text-[#9e9e9e] text-lg leading-relaxed mb-4">
                Join betting leagues. Compete all season long.
              </p>
              <p className="text-[#9e9e9e] leading-relaxed mb-4">
                Track standings. Earn bragging rights. Become league champion.
              </p>
              <ul className="space-y-3 mb-8">
                {['Season-long competition', 'Weekly score tracking', 'Friend & public leagues', 'Cash entry leagues available'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[#9e9e9e]">
                    <Star size={16} className="text-[#ff6f00]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="btn-glow inline-flex items-center gap-3 text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Join a League <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ========== SECTION 5: BUILD YOUR REPUTATION ========== */}
      <section className="py-20 md:py-32 px-6">
        <div className="max-w-5xl mx-auto reveal">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#42a5f5]/20 bg-[#42a5f5]/5 mb-6">
                <BarChart3 size={14} className="text-[#42a5f5]" />
                <span className="text-xs text-[#42a5f5] uppercase tracking-widest font-medium">Reputation</span>
              </div>
              <h2
                className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-[0.95] mb-6"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Build Your Betting{' '}
                <span className="text-gradient">Reputation.</span>
              </h2>
              <p className="text-[#9e9e9e] text-lg leading-relaxed mb-4">
                Your score follows you. Your rankings matter. Your performance becomes your reputation.
              </p>
              <p className="text-[#9e9e9e] leading-relaxed mb-8">
                Gammbler gives every bettor an identity. Verified, trackable, and impossible to fake.
              </p>
              <Link
                href="/signup"
                className="btn-glow inline-flex items-center gap-3 text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Build My Profile <ArrowRight size={18} />
              </Link>
            </div>

            {/* Reputation Visual */}
            <div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#4caf50] to-[#2e7d32] flex items-center justify-center">
                    <span className="text-xl font-black text-white">S</span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">SharpShooter_MJ</p>
                    <p className="text-xs text-[#9e9e9e]">Member since 2024</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-2xl font-black text-[#ff6f00]" style={{ fontFamily: 'var(--font-number)' }}>94.2</p>
                    <p className="text-xs text-[#ff6f00] font-bold">Legend</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                    <p className="text-lg font-black text-white" style={{ fontFamily: 'var(--font-number)' }}>847-412</p>
                    <p className="text-[9px] text-[#6b6b6b] uppercase">Record</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                    <p className="text-lg font-black text-[#4caf50]" style={{ fontFamily: 'var(--font-number)' }}>+18.4%</p>
                    <p className="text-[9px] text-[#6b6b6b] uppercase">ROI</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                    <p className="text-lg font-black text-[#FFD700]" style={{ fontFamily: 'var(--font-number)' }}>#1</p>
                    <p className="text-[9px] text-[#6b6b6b] uppercase">Rank</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {['NFL Legend', 'Win Streak 15', '1K Bets Club', 'League Champ'].map((badge, i) => (
                    <span key={i} className="text-[10px] px-2 py-1 rounded-full border border-[#FFD700]/20 text-[#FFD700] bg-[#FFD700]/5">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ========== SECTION 6: CREATOR ECONOMY ========== */}
      <section className="py-20 md:py-32 px-6">
        <div className="max-w-5xl mx-auto reveal">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Creator Visual */}
            <div className="order-2 md:order-1">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9c27b0] to-[#6a1b9a] flex items-center justify-center">
                    <span className="text-lg font-black text-white">V</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold">VegasVault</p>
                    <p className="text-xs text-[#9e9e9e]">NBA Specialist &middot; 91.8 Legend</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                    <p className="text-lg font-black text-white" style={{ fontFamily: 'var(--font-number)' }}>2,847</p>
                    <p className="text-[9px] text-[#6b6b6b] uppercase">Followers</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                    <p className="text-lg font-black text-[#4caf50]" style={{ fontFamily: 'var(--font-number)' }}>312</p>
                    <p className="text-[9px] text-[#6b6b6b] uppercase">Subscribers</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                    <p className="text-lg font-black text-[#FFD700]" style={{ fontFamily: 'var(--font-number)' }}>$4,365</p>
                    <p className="text-[9px] text-[#6b6b6b] uppercase">Monthly</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <p className="text-xs text-[#6b6b6b] mb-1">Latest post</p>
                  <p className="text-sm text-white">NBA Sunday card looking fire. 3 plays locked in for subscribers. Last week hit 4/5. Let&apos;s keep it rolling 🔥</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-[#6b6b6b]">
                    <span>❤️ 247</span>
                    <span>💬 43</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#9c27b0]/20 bg-[#9c27b0]/5 mb-6">
                <Users size={14} className="text-[#9c27b0]" />
                <span className="text-xs text-[#9c27b0] uppercase tracking-widest font-medium">Creator Economy</span>
              </div>
              <h2
                className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-[0.95] mb-6"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Turn Your Betting Knowledge{' '}
                <span className="text-gradient">Into a Following.</span>
              </h2>
              <p className="text-[#9e9e9e] text-lg leading-relaxed mb-4">
                The best bettors build credibility. The best creators build audiences.
              </p>
              <p className="text-[#9e9e9e] leading-relaxed mb-4">
                Create content. Gain followers. Earn subscribers. Build your betting brand.
              </p>
              <ul className="space-y-3 mb-8">
                {['Post picks & analysis', 'Subscriber-only content', 'Keep 80% of revenue', 'Grow your audience'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[#9e9e9e]">
                    <Zap size={16} className="text-[#9c27b0]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="btn-glow inline-flex items-center gap-3 text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Start Creating <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ========== FINAL CTA ========== */}
      <section className="py-24 md:py-36 px-6 text-center relative">
        <div className="hero-orb w-[400px] h-[400px] top-0 left-1/2 -translate-x-1/2 bg-[#4caf50]/[0.03]" style={{ animation: 'pulse-glow 6s ease-in-out infinite' }} />
        <div className="max-w-3xl mx-auto relative z-10 reveal">
          <h2
            className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-[0.95] mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Stop Guessing.{' '}
            <span className="text-gradient">Find Out How Good You Really Are.</span>
          </h2>
          <p className="text-lg text-[#9e9e9e] mb-4 max-w-xl mx-auto">
            Get your score. See your ranking. Challenge your friends. Join leagues. Build your reputation.
          </p>
          <p className="text-sm text-[#6b6b6b] mb-10">
            Free forever &middot; Verified Score Pass $4.99 one-time &middot; Pro $8.99/mo
          </p>
          <Link
            href="/signup"
            className="btn-glow inline-flex items-center gap-3 text-white px-12 py-5 rounded-xl text-lg font-bold uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Get My Score <ArrowRight size={20} />
          </Link>
          <p className="text-xs text-[#6b6b6b] mt-8 italic">
            Every sports bettor thinks they&apos;re good. Now you can prove it.
          </p>
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
              <a href="mailto:contact@gammbler.com" className="hover:text-white transition-colors duration-300">Contact</a>
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
