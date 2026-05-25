import { cn } from '@/lib/utils';
import { Bell, House, Package, ArrowLeftRight, Menu } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  activeTab?: string;
  businessName?: string;
}

export default function AppShell({
  children,
  activeTab = 'home',
  businessName = 'Hisaflow',
}: AppShellProps) {
  const tabs = [
    { label: 'home', icon: House },
    { label: 'inventory', icon: Package },
    { label: 'transactions', icon: ArrowLeftRight },
    { label: 'alerts', icon: Bell },
    { label: 'more', icon: Menu },
  ] as const;

  return (
    <div className="flex h-dvh flex-col bg-[var(--color-bg-base)]">
      {/* Top bar */}
      <header className="flex h-12 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4">
        <h3 className="font-semibold text-[var(--color-text-primary)]">{businessName}</h3>
        <Bell className="h-6 w-6 text-[var(--color-text-secondary)]" />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="flex h-14 items-center justify-around border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        {tabs.map((tab) => (
          <div
            key={tab.label}
            className={cn(
              'flex flex-col items-center gap-0.5 text-[11px]',
              activeTab === tab.label
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)]'
            )}
          >
            <tab.icon className="h-6 w-6" />
            <span>{tab.label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}
