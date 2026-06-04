import BottomNav from '@/components/layout/BottomNav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] pb-20">
      <main className="max-w-lg mx-auto px-4 pt-6">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
