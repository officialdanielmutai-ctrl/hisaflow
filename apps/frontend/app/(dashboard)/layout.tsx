import BottomNav from '@/components/layout/BottomNav';
import OrgGate from '@/components/system/OrgGate';
import NotificationPrompt from '@/components/system/NotificationPrompt';
import InstallPrompt from '@/components/system/InstallPrompt';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] pb-20">
      <main className="max-w-lg mx-auto px-4 pt-6">
        <OrgGate>{children}</OrgGate>
      </main>
      <BottomNav />
      <NotificationPrompt />
      <InstallPrompt />
    </div>
  );
}

