'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Package,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ProcessStep<T extends string> = { phase: T; duration: number }

function useProcess<T extends string>(
  sequence: readonly ProcessStep<T>[]
): T {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setIndex(sequence.length - 1)
      return
    }
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % sequence.length)
    }, sequence[index].duration)
    return () => window.clearTimeout(timer)
  }, [index, sequence])

  return sequence[index].phase
}

const STOCK_SEQUENCE: readonly ProcessStep<
  'receive' | 'scroll' | 'alert' | 'settle'
>[] = [
  { phase: 'receive', duration: 2400 },
  { phase: 'scroll', duration: 2200 },
  { phase: 'alert', duration: 3000 },
  { phase: 'settle', duration: 2000 },
]

const STOCK_ROWS = [
  { name: 'Cooking oil 1L', left: '1 left' },
  { name: 'Unga 2kg', left: '2 left' },
  { name: 'Sugar 1kg', left: '4 left' },
]

/** A short app walkthrough: receive stock, scroll, then see the low-stock alert. */
export function StockMedia() {
  const phase = useProcess(STOCK_SEQUENCE)
  const scrolled = phase !== 'receive'
  const alert = phase === 'alert' || phase === 'settle'
  const saved = phase !== 'receive'

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--color-bg-elevated)]">
      <div className="absolute inset-x-3 top-3 pb-4">
        <div
          className={cn(
            'transition-transform duration-[900ms] ease-[var(--mk-ease)]',
            scrolled ? '-translate-y-[118px]' : 'translate-y-0'
          )}
        >
          <div className="rounded-[var(--mk-r-sm)] bg-[var(--mk-surface)] p-3 shadow-[var(--mk-e1)]">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--mk-ink)]">
                <Package className="h-3.5 w-3.5 text-[var(--mk-accent)]" />
                Receive stock
              </p>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold transition-colors',
                  saved
                    ? 'bg-[rgba(31,107,61,0.12)] text-[var(--color-status-success)]'
                    : 'bg-[rgba(47,111,94,0.12)] text-[var(--mk-accent)]'
                )}
              >
                {saved ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                )}
                {saved ? 'Saved' : 'Saving'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-[var(--mk-r-sm)] bg-[var(--color-bg-elevated)] px-2.5 py-2">
              <span className="text-[11px] font-semibold text-[var(--mk-ink)]">
                Unga 2kg
              </span>
              <span className="mk-tabular text-[11px] font-bold text-[var(--mk-accent)]">
                +24 units
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--mk-line)]">
              <span
                className={cn(
                  'block h-full rounded-full bg-[var(--mk-accent)] transition-all duration-700',
                  saved ? 'w-full' : 'w-1/2 animate-pulse'
                )}
              />
            </div>
          </div>

          <div className="mt-3 rounded-[var(--mk-r-sm)] bg-[var(--mk-surface)] p-3 shadow-[var(--mk-e1)]">
            <p className="text-[10px] font-medium text-[var(--mk-ink-2)]">
              Today&apos;s sales
            </p>
            <p className="mk-tabular mt-0.5 text-[19px] font-bold text-[var(--mk-ink)]">
              KES 48,350
            </p>
          </div>

          <div className="mt-3 rounded-[var(--mk-r-sm)] bg-[var(--mk-surface)] p-3 shadow-[var(--mk-e1)]">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--color-status-warning)]">
                <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                Low stock
              </p>
              <span className="text-[9px] font-semibold text-[var(--mk-ink-2)]">
                3 items
              </span>
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-[11px] text-[var(--mk-ink-2)]">
              {STOCK_ROWS.map((item, index) => (
                <li
                  key={item.name}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-md px-2 py-1 transition-colors duration-500',
                    alert && index === 0
                      ? 'bg-[rgba(138,82,0,0.12)]'
                      : 'bg-transparent'
                  )}
                >
                  <span className="truncate">{item.name}</span>
                  <span className="mk-tabular shrink-0 font-semibold text-[var(--mk-ink)]">
                    {item.left}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center gap-1.5 text-[9px] font-semibold text-[var(--mk-ink-2)]">
              <Sparkles className="h-3 w-3 text-[var(--mk-accent)]" />
              HisaFlow flagged these before they ran out
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'absolute right-3 top-3 z-20 w-[178px] transition-all duration-500 ease-out',
          alert
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-3 opacity-0'
        )}
      >
        <div className="rounded-xl border border-[rgba(138,82,0,0.2)] bg-[var(--mk-surface)] p-2.5 shadow-[var(--mk-e2)]">
          <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-status-warning)]">
            <AlertTriangle className="h-3 w-3" />
            Low stock alert
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-snug text-[var(--mk-ink)]">
            Cooking oil 1L is down to 1
          </p>
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--color-status-warning)] px-2 py-0.5 text-[9px] font-bold text-white">
            <RefreshCw className="h-2.5 w-2.5" />
            Reorder now
          </span>
        </div>
      </div>

      <div
        className={cn(
          'absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-full bg-black/10 px-1.5 py-2 text-[var(--mk-ink-2)] transition-opacity duration-500',
          scrolled ? 'opacity-0' : 'opacity-100'
        )}
      >
        <ArrowDown className="h-3 w-3 animate-bounce" />
        <span className="text-[7px] font-bold uppercase tracking-widest">
          Scroll
        </span>
      </div>
    </div>
  )
}

