'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell,
  BedDouble,
  Briefcase,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
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
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WalkthroughStep {
  id: string
  title: string
  description: string
  detail: string
  href: string
  /** The visible feature to circle. Falls back to a content spotlight. */
  target: string
  icon: LucideIcon
}

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

const NAV = (href: string) => `[data-walkthrough-href="${href}"], main`

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
        target: NAV('/bookings'),
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
        target: NAV('/subscribers'),
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
        target: NAV('/students'),
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
        target: NAV('/table-orders'),
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
        target: NAV('/inventory'),
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
        target: NAV('/inventory'),
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
        target: NAV('/transactions'),
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
      target: NAV('/dashboard'),
      icon: LayoutDashboard,
    },
    {
      id: 'inventory',
      title: 'Know what you have',
      description:
        'Search stock, add items, scan barcodes and catch low stock before a customer asks.',
      detail: 'Sidebar → Inventory',
      href: '/inventory',
      target: NAV('/inventory'),
      icon: Package,
    },
    {
      id: 'sales',
      title: 'Record sales in seconds',
      description:
        'Take a sale, receive stock or make an adjustment. Every change lands in the ledger with an audit trail.',
      detail: 'Sidebar → Transactions',
      href: '/transactions',
      target: NAV('/transactions'),
      icon: ShoppingCart,
    },
    {
      id: 'finance',
      title: 'Keep the money straight',
      description:
        'See cash flow, profit, tax and outstanding credit without rebuilding a spreadsheet at month-end.',
      detail: 'Sidebar → Finance',
      href: '/finance',
      target: NAV('/finance'),
      icon: Wallet,
    },
    {
      id: 'assistant',
      title: 'Ask HisaFlow',
      description:
        'Describe a delivery or ask what to reorder. Try typing a question in the assistant below, then continue the tour.',
      detail: 'Sidebar → Assistant',
      href: '/assistant',
      target: '[data-walkthrough="assistant-input"], main',
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
      target: NAV('/alerts'),
      icon: Bell,
    },
    {
      id: 'customise',
      title: 'Make Home yours',
      description:
        'Use the CUSTOMISE HOME control to reorder, resize or restyle your Home cards. Your layout is saved.',
      detail: 'Home → CUSTOMISE HOME',
      href: '/dashboard',
      target: '[data-walkthrough="customise-home"], main',
      icon: CalendarCheck,
    },
  ]
}

function visibleTarget(selector: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(selector)
  )
  return (
    candidates.find((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }) ?? null
  )
}

