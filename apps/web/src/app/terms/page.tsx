import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service — Gammbler',
  description: 'Terms of Service for Gammbler, the sports betting analytics and score-tracking platform.',
};

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-muted-dark text-sm mb-10">Last updated: June 2026</p>

        <div className="space-y-8 text-sm text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Platform Description</h2>
            <p>
              Gammbler (&quot;the Platform&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a skill-based sports betting analytics and score-tracking platform operated by Gammbler Inc. <strong>Gammbler is NOT a sportsbook, gambling operator, or betting exchange.</strong> We do not accept, process, or facilitate any wagers, bets, or financial transactions related to gambling outcomes.
            </p>
            <p className="mt-3">
              The Platform provides users with analytics tools, performance scores, leaderboards, community features, and bet-tracking capabilities. All bets tracked on Gammbler are placed by users on separate, third-party sportsbooks. Gammbler serves solely as a record-keeping and analytics tool.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Eligibility</h2>
            <p>
              You must be at least <strong>18 years of age</strong> (or the minimum legal age for sports betting in your jurisdiction, whichever is higher) to create an account on Gammbler. By creating an account, you represent and warrant that:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>You meet the minimum age requirement</li>
              <li>You are legally permitted to use sports betting analytics services in your jurisdiction</li>
              <li>All information you provide during registration is truthful and accurate</li>
              <li>You will comply with all applicable local, state, and federal laws</li>
            </ul>
            <p className="mt-3">
              We reserve the right to request proof of age or identity at any time and to suspend or terminate accounts that fail to meet eligibility requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Account Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials. You agree not to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Share your account with others</li>
              <li>Create multiple accounts</li>
              <li>Fabricate or falsify betting records to inflate your Gammbler Score</li>
              <li>Use automated tools to manipulate scores, leaderboards, or platform data</li>
              <li>Impersonate another person or entity</li>
              <li>Engage in any activity that disrupts the Platform or other users&apos; experience</li>
            </ul>
            <p className="mt-3">
              Violation of these terms may result in immediate account suspension or termination without refund.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Gammbler Score &amp; Verification</h2>
            <p>
              The Gammbler Score is a proprietary metric that measures betting performance based on data submitted by users. Scores are calculated using our algorithms and may be adjusted based on verification status. <strong>Verified entries</strong> (via sportsbook sync, CSV imports, or pre-game verification) carry higher trust weight than manual entries.
            </p>
            <p className="mt-3">
              Gammbler makes no guarantee that scores perfectly reflect a user&apos;s true betting ability. Scores are for entertainment, comparison, and community purposes only and should not be used as the sole basis for financial decisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Capper Marketplace</h2>
            <p>
              The Capper Marketplace allows users (&quot;Cappers&quot;) to offer paid subscriptions for their picks and analysis. Gammbler facilitates these transactions and retains a 30% platform fee on subscription revenue. By participating as a Capper, you agree that:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Your published picks and analysis are your own opinions, not guaranteed outcomes</li>
              <li>You will not guarantee wins or make misleading claims about your performance</li>
              <li>Subscribers are purchasing access to your analysis, not guaranteed returns</li>
              <li>Gammbler is not responsible for the accuracy or profitability of any Capper&apos;s picks</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Subscriptions &amp; Payments</h2>
            <p>
              Gammbler offers a free tier and a Pro subscription ($8.99/month). Pro subscriptions are billed monthly through Stripe, our payment processor. By subscribing, you agree to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Automatic monthly billing until you cancel</li>
              <li>Cancellation takes effect at the end of the current billing period</li>
              <li>No refunds for partial months</li>
              <li>Price changes with 30 days notice</li>
            </ul>
            <p className="mt-3">
              All users start on the free tier at signup. You may upgrade to Pro at any time to unlock additional features including sportsbook auto-sync.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. User Content</h2>
            <p>
              By posting content on Gammbler (including community feed posts, comments, and bet data), you grant Gammbler a non-exclusive, royalty-free, worldwide license to display, reproduce, and distribute that content within the Platform. You retain ownership of your content.
            </p>
            <p className="mt-3">
              We reserve the right to remove any content that violates these terms, is offensive, misleading, or otherwise inappropriate.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Disclaimer of Gambling Liability</h2>
            <p className="font-semibold text-white">
              GAMMBLER DOES NOT ENCOURAGE, FACILITATE, OR ENDORSE GAMBLING. We are a data analytics and community platform.
            </p>
            <p className="mt-3">
              Users who place bets through third-party sportsbooks do so entirely at their own risk. Gammbler bears no responsibility for any financial losses incurred through sports betting. We strongly encourage all users to review our{' '}
              <Link href="/responsible-gambling" className="text-accent hover:text-accent-light">Responsible Gambling Policy</Link>{' '}
              and to bet only what they can afford to lose.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, GAMMBLER INC., ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE PLATFORM.
            </p>
            <p className="mt-3">
              Our total liability for any claim arising from these terms or your use of the Platform shall not exceed the amount you paid to Gammbler in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">10. Intellectual Property</h2>
            <p>
              The Gammbler name, logo, Gammbler Score algorithm, and all Platform content and design are the intellectual property of Gammbler Inc. You may not copy, modify, distribute, or create derivative works from our Platform without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. Termination</h2>
            <p>
              We may suspend or terminate your account at any time for violation of these terms. You may delete your account at any time through the Settings page. Upon deletion, your personal data will be removed in accordance with our{' '}
              <Link href="/privacy" className="text-accent hover:text-accent-light">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">12. Governing Law</h2>
            <p>
              These terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflict of law provisions. Any disputes arising from these terms shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">13. Changes to These Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Material changes will be communicated via email or Platform notification at least 30 days before taking effect. Continued use of the Platform after changes take effect constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">14. Contact</h2>
            <p>
              For questions about these Terms of Service, contact us at{' '}
              <a href="mailto:legal@gammbler.com" className="text-accent hover:text-accent-light">legal@gammbler.com</a>.
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
