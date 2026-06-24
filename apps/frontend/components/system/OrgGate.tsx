'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMyOrganization } from '@/hooks/useMyOrganization';

/**
 * Wraps every dashboard page.
 * - While membership is loading → shows a skeleton so pages never flash "staff view"
 * - If no membership after load → redirects to /onboarding
 * - If membership exists → renders children normally
 */
export default function OrgGate({ children }: { children: React.ReactNode }) {
  const { membership, loading } = useMyOrganization();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !membership) {
      router.replace('/onboarding');
    }
  }, [loading, membership, router]);

  // Loading state — hide content until we know who the user is
  if (loading) {
    return (
      <div className="flex flex-col gap-3 pt-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 w-full animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  // No membership — will redirect, render nothing in the meantime
  if (!membership) return null;

  return <>{children}</>;
}
