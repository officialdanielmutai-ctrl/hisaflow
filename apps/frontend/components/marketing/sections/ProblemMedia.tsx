import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'

const STOCK_ROWS = [
  { name: 'Cooking oil 1L', left: '1 left' },
  { name: 'Unga 2kg', left: '2 left' },
  { name: 'Sugar 1kg', left: '4 left' },
]

/** Low-stock tile with a looping scan + live-update sequence. */
export function StockMedia() {
  return (
    <div className="relative flex h-full w-full flex-col gap-3 overflow-hidden bg-[var(--color-bg-elevated)] p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      >
        <span className="mk-process-scan absolute inset-x-2 top-0 h-14 rounded-full bg-[linear-gradient(180deg,transparent,rgba(47,111,94,0.08),rgba(47,111,94,0.34),transparent)] motion-reduce:hidden" />
      </div>

      <div className="relative rounded-[var(--mk-r-sm)] bg-[var(--mk-surface)] p-4 shadow-[var(--mk-e1)]">
        <p className="text-[10px] font-medium text-[var(--mk-ink-2)]">
          Today&apos;s sales
        </p>
        <p className="mk-tabular mt-0.5 text-[20px] font-bold text-[var(--mk-ink)]">
          KES 48,350
        </p>
        <span className="mk-process-toast absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[rgba(31,107,61,0.12)] px-2 py-1 text-[9px] font-semibold text-[var(--color-status-success)] motion-reduce:hidden">
          <CheckCircle2 className="h-3 w-3" strokeWidth={2.2} />
          M-Pesa matched
        </span>
      </div>

      <div className="relative rounded-[var(--mk-r-sm)] bg-[var(--mk-surface)] p-4 shadow-[var(--mk-e1)]">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--color-status-warning)]">
            <AlertTriangle className="h-3 w-3" strokeWidth={2} />
            Low stock
          </p>
          <span
            className="mk-process-toast inline-flex items-center gap-1 rounded-full bg-[rgba(138,82,0,0.12)] px-2 py-0.5 text-[9px] font-semibold text-[var(--color-status-warning)] motion-reduce:hidden"
            style={{ animationDelay: '2.5s' }}
          >
            <RefreshCw className="h-3 w-3" strokeWidth={2} />
            Auto-reorder
          </span>
        </div>
        <ul className="mt-2 flex flex-col gap-1 text-[11px] text-[var(--mk-ink-2)]">
          {STOCK_ROWS.map((item, index) => (
            <li
              key={item.name}
              className="mk-process-row relative flex items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-1 motion-reduce:animate-none"
              style={{ animationDelay: `${index * 0.45}s` }}
            >
              <span className="truncate">{item.name}</span>
              <span className="mk-tabular shrink-0 font-semibold text-[var(--mk-ink)]">
                {item.left}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const BOOKING_ROWS = [
  { label: 'Room 4 · check-in', meta: 'Paid', success: true },
  { label: 'Room 7 · check-out', meta: '11:00', success: false },
  { label: 'Room 2 · booking', meta: '14:00', success: false },
]

/** Booking tile with the same scanning treatment and staggered row signals. */
export function AdminMedia() {
  return (
    <div className="relative flex h-full w-full flex-col gap-3 overflow-hidden bg-[#2d3748] p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      >
        <span className="mk-process-scan absolute inset-x-2 top-0 h-16 rounded-full bg-[linear-gradient(180deg,transparent,rgba(82,196,138,0.08),rgba(82,196,138,0.32),transparent)] motion-reduce:hidden" />
      </div>

      <div className="relative rounded-[var(--mk-r-sm)] bg-white/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-white/85">
            <CalendarDays className="h-3 w-3" strokeWidth={1.5} />
            Today
          </p>
          <span
            className="mk-process-toast inline-flex items-center gap-1 rounded-full bg-[rgba(82,196,138,0.18)] px-2 py-0.5 text-[9px] font-semibold text-[#9ff0c6] motion-reduce:hidden"
            style={{ animationDelay: '1.1s' }}
          >
            <CheckCircle2 className="h-3 w-3" strokeWidth={2.2} />
            Check-in confirmed
          </span>
        </div>
        <ul className="mt-2 flex flex-col gap-1 text-[11px] text-white/70">
          {BOOKING_ROWS.map((row, index) => (
            <li
              key={row.label}
              className="mk-process-row-dark relative flex items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-1 motion-reduce:animate-none"
              style={{ animationDelay: `${index * 0.45}s` }}
            >
              <span className="truncate">{row.label}</span>
              <span
                className={
                  row.success
                    ? 'mk-process-pill font-semibold text-[#7ee2b8] motion-reduce:animate-none'
                    : 'shrink-0'
                }
              >
                {row.meta}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative rounded-[var(--mk-r-sm)] bg-white/10 p-4">
        <p className="text-[10px] font-medium text-white/70">Occupied rooms</p>
        <p className="mk-tabular mt-0.5 text-[20px] font-bold text-white">
          8 / 12
        </p>
        <span
          className="mk-process-pill absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-[rgba(82,196,138,0.18)] px-2 py-0.5 text-[9px] font-semibold text-[#9ff0c6] motion-reduce:animate-none"
          style={{ animationDelay: '2.1s' }}
        >
          <RefreshCw className="h-3 w-3" strokeWidth={2} />
          Synced
        </span>
      </div>
    </div>
  )
}
