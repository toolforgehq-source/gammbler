import Link from 'next/link';
import Image from 'next/image';

const NAV_LINKS = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/creators', label: 'Creators' },
  { href: '/stats', label: 'Stats' },
  { href: '/learn/what-is-gammbler', label: 'Learn' },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-accent/10 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/images/logo-main.png" alt="Gammbler" width={32} height={32} />
              <span className="font-display text-xl font-bold tracking-tight text-foreground">GAMMBLER</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted-dark hover:text-accent transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/signin"
              className="text-sm font-medium text-muted-dark hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="bg-accent hover:bg-accent-light text-background text-sm font-bold px-4 py-2 rounded-lg transition-colors"
            >
              Sign Up Free
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-accent/10 bg-card/50 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-dark mb-4">Platform</h3>
              <ul className="space-y-2">
                <li><Link href="/leaderboard" className="text-sm text-muted-dark hover:text-accent">Leaderboard</Link></li>
                <li><Link href="/creators" className="text-sm text-muted-dark hover:text-accent">Creators</Link></li>
                <li><Link href="/stats" className="text-sm text-muted-dark hover:text-accent">Statistics</Link></li>
                <li><Link href="/signup" className="text-sm text-muted-dark hover:text-accent">Sign Up</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-dark mb-4">Sports</h3>
              <ul className="space-y-2">
                {['NFL', 'NBA', 'MLB', 'NHL', 'CFB', 'CBB', 'Soccer'].map(sport => (
                  <li key={sport}>
                    <Link href={`/leaderboard/${sport.toLowerCase()}`} className="text-sm text-muted-dark hover:text-accent">
                      {sport} Rankings
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-dark mb-4">Learn</h3>
              <ul className="space-y-2">
                <li><Link href="/learn/what-is-gammbler" className="text-sm text-muted-dark hover:text-accent">What is Gammbler?</Link></li>
                <li><Link href="/learn/how-gammbler-score-calculated" className="text-sm text-muted-dark hover:text-accent">How Scores Work</Link></li>
                <li><Link href="/learn/good-betting-win-rate" className="text-sm text-muted-dark hover:text-accent">Good Win Rate</Link></li>
                <li><Link href="/learn/good-betting-roi" className="text-sm text-muted-dark hover:text-accent">Good ROI</Link></li>
                <li><Link href="/learn/profitable-bettors-percentage" className="text-sm text-muted-dark hover:text-accent">Profitable Bettors</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-dark mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link href="/terms" className="text-sm text-muted-dark hover:text-accent">Terms</Link></li>
                <li><Link href="/privacy" className="text-sm text-muted-dark hover:text-accent">Privacy</Link></li>
                <li><Link href="/responsible-gambling" className="text-sm text-muted-dark hover:text-accent">Responsible Gambling</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-accent/10 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-dark/60">
              Gammbler is NOT a sportsbook and does not accept wagers. This is a skill-based analytics platform.
            </p>
            <p className="text-xs text-muted-dark/60">
              If you or someone you know has a gambling problem, call 1-800-522-4700.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
