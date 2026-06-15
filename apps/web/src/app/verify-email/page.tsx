'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { authAPI } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    authAPI.verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Verification failed');
      });
  }, [token]);

  return (
    <div className="text-center">
      {status === 'loading' && (
        <p className="text-muted-dark">Verifying your email...</p>
      )}
      {status === 'success' && (
        <div className="bg-accent/10 border border-accent/40 rounded-lg p-4">
          <p className="text-accent font-medium mb-4">{message}</p>
          <Link
            href="/dashboard"
            className="bg-accent text-background font-bold py-3 px-8 rounded-lg uppercase tracking-wider hover:bg-accent-light transition-colors inline-block"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Go to Dashboard
          </Link>
        </div>
      )}
      {status === 'error' && (
        <div className="bg-loss/10 border border-loss/40 rounded-lg p-4">
          <p className="text-loss mb-4">{message}</p>
          <Link href="/dashboard" className="text-accent hover:text-accent-light font-medium">
            Go to Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
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
            Email Verification
          </h1>
        </div>

        <Suspense fallback={<div className="text-center text-muted-dark">Loading...</div>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
