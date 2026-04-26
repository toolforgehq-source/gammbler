'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return <>{children}</>;
}
