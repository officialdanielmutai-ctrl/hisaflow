'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Bell, ListTodo, LogOut } from 'lucide-react';
import { SignOutButton, useUser } from '@clerk/nextjs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';

interface SideMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sideNavItems = [
  { href: '/notes', label: 'Notes', icon: ListTodo },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function SideMenu({ open, onOpenChange }: SideMenuProps) {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex flex-col border-r bg-white w-[280px] p-0">
        <SheetHeader className="border-b p-6 text-left">
          <SheetTitle className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Hisa Flow
          </SheetTitle>
          {user && (
            <SheetDescription className="mt-2 text-sm text-[var(--color-text-muted)]">
              {user.fullName || user.primaryEmailAddress?.emailAddress}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="flex flex-col gap-1 px-3">
            {sideNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent)]'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)]'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <SheetFooter className="border-t p-4">
          <SignOutButton>
            <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50">
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </SignOutButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
