'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Sparkles,
  TrendingUp,
  StickyNote,
} from 'lucide-react';
import { useRole } from '@/hooks/useRole';

const ownerTabs = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/inventory', label: 'Stock', icon: Package },
  { href: '/ai', label: 'AI', icon: Sparkles },
  { href: '/transactions', label: 'Log', icon: ArrowLeftRight },
  { href: '/finance', label: 'Finance', icon: TrendingUp },
];

const staffTabs = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/inventory', label: 'Stock', icon: Package },
  { href: '/transactions', label: 'Log', icon: ArrowLeftRight },
  { href: '/notes', label: 'Notes', icon: StickyNote },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { isStaff } = useRole();

  const visibleTabs = isStaff ? staffTabs : ownerTabs;

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
