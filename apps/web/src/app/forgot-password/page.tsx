'use client';

import { useState } from 'react';
import { authAPI } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
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
            Reset Password
          </h1>
          <p className="text-muted-dark text-sm mt-2">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="bg-accent/10 border border-accent/40 rounded-lg p-4 text-center">
            <p className="text-accent font-medium mb-2">Check your email</p>
            <p className="text-muted-dark text-sm">
              If an account exists with <strong className="text-white">{email}</strong>, we&apos;ve sent a password reset link.
            </p>
            <Link href="/signin" className="text-accent hover:text-accent-light text-sm font-medium mt-4 inline-block">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-loss/10 border border-loss/40 rounded-lg p-3 text-sm text-loss">
                {error}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-background font-bold py-3 rounded-lg uppercase tracking-wider hover:bg-accent-light transition-colors disabled:opacity-50"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-dark">
          Remember your password?{' '}
          <Link href="/signin" className="text-accent hover:text-accent-light font-medium">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