const ADMIN_SEQUENCE: readonly ProcessStep<
  'checkin' | 'scroll' | 'notify' | 'settle'
>[] = [
  { phase: 'checkin', duration: 2400 },
  { phase: 'scroll', duration: 2200 },
  { phase: 'notify', duration: 3200 },
  { phase: 'settle', duration: 2000 },
]

const BOOKING_ROWS = [
  { room: 'Room 4', guest: 'Amina W.', state: 'Check-in', success: true },
  { room: 'Room 7', guest: 'Peter M.', state: 'Check-out', success: false },
  { room: 'Room 2', guest: 'Grace K.', state: '14:00', success: false },
]

const ROOM_NOTIFICATIONS = [
  {
    id: 'checkin',
    icon: CheckCircle2,
    title: 'Room 4 checked in',
    detail: 'Amina W. · balance settled',
    tone: 'success' as const,
  },
  {
    id: 'checkout',
    icon: CalendarDays,
    title: 'Room 7 check-out due',
    detail: 'Peter M. · 11:00 today',
    tone: 'warning' as const,
  },
  {
    id: 'booking',
    icon: BedDouble,
    title: 'New booking · Room 2',
    detail: 'Grace K. · 14:00 today',
    tone: 'info' as const,
  },
]

/** Front-desk flow: check a guest in, scroll the room list, then pull down the
 *  phone notification shade. The shade brings its own background down with the
 *  notifications, dims the app behind it, then retracts before the loop. */
