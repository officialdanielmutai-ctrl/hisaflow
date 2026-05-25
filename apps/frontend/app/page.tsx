import AppShell from '@/components/layout/AppShell';

export default function Home() {
  return (
    <AppShell businessName="Demo Business" activeTab="home">
      <div className="py-12 text-center text-[var(--color-text-secondary)]">
        Hisaflow is loading...
      </div>
    </AppShell>
  );
}