function contentSpotlight(): SpotlightRect {
  const width = Math.min(window.innerWidth - 48, 760)
  const height = Math.min(window.innerHeight * 0.55, 460)
  return {
    left: Math.max(24, (window.innerWidth - width) / 2),
    top: Math.max(88, window.innerHeight * 0.16),
    width,
    height,
  }
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
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [assistantHasInput, setAssistantHasInput] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  const step = steps[Math.min(index, steps.length - 1)]
  const isLast = index === steps.length - 1
  const isAssistant = step?.id === 'assistant'

  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  // Navigate to the feature this step is introducing.
  useEffect(() => {
    if (!open || !step) return
    if (pathname !== step.href) router.push(step.href)
  }, [open, pathname, router, step])

  const measure = useCallback(() => {
    if (typeof window === 'undefined' || !step) return
    setViewport({ width: window.innerWidth, height: window.innerHeight })

    const target = visibleTarget(step.target)
    if (!target) {
      setRect(contentSpotlight())
      return
    }

    const targetRect = target.getBoundingClientRect()
    if (
      targetRect.top < 88 ||
      targetRect.bottom > window.innerHeight - 96
    ) {
      if (target.tagName !== 'MAIN') {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }

    const measured = target.getBoundingClientRect()
    if (measured.height > window.innerHeight * 0.8) {
      setRect(contentSpotlight())
      return
    }

    setRect({
      top: Math.max(8, measured.top - 6),
      left: Math.max(8, measured.left - 6),
      width: measured.width + 12,
      height: measured.height + 12,
    })
  }, [step])

  // Measure once the route has painted, and keep the ring aligned on scroll.
  useEffect(() => {
    if (!open || !step) return
    if (pathname !== step.href) {
      setRect(null)
      return
    }
    const timer = window.setTimeout(measure, 380)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure, open, pathname, step])

  // The AI step only unlocks once the user has actually typed a message.
  useEffect(() => {
    if (!open || !isAssistant) {
      setAssistantHasInput(false)
      return
    }
    let input: HTMLTextAreaElement | null = null
    const onInput = () => {
      setAssistantHasInput(Boolean(input?.value.trim()))
    }
    const attach = () => {
      input = document.querySelector<HTMLTextAreaElement>(
        '[data-walkthrough="assistant-input"]'
      )
      if (!input) return
      setAssistantHasInput(Boolean(input.value.trim()))
      input.addEventListener('input', onInput)
    }
    const timer = window.setTimeout(attach, 400)
    return () => {
      window.clearTimeout(timer)
      input?.removeEventListener('input', onInput)
    }
  }, [isAssistant, open, pathname])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    tooltipRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onSkip, index])

  const tooltipStyle = useMemo<CSSProperties>(() => {
    if (!rect || viewport.width === 0) return {}
    const width = Math.min(360, viewport.width - 32)

    if (viewport.width < 768) return {}

    const leftOnLeft = rect.left < viewport.width * 0.35
    const nearBottom = rect.top + rect.height > viewport.height - 170
    let left = rect.left + rect.width + 20
    let top = rect.top

    if (!leftOnLeft) {
      left = rect.left + rect.width / 2 - width / 2
    }
    if (nearBottom) {
      top = rect.top - 290
    }

    return {
      width,
      left: Math.min(
        Math.max(16, left),
        Math.max(16, viewport.width - width - 16)
      ),
      top: Math.min(
        Math.max(16, top),
        Math.max(16, viewport.height - 300)
      ),
    }
  }, [rect, viewport])

  if (
    !open ||
    !step ||
    steps.length === 0 ||
    typeof document === 'undefined'
  ) {
    return null
  }

  const Icon = step.icon
  const canContinue = !isAssistant || assistantHasInput

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[140]">
      <div className="pointer-events-none absolute inset-0 bg-black/10" />
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-[20px] border-2 border-[var(--hf-accent-default)] shadow-[0_0_0_9999px_rgba(0,0,0,0.55),0_0_30px_rgba(45,212,191,0.28)] transition-all duration-300"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        >
          <span className="absolute -inset-1 animate-pulse rounded-[24px] border border-[var(--hf-accent-default)]/50" />
        </div>
      )}

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="walkthrough-title"
        tabIndex={-1}
        className={cn(
          'pointer-events-auto fixed max-h-[76vh] overflow-y-auto rounded-[24px] border border-[var(--hf-border-subtle)] bg-[var(--hf-bg-surface)] p-5 shadow-[0_28px_80px_-20px_rgba(0,0,0,0.55)] outline-none sm:p-6',
          viewport.width < 768 || !rect
            ? 'inset-x-4 top-1/2 -translate-y-1/2'
            : ''
        )}
        style={viewport.width < 768 || !rect ? undefined : tooltipStyle}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--hf-text-muted)]">
            Step {index + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full p-1.5 text-[var(--hf-text-muted)] transition-colors hover:bg-[var(--hf-bg-elevated)] hover:text-[var(--hf-text-primary)]"
            aria-label="Skip walkthrough"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--hf-accent-subtle)] text-[var(--hf-accent-default)]">
          <Icon className="h-6 w-6" strokeWidth={1.6} />
        </div>
        <h2
          id="walkthrough-title"
          className="mt-4 text-xl font-black tracking-tight text-[var(--hf-text-primary)]"
        >
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--hf-text-secondary)]">
          {step.description}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--hf-border-subtle)] bg-[var(--hf-bg-elevated)] px-3 py-1.5 text-[10px] font-semibold text-[var(--hf-text-secondary)]">
          <Compass className="h-3.5 w-3.5 text-[var(--hf-accent-default)]" />
          {step.detail}
        </div>

        {isAssistant && (
          <p className="mt-4 rounded-xl border border-[var(--hf-accent-default)]/30 bg-[var(--hf-accent-subtle)] px-3 py-2 text-[11px] font-medium leading-relaxed text-[var(--hf-text-secondary)]">
            {assistantHasInput
              ? 'Nice. You can continue the tour now, or send the message to see the assistant respond.'
              : 'Try it: type a message in the assistant composer below. This step unlocks your next feature once you start typing.'}
          </p>
        )}

        <div className="mt-5 flex items-center gap-1.5">
          {steps.map((item, itemIndex) => (
            <span
              key={item.id}
              className={cn(
                'h-1.5 rounded-full transition-all',
                itemIndex === index
                  ? 'w-6 bg-[var(--hf-accent-default)]'
                  : itemIndex < index
                    ? 'w-1.5 bg-[var(--hf-accent-default)]/50'
                    : 'w-1.5 bg-[var(--hf-border-subtle)]'
              )}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--hf-border-subtle)] pt-4">
          <button
            type="button"
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
            disabled={index === 0}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--hf-border-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--hf-text-secondary)] transition-colors hover:bg-[var(--hf-bg-elevated)] disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full px-2 py-1.5 text-[11px] font-semibold text-[var(--hf-text-muted)] hover:text-[var(--hf-text-primary)]"
            >
              Skip tour
            </button>
            <button
              type="button"
              onClick={() => {
                if (isLast) onComplete()
                else setIndex((current) => current + 1)
              }}
              disabled={!canContinue}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--hf-accent-default)] px-4 py-1.5 text-[11px] font-bold text-[var(--hf-accent-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLast ? 'Finish tour' : 'Next feature'}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
