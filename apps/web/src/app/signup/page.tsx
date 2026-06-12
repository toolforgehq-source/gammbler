'use client';

import { useState, Suspense } from 'react';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Check, AlertCircle, ShieldCheck } from 'lucide-react';

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>}>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref') || '';

  const checkUsername = async (value: string) => {
    setUsername(value);
    if (value.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    try {
      const res = await authAPI.checkUsername(value);
      setUsernameAvailable(res.data.available);
    } catch {
      setUsernameAvailable(null);
    }
  };

  const isUnder18 = (dob: string): boolean => {
    if (!dob) return false;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age < 18;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isUnder18(dateOfBirth)) {
      setError('You must be at least 18 years old to use Gammbler');
      return;
    }

    setLoading(true);

    try {
      const res = await authAPI.signup({
        email,
        password,
        username,
        date_of_birth: dateOfBirth,
        tos_accepted: tosAccepted,
        referral_code: referralCode || undefined,
      });
      setAuth(res.data.user, res.data.token);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Image
            src="/images/logo-main.png"
            alt="Gammbler"
            width={200}
            height={45}
            className="mx-auto mb-6"
            priority
          />
          <h1 className="text-3xl font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            Get Started
          </h1>
          <p className="text-accent text-sm mt-2 font-semibold">FREE FOREVER</p>
          <p className="text-muted-dark text-xs mt-1">Upgrade to Pro when you&apos;re ready</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-loss/10 border border-loss/40 rounded-lg p-3 text-sm text-loss flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white placeholder-muted-dark focus:outline-none focus:border-accent transition-colors"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => checkUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white placeholder-muted-dark focus:outline-none focus:border-accent transition-colors"
                placeholder="yourname"
                maxLength={30}
                required
              />
              {usernameAvailable !== null && username.length >= 3 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameAvailable ? (
                    <Check size={18} className="text-win" />
                  ) : (
                    <AlertCircle size={18} className="text-loss" />
                  )}
                </div>
              )}
            </div>
            {usernameAvailable === false && (
              <p className="text-xs text-loss mt-1">Username is already taken</p>
            )}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Date of Birth
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white placeholder-muted-dark focus:outline-none focus:border-accent transition-colors"
              required
              max={new Date().toISOString().split('T')[0]}
            />
            {dateOfBirth && isUnder18(dateOfBirth) && (
              <p className="text-xs text-loss mt-1">You must be at least 18 years old to use Gammbler</p>
            )}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white placeholder-muted-dark focus:outline-none focus:border-accent transition-colors"
              placeholder="Min 8 characters"
              minLength={8}
              required
            />
          </div>

          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="age"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 accent-accent"
                required
              />
              <label htmlFor="age" className="text-xs text-muted-dark leading-relaxed">
                I confirm that I am at least 18 years of age (or the legal betting age in my jurisdiction) and that online sports betting tracking is legal in my location.
              </label>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="tos"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="mt-0.5 accent-accent"
                required
              />
              <label htmlFor="tos" className="text-xs text-muted-dark leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" className="text-accent hover:text-accent-light">Terms of Service</Link>,{' '}
                <Link href="/privacy" className="text-accent hover:text-accent-light">Privacy Policy</Link>,
                {' '}and{' '}
                <Link href="/responsible-gambling" className="text-accent hover:text-accent-light">Responsible Gambling Policy</Link>.
              </label>
            </div>
          </div>

          <div className="bg-card/50 border border-accent/10 rounded-lg p-3 flex items-start gap-2">
            <ShieldCheck size={14} className="text-accent mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-dark leading-relaxed">
              Gammbler is NOT a sportsbook and does not accept wagers or bets of any kind. Gammbler is a skill-based analytics and score-tracking platform. Users are responsible for complying with all applicable laws in their jurisdiction.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !tosAccepted || !ageConfirmed || usernameAvailable === false || (dateOfBirth !== '' && isUnder18(dateOfBirth))}
            className="w-full bg-accent text-background font-bold py-3 rounded-lg uppercase tracking-wider hover:bg-accent-light transition-colors disabled:opacity-50"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {loading ? 'Creating Account...' : 'Create Free Account'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-dark">
          Already have an account?{' '}
          <Link href="/signin" className="text-accent hover:text-accent-light font-medium">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
