'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Sparkles,
  TrendingUp,
  Plus,
  LayoutGrid
} from 'lucide-react';
import { useRole } from '@/hooks/useRole';

const ownerTabs = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/finance', label: 'Sales', icon: TrendingUp },
  { href: '/inventory?action=add', label: 'Add', icon: Plus, isFab: true },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/ai', label: 'More', icon: LayoutGrid },
];

const staffTabs = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/transactions', label: 'Sales', icon: TrendingUp },
  { href: '/inventory?action=add', label: 'Add', icon: Plus, isFab: true },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/ai', label: 'More', icon: LayoutGrid },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { isStaff } = useRole();

  const visibleTabs = isStaff ? staffTabs : ownerTabs;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] rounded-t-3xl pb-4">
      <div className="flex items-center justify-around h-20 px-2">
        {visibleTabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== '/' && pathname.startsWith(tab.href.split('?')[0]));

          if (tab.isFab) {
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className="flex flex-col items-center justify-center -mt-6"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] shadow-lg shadow-green-200">
                  <tab.icon className="h-7 w-7 text-white" />
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)] font-medium mt-1">
                  {tab.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full pt-2"
            >
              <tab.icon
                className={`h-6 w-6 ${
                  isActive
                    ? 'text-[var(--color-accent)] fill-[var(--color-accent)]/10'
                    : 'text-[var(--color-text-muted)]'
                }`}
              />
              <span
                className={`text-[10px] font-medium ${
                  isActive
                    ? 'text-[var(--color-accent)]'
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
