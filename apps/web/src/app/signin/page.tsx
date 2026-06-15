'use client';

import { useState } from 'react';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authAPI.signin({ email, password });
      setAuth(res.data.user, res.data.token);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sign in failed');
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
            Sign In
          </h1>
          <p className="text-muted-dark text-sm mt-2">Welcome back. Let&apos;s see your edge.</p>
        </div>

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

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white placeholder-muted-dark focus:outline-none focus:border-accent transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="text-right">
            <Link href="/forgot-password" className="text-xs text-muted-dark hover:text-accent transition-colors">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-background font-bold py-3 rounded-lg uppercase tracking-wider hover:bg-accent-light transition-colors disabled:opacity-50"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-dark">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-accent hover:text-accent-light font-medium">
            Sign Up Free
          </Link>
        </p>
      </div>
    </div>
  );
}