export function AdminMedia() {
  const phase = useProcess(ADMIN_SEQUENCE)
  const scrolled = phase !== 'checkin'
  const shadeOpen = phase === 'notify'
  const checkedIn = scrolled

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#2d3748]">
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 z-10 bg-black/35 backdrop-blur-[1px] transition-opacity duration-500',
          shadeOpen ? 'opacity-100' : 'opacity-0'
        )}
      />

      <div
        className={cn(
          'absolute inset-x-3 top-3 pb-4 transition-all duration-700 ease-[var(--mk-ease)]',
          shadeOpen
            ? 'translate-y-4 scale-[0.985] opacity-50 blur-[1.5px]'
            : 'translate-y-0 scale-100 opacity-100 blur-0'
        )}
      >
        <div
          className={cn(
            'transition-transform duration-[900ms] ease-[var(--mk-ease)]',
            scrolled ? '-translate-y-[112px]' : 'translate-y-0'
          )}
        >
          <div className="rounded-[var(--mk-r-sm)] bg-white/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold text-white/85">
                <BedDouble className="h-3.5 w-3.5" />
                Front desk
              </p>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[9px] font-semibold transition-colors',
                  checkedIn
                    ? 'bg-[rgba(82,196,138,0.18)] text-[#9ff0c6]'
                    : 'bg-white/10 text-white/75'
                )}
              >
                {checkedIn ? 'Checked in' : 'Checking in…'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-[var(--mk-r-sm)] bg-white/10 px-2.5 py-2">
              <div>
                <p className="text-[11px] font-semibold text-white">
                  Room 4 · Amina W.
                </p>
                <p className="text-[9px] text-white/60">2 nights · paid</p>
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold transition-colors',
                  checkedIn
                    ? 'bg-[#7ee2b8] text-[#12352a]'
                    : 'bg-white/15 text-white/80'
                )}
              >
                {checkedIn ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                )}
                {checkedIn ? 'Done' : 'Check in'}
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-[var(--mk-r-sm)] bg-white/10 p-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold text-white/85">
                <CalendarDays className="h-3 w-3" />
                Today
              </p>
              <span className="text-[9px] text-white/55">3 rooms</span>
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-[11px] text-white/70">
              {BOOKING_ROWS.map((row, index) => (
                <li
                  key={row.room}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-md px-2 py-1 transition-colors duration-500',
                    checkedIn && index === 0
                      ? 'bg-white/15 text-white'
                      : 'bg-transparent'
                  )}
                >
                  <span className="truncate">
                    {row.room} · {row.guest}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 font-semibold',
                      row.success && checkedIn
                        ? 'text-[#7ee2b8]'
                        : 'text-white/65'
                    )}
                  >
                    {row.success && checkedIn ? 'Paid' : row.state}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 rounded-[var(--mk-r-sm)] bg-white/10 p-3">
            <p className="text-[10px] font-medium text-white/70">
              Occupied rooms
            </p>
            <p className="mk-tabular mt-0.5 text-[19px] font-bold text-white">
              {checkedIn ? '9 / 12' : '8 / 12'}
            </p>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        data-testid="room-notification-shade"
        data-shade={shadeOpen ? 'open' : 'closed'}
        className={cn(
          'absolute inset-0 z-30 flex flex-col overflow-hidden rounded-b-[24px] border-b border-white/10 bg-[#0c151b]/95 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-transform duration-700 ease-[var(--mk-ease)]',
          shadeOpen ? 'translate-y-0' : '-translate-y-full'
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(126,226,184,0.12),transparent_55%)]" />
        <div className="relative flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        <div className="relative px-3 pb-3 pt-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/45">
              Notifications
            </p>
            <p className="text-[8px] text-white/35">Today · 3</p>
          </div>
          <div className="mt-1.5 flex flex-col gap-1">
            {ROOM_NOTIFICATIONS.map((notification, index) => {
              const Icon = notification.icon
              return (
                <div
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-2 rounded-xl border border-white/10 p-2 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.8)] transition-all duration-300',
                    notification.tone === 'success'
                      ? 'bg-[#173b31]'
                      : notification.tone === 'warning'
                        ? 'bg-[#3d2f17]'
                        : 'bg-[#1a3048]',
                    shadeOpen
                      ? 'translate-y-0 opacity-100'
                      : 'translate-y-2 opacity-0'
                  )}
                  style={{ transitionDelay: `${index * 110}ms` }}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      notification.tone === 'success'
                        ? 'bg-[#7ee2b8] text-[#12352a]'
                        : notification.tone === 'warning'
                          ? 'bg-[#f0c36a] text-[#3d2b06]'
                          : 'bg-[#8ec5ff] text-[#10263d]'
                    )}
                  >
                    <Icon className="h-3 w-3" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-semibold text-white">
                      {notification.title}
                    </p>
                    <p className="truncate text-[9px] text-white/65">
                      {notification.detail}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="relative mt-auto flex flex-col items-center gap-1 pb-4 text-white/35">
          <span className="h-1 w-8 rounded-full bg-white/20" />
          <span className="text-[8px] font-semibold uppercase tracking-[0.16em]">
            Swipe up to return
          </span>
        </div>
      </div>

      <div
        className={cn(
          'absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-full bg-black/20 px-1.5 py-2 text-white/60 transition-opacity duration-500',
          scrolled || shadeOpen ? 'opacity-0' : 'opacity-100'
        )}
      >
        <ArrowDown className="h-3 w-3 animate-bounce" />
        <span className="text-[7px] font-bold uppercase tracking-widest">
          Scroll
        </span>
      </div>
    </div>
  )
}
