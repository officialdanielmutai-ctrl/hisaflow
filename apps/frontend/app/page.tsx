'use client';

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@clerk/nextjs';
import AppShell from '@/components/layout/AppShell';
import AlertCard from '@/components/system/AlertCard';
import OperationalSummary from '@/components/system/OperationalSummary';
import { useDashboard } from '@/hooks/useDashboard';
import { useMyOrganization } from '@/hooks/useMyOrganization';

export default function DashboardPage() {
  const { organization, isLoaded } = useOrganization();
  const organizationId = organization?.id ?? null;
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !organization) {
      router.push('/onboarding')
    }
  }, [isLoaded, organization, router]);

  const { data, loading, error } = useDashboard(organizationId);
  const { membership } = useMyOrganization();

  if (loading) {
    return (
      <AppShell businessName="Hisaflow" activeTab="home">
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => (
            <div key={i}
              className="h-20 rounded-xl bg-[var(--color-bg-surface)]
                animate-pulse" />
          ))}
        </div>
      </AppShell>
    )
  }

  if (error || !data) {
    return (
      <AppShell businessName="Hisaflow" activeTab="home">
        <div className="py-12 text-center
          text-[var(--color-text-secondary)]">
          {error ?? 'No data available'}
        </div>
      </AppShell>
    )
  }

  const { snapshot, attentionFeed } = data

  return (
    <AppShell
      businessName={membership?.organization.name ?? 'Hisaflow'}
      activeTab="home"
    >
      <div className="flex flex-col gap-6">
        <section>
          <p className="text-xs font-semibold uppercase
            tracking-wide text-[var(--color-text-muted)] mb-3">
            Today
          </p>
          <div className="grid grid-cols-2 gap-3">
            <OperationalSummary
              label="Sales"
              value={String(snapshot.todaySales)}
            />
            <OperationalSummary
              label="Low stock"
              value={String(
                snapshot.lowStockCount +
                snapshot.criticalStockCount
              )}
              trend={
                snapshot.lowStockCount > 0 ? 'down' : 'neutral'
              }
              trendLabel={
                snapshot.lowStockCount > 0
                  ? 'needs attention'
                  : 'all good'
              }
            />
          </div>
        </section>

        {attentionFeed.length > 0 && (
          <section>
            <p className="text-xs font-semibold uppercase
              tracking-wide text-[var(--color-text-muted)] mb-3">
              Needs Attention
            </p>
            <div className="flex flex-col gap-3">
              {attentionFeed.slice(0, 5).map((item, i) => (
                <AlertCard
                  key={item.itemId ?? i}
                  severity={item.severity}
                  title={item.title}
                  description={item.description}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="text-xs font-semibold uppercase
            tracking-wide text-[var(--color-text-muted)] mb-3">
            Inventory
          </p>
          <div className="rounded-xl bg-[var(--color-bg-surface)]
            p-4 shadow-sm">
            <p className="text-2xl font-bold
              text-[var(--color-text-primary)]">
              {snapshot.totalItems}
            </p>
            <p className="text-sm
              text-[var(--color-text-secondary)]">
              active items
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
