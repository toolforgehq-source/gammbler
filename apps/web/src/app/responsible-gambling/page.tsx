import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Phone, Globe, ShieldCheck, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Responsible Gambling — Gammbler',
  description: 'Gammbler is committed to promoting responsible gambling. Find resources and support for gambling-related concerns.',
};

export default function ResponsibleGamblingPage() {
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
          Responsible Gambling
        </h1>
        <p className="text-muted-dark text-sm mb-10">Your well-being matters more than any score</p>

        {/* Platform Disclaimer */}
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-6 mb-10">
          <div className="flex items-start gap-3">
            <ShieldCheck size={24} className="text-accent shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold text-white mb-2">Gammbler is NOT a Sportsbook</h2>
              <p className="text-sm text-gray-300 leading-relaxed">
                Gammbler is a skill-based analytics and score-tracking platform. We do not accept, process, or facilitate any wagers or bets. All bets tracked on our platform are placed by users on separate, licensed third-party sportsbooks. Gammbler serves solely as a tool for tracking, analyzing, and comparing betting performance.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8 text-sm text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">Our Commitment</h2>
            <p>
              While Gammbler does not facilitate gambling, we recognize that many of our users participate in sports betting through licensed sportsbooks. We take our responsibility seriously and are committed to promoting safe, responsible gambling practices within our community.
            </p>
            <p className="mt-3">
              Sports betting should be entertaining, not stressful. If betting stops being fun, it&apos;s time to step back.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">Guidelines for Responsible Betting</h2>
            <ul className="space-y-3 text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold mt-0.5">1.</span>
                <span><strong className="text-white">Set a budget.</strong> Only bet what you can afford to lose. Never bet with money needed for rent, bills, or other obligations.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold mt-0.5">2.</span>
                <span><strong className="text-white">Set time limits.</strong> Don&apos;t let betting consume your free time. Take regular breaks.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold mt-0.5">3.</span>
                <span><strong className="text-white">Don&apos;t chase losses.</strong> Losing streaks are normal. Increasing bets to recover losses is a dangerous pattern.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold mt-0.5">4.</span>
                <span><strong className="text-white">Bet sober.</strong> Never make betting decisions under the influence of alcohol or drugs.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold mt-0.5">5.</span>
                <span><strong className="text-white">Use your Gammbler Score wisely.</strong> Your score reflects past performance, not future outcomes. No betting system can guarantee wins.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold mt-0.5">6.</span>
                <span><strong className="text-white">Keep it fun.</strong> If you feel anxious, stressed, or compelled to bet, take a break.</span>
              </li>
            </ul>
          </section>

          {/* Warning Signs */}
          <section>
            <div className="bg-loss/10 border border-loss/30 rounded-xl p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle size={20} className="text-loss shrink-0 mt-0.5" />
                <h2 className="text-base font-bold text-white">Warning Signs of Problem Gambling</h2>
              </div>
              <ul className="space-y-2 text-gray-400 ml-7">
                <li>Betting more than you can afford to lose</li>
                <li>Borrowing money to gamble</li>
                <li>Feeling restless or irritable when trying to stop</li>
                <li>Lying to family or friends about how much you bet</li>
                <li>Chasing losses by increasing bet sizes</li>
                <li>Neglecting work, school, or relationships because of betting</li>
                <li>Feeling that you need to bet with increasing amounts to achieve excitement</li>
                <li>Making repeated unsuccessful efforts to control or stop betting</li>
              </ul>
              <p className="text-sm text-white font-semibold mt-4 ml-7">
                If you recognize any of these signs, please reach out to the resources below.
              </p>
            </div>
          </section>

          {/* Resources */}
          <section>
            <h2 className="text-lg font-bold text-white mb-4">Help &amp; Resources</h2>
            <div className="space-y-4">
              <div className="bg-card border border-accent/10 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Phone size={18} className="text-accent" />
                  <h3 className="font-bold text-white">National Council on Problem Gambling (NCPG)</h3>
                </div>
                <p className="text-gray-400 ml-8">
                  Call or text: <a href="tel:1-800-522-4700" className="text-accent hover:text-accent-light font-semibold">1-800-522-4700</a>
                </p>
                <p className="text-gray-400 ml-8">
                  Available 24/7, confidential and free
                </p>
              </div>

              <div className="bg-card border border-accent/10 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Globe size={18} className="text-accent" />
                  <h3 className="font-bold text-white">National Problem Gambling Helpline</h3>
                </div>
                <p className="text-gray-400 ml-8">
                  Chat online: <a href="https://www.ncpgambling.org/help-treatment/chat/" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-light">ncpgambling.org/chat</a>
                </p>
              </div>

              <div className="bg-card border border-accent/10 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Globe size={18} className="text-accent" />
                  <h3 className="font-bold text-white">Gamblers Anonymous</h3>
                </div>
                <p className="text-gray-400 ml-8">
                  Find a meeting: <a href="https://www.gamblersanonymous.org/ga/" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-light">gamblersanonymous.org</a>
                </p>
              </div>

              <div className="bg-card border border-accent/10 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Globe size={18} className="text-accent" />
                  <h3 className="font-bold text-white">Self-Exclusion Programs</h3>
                </div>
                <p className="text-gray-400 ml-8">
                  Most states offer self-exclusion programs that allow you to voluntarily ban yourself from licensed sportsbooks. Contact your state&apos;s gaming commission for details.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">Underage Gambling Prevention</h2>
            <p>
              Gammbler requires all users to be at least 18 years of age. We collect date of birth during registration and reserve the right to request additional age verification at any time.
            </p>
            <p className="mt-3">
              If you believe a minor is using our Platform, please contact us immediately at{' '}
              <a href="mailto:support@gammbler.com" className="text-accent hover:text-accent-light">support@gammbler.com</a>.
            </p>
            <p className="mt-3">
              Parents and guardians: we recommend using parental control software to restrict access to gambling-related websites if minors use your devices.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">Our Responsibility</h2>
            <p>
              While we do not facilitate gambling, we are committed to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Enforcing minimum age requirements</li>
              <li>Displaying responsible gambling resources prominently</li>
              <li>Never encouraging users to increase betting activity</li>
              <li>Providing tools for users to manage their experience</li>
              <li>Training our team on responsible gambling practices</li>
              <li>Cooperating with regulatory authorities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">Contact Us</h2>
            <p>
              If you have questions about our responsible gambling practices, or if you need help, reach out to us at{' '}
              <a href="mailto:support@gammbler.com" className="text-accent hover:text-accent-light">support@gammbler.com</a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-accent/10 text-center text-xs text-muted-dark">
          <p>&copy; {new Date().getFullYear()} Gammbler Inc. All rights reserved.</p>
          <p className="mt-1">Gammbler is not a sportsbook and does not accept wagers.</p>
          <p className="mt-1">If you or someone you know has a gambling problem, call <a href="tel:1-800-522-4700" className="text-accent">1-800-522-4700</a>.</p>
        </div>
      </div>
    </div>
  );
}
