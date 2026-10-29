'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  BedDouble,
  Briefcase,
  CalendarCheck,
  Compass,
  GraduationCap,
  LayoutDashboard,
  Package,
  Pill,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
  Wallet,
  Wifi,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WalkthroughStep {
  id: string
  title: string
  description: string
  detail: string
  href: string
  icon: LucideIcon
}

function verticalStep(businessType: string | null): WalkthroughStep {
  switch (businessType) {
    case 'GUEST_HOUSE':
      return {
        id: 'bookings',
        title: 'Rooms, guests and bookings',
        description:
          'See arrivals and departures, keep guest history together and put room charges and consumption on one bill.',
        detail: 'Sidebar → Bookings',
        href: '/bookings',
        icon: BedDouble,
      }
    case 'ISP':
      return {
        id: 'subscribers',
        title: 'Subscribers, plans and field work',
        description:
          'Keep subscribers, service plans, invoices and technician work orders in one place.',
        detail: 'Sidebar → Subscribers',
        href: '/subscribers',
        icon: Wifi,
      }
    case 'SCHOOL':
      return {
        id: 'students',
        title: 'Students, classes and fees',
        description:
          'Track students, class lists, fee balances and term payments without digging through spreadsheets.',
        detail: 'Sidebar → Students',
        href: '/students',
        icon: GraduationCap,
      }
    case 'RESTAURANT':
      return {
        id: 'tables',
        title: 'Tables and orders',
        description:
          'Run table orders, settle bills and keep the kitchen queue visible at a glance.',
        detail: 'Sidebar → Table orders',
        href: '/table-orders',
        icon: UtensilsCrossed,
      }
    case 'CHEMIST':
      return {
        id: 'batches',
        title: 'Batches and expiry',
        description:
          'Track stock batches and expiry dates so near-expiry items are flagged before they become a loss.',
        detail: 'Sidebar → Inventory',
        href: '/inventory',
        icon: Pill,
      }
    case 'WHOLESALER':
      return {
        id: 'tiered-pricing',
        title: 'Wholesale pricing',
        description:
          'Set tiered prices by quantity and keep credit balances visible while you sell.',
        detail: 'Sidebar → Inventory',
        href: '/inventory',
        icon: Briefcase,
      }
    default:
      return {
        id: 'counter',
        title: 'Your counter tools',
        description:
          'Record a sale, receive stock and see the daily totals update in one place.',
        detail: 'Sidebar → Transactions',
        href: '/transactions',
        icon: ShoppingCart,
      }
  }
}

/** The guided feature list, adapted to the user's business type. */
export function buildWalkthroughSteps(
  businessType: string | null | undefined
): WalkthroughStep[] {
  const base: WalkthroughStep[] = [
    {
      id: 'dashboard',
      title: 'Your daily command centre',
      description:
        'Home brings today’s sales, stock health, payments and the things that need attention into one view.',
      detail: 'Sidebar → Home',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'inventory',
      title: 'Know what you have',
      description:
        'Search stock, add items, scan barcodes and catch low stock before a customer asks.',
      detail: 'Sidebar → Inventory',
      href: '/inventory',
      icon: Package,
    },
    {
      id: 'sales',
      title: 'Record sales in seconds',
      description:
        'Take a sale, receive stock or make an adjustment. Every change lands in the ledger with an audit trail.',
      detail: 'Sidebar → Transactions',
      href: '/transactions',
      icon: ShoppingCart,
    },
    {
      id: 'finance',
      title: 'Keep the money straight',
      description:
        'See cash flow, profit, tax and outstanding credit without rebuilding a spreadsheet at month-end.',
      detail: 'Sidebar → Finance',
      href: '/finance',
      icon: Wallet,
    },
    {
      id: 'assistant',
      title: 'Ask HisaFlow',
      description:
        'Describe a delivery or ask what to reorder. The assistant proposes changes and you stay in control of what is confirmed.',
      detail: 'Sidebar → Assistant',
      href: '/assistant',
      icon: Sparkles,
    },
  ]

  return [
    ...base,
    verticalStep(businessType ?? null),
    {
      id: 'alerts',
      title: 'Never miss a signal',
      description:
        'Low stock, expiring batches, tax issues and other operational alerts surface in one attention feed.',
      detail: 'Sidebar → Alerts',
      href: '/alerts',
      icon: Bell,
    },
    {
      id: 'customise',
      title: 'Make Home yours',
      description:
        'Long-press, right-click or use the ⋯ menu on a Home card to reorder, resize or restyle it. Your layout is saved.',
      detail: 'Home → CUSTOMISE HOME',
      href: '/dashboard',
      icon: CalendarCheck,
    },
  ]
}

