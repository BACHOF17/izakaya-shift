'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface SessionUser {
  id: number;
  name: string;
  role: 'staff' | 'owner';
}

export function useSession(requiredRole?: 'staff' | 'owner') {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => {
        if (!r.ok) { router.push('/'); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        if (requiredRole && data.role !== requiredRole) {
          router.push('/');
          return;
        }
        setSession(data);
        setLoading(false);
      })
      .catch(() => { router.push('/'); });
  }, [router, requiredRole]);

  return { session, loading };
}
