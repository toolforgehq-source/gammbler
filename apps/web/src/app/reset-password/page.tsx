'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { authAPI } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await authAPI.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-loss mb-4">Invalid reset link.</p>
        <Link href="/forgot-password" className="text-accent hover:text-accent-light font-medium">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return success ? (
    <div className="bg-accent/10 border border-accent/40 rounded-lg p-4 text-center">
      <p className="text-accent font-medium mb-2">Password reset successful</p>
      <p className="text-muted-dark text-sm mb-4">You can now sign in with your new password.</p>
      <Link
        href="/signin"
        className="bg-accent text-background font-bold py-3 px-8 rounded-lg uppercase tracking-wider hover:bg-accent-light transition-colors inline-block"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Sign In
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
          New Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white placeholder-muted-dark focus:outline-none focus:border-accent transition-colors"
          placeholder="••••••••"
          required
          minLength={8}
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Confirm Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white placeholder-muted-dark focus:outline-none focus:border-accent transition-colors"
          placeholder="••••••••"
          required
          minLength={8}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent text-background font-bold py-3 rounded-lg uppercase tracking-wider hover:bg-accent-light transition-colors disabled:opacity-50"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
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
            New Password
          </h1>
          <p className="text-muted-dark text-sm mt-2">Choose a new password for your account.</p>
        </div>

        <Suspense fallback={<div className="text-center text-muted-dark">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>

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