export function FeatureWalkthrough({
  open,
  steps,
  onSkip,
  onComplete,
}: {
  open: boolean
  steps: WalkthroughStep[]
  onSkip: () => void
  onComplete: () => void
}) {
  const [index, setIndex] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onSkip])

  if (!open || steps.length === 0 || typeof document === 'undefined') {
    return null
  }

  const step = steps[Math.min(index, steps.length - 1)]
  const Icon = step.icon
  const isLast = index === steps.length - 1

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="walkthrough-title"
        tabIndex={-1}
        className="relative flex max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[28px] border border-[var(--hf-border-subtle)] bg-[var(--hf-bg-surface)] shadow-[0_28px_80px_-24px_rgba(0,0,0,0.55)] outline-none"
      >
        <aside className="hidden w-[250px] shrink-0 flex-col bg-[var(--hf-accent-default)] p-6 text-[var(--hf-accent-foreground)] md:flex">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">
            HisaFlow tour
          </p>
          <p className="mt-2 text-lg font-bold leading-tight">
            A quick look around your workspace
          </p>
          <ol className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto">
            {steps.map((item, itemIndex) => {
              const StepIcon = item.icon
              const active = itemIndex === index
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(itemIndex)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[11px] font-semibold transition-colors',
                      active
                        ? 'bg-white/15 text-[var(--hf-accent-foreground)]'
                        : 'text-[var(--hf-accent-foreground)] opacity-65 hover:opacity-100'
                    )}
                  >
                    <StepIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <button
            type="button"
            onClick={onSkip}
            className="mt-4 self-start text-[11px] font-semibold underline underline-offset-4 opacity-75 transition-opacity hover:opacity-100"
          >
            Skip the tour
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-7">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--hf-text-muted)]">
              Step {index + 1} of {steps.length}
            </span>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full border border-[var(--hf-border-subtle)] px-3 py-1 text-[11px] font-semibold text-[var(--hf-text-secondary)] transition-colors hover:bg-[var(--hf-bg-elevated)] md:hidden"
            >
              Skip
            </button>
            <div className="hidden items-center gap-1 md:flex">
              {steps.map((item, itemIndex) => (
                <span
                  key={item.id}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    itemIndex === index
                      ? 'w-6 bg-[var(--hf-accent-default)]'
                      : 'w-1.5 bg-[var(--hf-border-subtle)]'
                  )}
                />
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7 sm:py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--hf-accent-subtle)] text-[var(--hf-accent-default)] shadow-[var(--hf-shadow-card)]">
              <Icon className="h-8 w-8" strokeWidth={1.5} />
            </div>
            <h2
              id="walkthrough-title"
              className="mt-5 text-2xl font-black tracking-tight text-[var(--hf-text-primary)] sm:text-3xl"
            >
              {step.title}
            </h2>
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-[var(--hf-text-secondary)]">
              {step.description}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--hf-border-subtle)] bg-[var(--hf-bg-elevated)] px-3 py-1.5 text-[11px] font-semibold text-[var(--hf-text-secondary)]">
              <Compass className="h-3.5 w-3.5 text-[var(--hf-accent-default)]" />
              {step.detail}
              <span className="text-[var(--hf-text-muted)]">· {step.href}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--hf-border-subtle)] px-5 py-4 sm:px-7">
            <button
              type="button"
              onClick={() => setIndex((current) => Math.max(0, current - 1))}
              disabled={index === 0}
              className="rounded-full border border-[var(--hf-border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--hf-text-secondary)] transition-colors hover:bg-[var(--hf-bg-elevated)] disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (isLast) onComplete()
                else setIndex((current) => current + 1)
              }}
              className="rounded-full bg-[var(--hf-accent-default)] px-5 py-2 text-xs font-bold text-[var(--hf-accent-foreground)] transition-opacity hover:opacity-90"
            >
              {isLast ? 'Get started' : 'Next feature'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
