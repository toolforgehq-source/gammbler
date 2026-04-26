'use client';

import { useState, Suspense } from 'react';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Check, AlertCircle } from 'lucide-react';

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
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authAPI.signup({
        email,
        password,
        username,
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
          <p className="text-accent text-sm mt-2 font-semibold">FREE FOR 14 DAYS</p>
          <p className="text-muted-dark text-xs mt-1">No credit card required</p>
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

          <div className="flex items-start gap-3 py-2">
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
              and acknowledge that sports betting legality varies by state. I confirm I am in compliance with my local regulations.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !tosAccepted || usernameAvailable === false}
            className="w-full bg-accent text-background font-bold py-3 rounded-lg uppercase tracking-wider hover:bg-accent-light transition-colors disabled:opacity-50"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {loading ? 'Creating Account...' : 'Start Free Trial'}
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
