import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy — Gammbler',
  description: 'Privacy Policy for Gammbler. Learn how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-10">
          <Link href="/" className="text-muted-dark hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <Image src="/images/logo-main.png" alt="Gammbler" width={120} height={28} className="h-7 w-auto" />
        </div>

        <h1 className="text-3xl font-bold uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Privacy Policy
        </h1>
        <p className="text-muted-dark text-sm mb-10">Last updated: June 2026</p>

        <div className="space-y-8 text-sm text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Who We Are</h2>
            <p>
              Gammbler Inc. (&quot;Gammbler&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the Gammbler platform at gammbler.com. Gammbler is a skill-based analytics and score-tracking platform. <strong>We are NOT a sportsbook and do not accept wagers.</strong>
            </p>
            <p className="mt-3">
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Platform. Please read it carefully.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Information We Collect</h2>

            <h3 className="text-sm font-bold text-white mt-4 mb-2">Account Information</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Email address</li>
              <li>Username</li>
              <li>Date of birth (for age verification)</li>
              <li>Password (stored as a one-way hash; we never store or see your actual password)</li>
            </ul>

            <h3 className="text-sm font-bold text-white mt-4 mb-2">Betting Data</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Bet records you manually enter (sport, stake, odds, result)</li>
              <li>Bet records synced from connected sportsbooks (via SharpSports)</li>
              <li>DFS contest records uploaded via CSV or entered manually</li>
              <li>Calculated metrics: Gammbler Score, ROI, win rate, streaks</li>
            </ul>

            <h3 className="text-sm font-bold text-white mt-4 mb-2">Usage Data</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>IP address and approximate location (for analytics and age/location compliance)</li>
              <li>Browser type and device information</li>
              <li>Pages visited and features used</li>
              <li>Referral source</li>
            </ul>

            <h3 className="text-sm font-bold text-white mt-4 mb-2">Payment Data</h3>
            <p>
              Payment processing is handled entirely by Stripe. We do not store credit card numbers, bank account details, or other financial information. Stripe&apos;s privacy policy applies to payment data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Calculate and display your Gammbler Score and related analytics</li>
              <li>Display your profile and stats on leaderboards (if your profile is public)</li>
              <li>Process subscriptions and Capper Marketplace transactions</li>
              <li>Send transactional emails (welcome, trial reminders, weekly reports)</li>
              <li>Verify your age and eligibility to use the Platform</li>
              <li>Improve the Platform and develop new features</li>
              <li>Detect and prevent fraud, abuse, and Terms of Service violations</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. How We Share Your Information</h2>
            <p>We do NOT sell your personal information. We may share data with:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li><strong>Service providers:</strong> Stripe (payments), SendGrid (email), Render (hosting), Vercel (frontend hosting), SharpSports (sportsbook sync)</li>
              <li><strong>Other users:</strong> Your username, Gammbler Score, verification status, badges, and betting stats are visible on your public profile and leaderboards (you can make your profile private in Settings)</li>
              <li><strong>Legal requirements:</strong> We may disclose information if required by law, subpoena, or to protect our rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. If you delete your account, we will remove your personal information within 30 days, except where we are required to retain it for legal or compliance purposes.
            </p>
            <p className="mt-3">
              Aggregated, anonymized data (e.g., overall platform statistics) may be retained indefinitely.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data</li>
              <li><strong>Deletion:</strong> Request deletion of your account and personal data</li>
              <li><strong>Portability:</strong> Request your data in a machine-readable format</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing emails at any time</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, email us at{' '}
              <a href="mailto:privacy@gammbler.com" className="text-accent hover:text-accent-light">privacy@gammbler.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. California Privacy Rights (CCPA)</h2>
            <p>
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>The right to know what personal information is collected and how it is used</li>
              <li>The right to request deletion of your personal information</li>
              <li>The right to opt out of the sale of personal information (we do not sell personal information)</li>
              <li>The right to non-discrimination for exercising your privacy rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Cookies &amp; Tracking</h2>
            <p>
              We use essential cookies to maintain your login session (JWT token stored in localStorage). We may use analytics tools to understand Platform usage. We do not use third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Data Security</h2>
            <p>
              We implement industry-standard security measures including:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Passwords hashed with bcrypt (12 rounds)</li>
              <li>HTTPS encryption for all data in transit</li>
              <li>JWT tokens for authentication</li>
              <li>Database hosted on encrypted infrastructure</li>
            </ul>
            <p className="mt-3">
              No system is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">10. Children&apos;s Privacy</h2>
            <p>
              Gammbler is not intended for anyone under 18 years of age. We do not knowingly collect personal information from individuals under 18. If we become aware that a user is under 18, we will promptly delete their account and associated data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated via email or Platform notification. The &quot;Last updated&quot; date at the top reflects the most recent revision.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">12. Contact Us</h2>
            <p>
              For privacy-related questions or requests, contact us at{' '}
              <a href="mailto:privacy@gammbler.com" className="text-accent hover:text-accent-light">privacy@gammbler.com</a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-accent/10 text-center text-xs text-muted-dark">
          <p>&copy; {new Date().getFullYear()} Gammbler Inc. All rights reserved.</p>
          <p className="mt-1">Gammbler is not a sportsbook and does not accept wagers.</p>
        </div>
      </div>
    </div>
  );
}
