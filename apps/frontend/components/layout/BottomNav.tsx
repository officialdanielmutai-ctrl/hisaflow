'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Bell,
  Sparkles,
  TrendingUp,
  Settings,
  ListTodo,
} from 'lucide-react';
import { useRole } from '@/hooks/useRole';

const tabs = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/inventory', label: 'Stock', icon: Package },
  { href: '/transactions', label: 'Log', icon: ArrowLeftRight },
  { href: '/finance', label: 'Finance', icon: TrendingUp },
  { href: '/notes', label: 'Notes', icon: ListTodo },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/ai', label: 'AI', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { isStaff } = useRole();

  const visibleTabs = isStaff
    ? tabs.filter((tab) => tab.href !== '/ai')
    : tabs;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-[var(--color-bg-surface)] border-t border-[var(--color-border)] pb-safe">
      <div className="flex items-center justify-around h-16">
        {visibleTabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== '/' && pathname.startsWith(tab.href));

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
            >
              <tab.icon
                className={`h-6 w-6 ${
                  isActive
                    ? 'text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)]'
                }`}
              />
              <span
                className={`text-[10px] ${
                  isActive
                    ? 'font-semibold text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
