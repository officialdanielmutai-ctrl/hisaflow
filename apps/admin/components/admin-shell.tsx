'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Cpu,
  MessageSquare,
  Users,
  Send,
  Megaphone,
  CheckSquare,
  CreditCard,
  ShieldAlert,
  Search,
  LogOut,
  ChevronDown,
  Shield,
  Menu,
  X,
} from 'lucide-react';
import { useUser, useClerk } from '@clerk/nextjs';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'CORE',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    label: 'ACCOUNTS',
    items: [
      { name: 'Organizations', href: '/accounts', icon: Building2 },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { name: 'AI Providers', href: '/providers', icon: Cpu },
    ],
  },
  {
    label: 'SUPPORT',
    items: [
      { name: 'Messages', href: '/messages', icon: MessageSquare },
      { name: 'User Directory', href: '/directory', icon: Users },
    ],
  },
  {
    label: 'COMMS & MARKETING',
    items: [
      { name: 'Bulk Send', href: '/comms', icon: Send },
      { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Work Queue', href: '/work-queue', icon: CheckSquare },
      { name: 'Billing', href: '/billing', icon: CreditCard, badge: 'Phase F' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { name: 'Audit Log', href: '/audit', icon: ShieldAlert },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Skip shell on auth pages
  if (pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up')) {
    return <main className="min-h-screen bg-admin-950 flex items-center justify-center p-4">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-admin-950 text-slate-100 flex flex-col antialiased">
      {/* Top Bar */}
      <header className="h-16 border-b border-admin-800 bg-admin-900/90 backdrop-blur sticky top-0 z-40 px-4 lg:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded text-slate-400 hover:text-white hover:bg-admin-800"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-white group">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:bg-brand-500 transition-colors">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold leading-none">HisaFlow</span>
              <span className="text-[10px] font-mono tracking-wider uppercase text-brand-400 font-semibold mt-0.5">Control Center</span>
            </div>
          </Link>

          <div className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ml-2">
            ● Production
          </div>
        </div>

        {/* Global Search */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search organizations, subscribers, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-admin-950 border border-admin-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
            />
          </div>
        </div>

        {/* Identity & Sign Out */}
        <div className="flex items-center gap-3">
          {isLoaded && user && (
            <div className="flex items-center gap-3 pl-3 border-l border-admin-800">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-medium text-slate-200 leading-tight">
                  {user.fullName || user.primaryEmailAddress?.emailAddress}
                </span>
                <span className="text-[10px] font-mono text-brand-400 font-semibold uppercase">Super Admin</span>
              </div>
              <button
                onClick={() => signOut()}
                title="Sign out of Admin Panel"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-admin-800/80 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Persistent Sidebar (Desktop) */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-admin-800 bg-admin-900/60 overflow-y-auto">
          <div className="p-4 space-y-6">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="px-3 text-[10px] font-mono uppercase font-semibold text-slate-500 tracking-wider">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/20'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-admin-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-admin-800 text-slate-400 border border-admin-700">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex">
            <div className="w-72 bg-admin-900 h-full p-4 overflow-y-auto border-r border-admin-800">
              <div className="flex items-center justify-between pb-4 border-b border-admin-800 mb-4">
                <span className="text-sm font-bold text-white">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-6">
                {NAV_GROUPS.map((group) => (
                  <div key={group.label} className="space-y-1">
                    <p className="px-3 text-[10px] font-mono uppercase font-semibold text-slate-500 tracking-wider">
                      {group.label}
                    </p>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium ${
                            isActive
                              ? 'bg-brand-600 text-white'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-admin-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4" />
                            <span>{item.name}</span>
                          </div>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-admin-800 text-slate-400 border border-admin-700">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Content Shell */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-admin-950">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
