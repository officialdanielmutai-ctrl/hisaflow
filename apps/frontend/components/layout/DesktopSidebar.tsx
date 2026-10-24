'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Sparkles,
  Bell,
  ListTodo,
  Receipt,
  Settings,
  Bed,
  CalendarDays,
  Users,
  Tag,
  Briefcase,
  TicketCheck,
  CreditCard,
  Palette,
} from 'lucide-react'
import { useMyOrganization } from '@/hooks/useMyOrganization'
import { useAlerts } from '@/hooks/useAlerts'
import { UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badgeCount?: number
}

export default function DesktopSidebar() {
  const pathname = usePathname()
  const { membership } = useMyOrganization()
  const { data: alerts } = useAlerts()

  const businessType = membership?.organization?.businessType || ''
  const isHospitality = ['GUEST_HOUSE', 'HOTEL', 'LODGE'].includes(businessType)
  const isRestaurant = businessType === 'RESTAURANT'
  const isSchool = businessType === 'SCHOOL'
  const isIsp = businessType === 'ISP'

  // Base core nav items
  const primaryNav: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]

  // Vertical-specific nav injection
  if (isHospitality) {
    primaryNav.push(
      { href: '/rooms', label: 'Rooms', icon: Bed },
      { href: '/bookings', label: 'Bookings', icon: CalendarDays },
      { href: '/guests', label: 'Guests', icon: Users },
      { href: '/finance', label: 'Finance', icon: TrendingUp },
      { href: '/inventory', label: 'Inventory', icon: Package }
    )
  } else if (isRestaurant) {
    primaryNav.push(
      { href: '/table-orders', label: 'Table Orders', icon: CalendarDays },
      { href: '/inventory', label: 'Menu & Stock', icon: Package },
      { href: '/finance', label: 'Finance', icon: TrendingUp }
    )
  } else if (isSchool) {
    primaryNav.push(
      { href: '/school-classes', label: 'Classes', icon: Users },
      { href: '/students', label: 'Students', icon: Users },
      { href: '/school-fees', label: 'School Fees', icon: Receipt },
      { href: '/finance', label: 'Finance', icon: TrendingUp }
    )
  } else if (isIsp) {
    primaryNav.push(
      { href: '/subscribers', label: 'Subscribers', icon: Users },
      { href: '/service-plans', label: 'Service Plans', icon: Tag },
      { href: '/work-orders', label: 'Work Orders', icon: Briefcase },
      { href: '/tickets', label: 'Tickets', icon: TicketCheck },
      { href: '/inventory', label: 'Hardware', icon: Package },
      { href: '/finance', label: 'Billing & Finance', icon: TrendingUp }
    )
  } else {
    // Retail & wholesale default
    primaryNav.push(
      { href: '/finance', label: 'Sales & Finance', icon: TrendingUp },
      { href: '/inventory', label: 'Inventory', icon: Package }
    )
  }

  // Cross-cutting productivity tools
  const secondaryNav: NavItem[] = [
    { href: '/assistant', label: 'AI Assistant', icon: Sparkles },
    {
      href: '/alerts',
      label: 'Alerts',
      icon: Bell,
      badgeCount: (alerts ?? []).length > 0 ? (alerts ?? []).length : undefined,
    },
    { href: '/notes', label: 'Notes', icon: ListTodo },
    { href: '/tax', label: 'Tax & Compliance', icon: Receipt },
    { href: '/settings/billing', label: 'Subscription', icon: CreditCard },
  ]

  return (
    <aside
      aria-label="Desktop Dock Navigation"
      className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-16 flex-col items-center justify-between border-r border-[var(--color-border)] bg-[var(--color-bg-surface)] py-4 select-none shadow-sm transition-colors duration-200"
    >
      {/* Top: Brand Logo Mark */}
      <div className="flex flex-col items-center gap-6">
        <Link
          href="/dashboard"
          className="group relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[#115E43] text-white shadow-sm hover:scale-105 transition-transform"
          aria-label="HisaFlow Home"
        >
          <span className="text-lg font-black tracking-tight">H</span>
          <div className="pointer-events-none absolute left-full ml-3 hidden rounded-lg bg-[var(--color-text-primary)] px-2.5 py-1 text-xs font-semibold text-[var(--color-bg-surface)] shadow-md group-hover:flex whitespace-nowrap z-50">
            HisaFlow
          </div>
        </Link>

        {/* Primary Navigation Rail */}
        <nav
          className="flex flex-col items-center gap-1.5"
          aria-label="Main Navigation"
        >
          {primaryNav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' &&
                pathname.startsWith(item.href + '/'))
            const Icon = item.icon

            return (
              <div
                key={item.href}
                className="group relative flex items-center justify-center"
              >
                <Link
                  href={item.href}
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-xl transition-all',
                    isActive
                      ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent)] font-bold shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)]'
                  )}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-5 w-5" />
                  {item.badgeCount && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {item.badgeCount > 9 ? '9+' : item.badgeCount}
                    </span>
                  )}
                </Link>
                <div className="pointer-events-none absolute left-full ml-3 hidden rounded-lg bg-[var(--color-text-primary)] px-2.5 py-1 text-xs font-semibold text-[var(--color-bg-surface)] shadow-md group-hover:flex whitespace-nowrap z-50">
                  {item.label}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="h-px w-8 bg-[var(--color-border)]" />

        {/* Secondary Productivity Rail */}
        <nav
          className="flex flex-col items-center gap-1.5"
          aria-label="Productivity Tools"
        >
          {secondaryNav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' &&
                pathname.startsWith(item.href + '/'))
            const Icon = item.icon

            return (
              <div
                key={item.href}
                className="group relative flex items-center justify-center"
              >
                <Link
                  href={item.href}
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-xl transition-all',
                    isActive
                      ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent)] font-bold shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)]'
                  )}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-5 w-5" />
                  {item.badgeCount && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                      {item.badgeCount > 9 ? '9+' : item.badgeCount}
                    </span>
                  )}
                </Link>
                <div className="pointer-events-none absolute left-full ml-3 hidden rounded-lg bg-[var(--color-text-primary)] px-2.5 py-1 text-xs font-semibold text-[var(--color-bg-surface)] shadow-md group-hover:flex whitespace-nowrap z-50">
                  {item.label}
                </div>
              </div>
            )
          })}
        </nav>
      </div>

      {/* Bottom Rail: Theme, Settings & User Profile */}
      <div className="flex flex-col items-center gap-3">
        {/* Appearance & theme */}
        <div className="group relative flex items-center justify-center">
          <Link
            href="/settings/appearance"
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl transition-all',
              pathname.startsWith('/settings/appearance')
                ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent)] font-bold'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)]'
            )}
            aria-label="Appearance and theme"
          >
            <Palette className="h-5 w-5" />
          </Link>
          <div className="pointer-events-none absolute left-full ml-3 hidden rounded-lg bg-[var(--color-text-primary)] px-2.5 py-1 text-xs font-semibold text-[var(--color-bg-surface)] shadow-md group-hover:flex whitespace-nowrap z-50">
            Appearance &amp; theme
          </div>
        </div>

        {/* Settings */}
        <div className="group relative flex items-center justify-center">
          <Link
            href="/settings"
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl transition-all',
              pathname.startsWith('/settings') &&
                !pathname.startsWith('/settings/appearance')
                ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent)] font-bold'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)]'
            )}
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <div className="pointer-events-none absolute left-full ml-3 hidden rounded-lg bg-[var(--color-text-primary)] px-2.5 py-1 text-xs font-semibold text-[var(--color-bg-surface)] shadow-md group-hover:flex whitespace-nowrap z-50">
            Settings
          </div>
        </div>

        {/* User Button */}
        <div className="pt-1">
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: 'h-8 w-8 rounded-xl',
              },
            }}
          />
        </div>
      </div>
    </aside>
  )
}
