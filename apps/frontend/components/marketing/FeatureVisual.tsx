import { ReceiptText, ScanBarcode, Sparkles, Tag } from 'lucide-react';

type FeatureVisualVariant = 'barcode' | 'label' | 'receipt';

/** Small coded UI crops for the AI and scanning feature tiles. */
export function FeatureVisual({ variant }: { variant: FeatureVisualVariant }) {
  if (variant === 'barcode') {
    return (
      <div className="rounded-[var(--mk-r-inner)] border border-[var(--mk-line)] p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--mk-ink-2)]">
          <ScanBarcode className="h-3 w-3" strokeWidth={1.5} />
          Barcode
        </div>
        <div className="mt-3 flex h-10 items-end gap-[3px]" aria-hidden="true">
          {[6, 2, 8, 3, 10, 4, 7, 2, 9, 5, 3, 8, 2, 6].map((width, index) => (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="h-full rounded-[1px] bg-[var(--mk-ink)]"
              style={{ width: `${width}px` }}
            />
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] tracking-[0.18em] text-[var(--mk-ink-2)]">
          6161100123456
        </p>
      </div>
    );
  }

  if (variant === 'label') {
    return (
      <div className="rounded-[var(--mk-r-inner)] border border-[var(--mk-line)] p-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--mk-ink-2)]">
            <Tag className="h-3 w-3" strokeWidth={1.5} />
            Label
          </span>
          <span className="inline-flex items-center gap-1 rounded-[var(--mk-r-pill)] bg-[rgba(255,90,31,0.12)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--mk-accent-warm-ink)]">
            <Sparkles className="h-2.5 w-2.5" />
            AI
          </span>
        </div>
        <ul className="mt-2 flex flex-col gap-1.5 text-[10px]">
          {[
            ['Name', 'Unga 2kg'],
            ['Category', 'Flour'],
            ['Expiry', '12/2027'],
          ].map(([label, value]) => (
            <li
              key={label}
              className="flex items-center justify-between gap-2 text-[var(--mk-ink-2)]"
            >
              <span>{label}</span>
              <span className="font-semibold text-[var(--mk-ink)]">
                {value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--mk-r-inner)] border border-[var(--mk-line)] p-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--mk-ink-2)]">
          <ReceiptText className="h-3 w-3" strokeWidth={1.5} />
          Receipt
        </span>
        <span className="inline-flex items-center gap-1 rounded-[var(--mk-r-pill)] bg-[rgba(255,90,31,0.12)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--mk-accent-warm-ink)]">
          <Sparkles className="h-2.5 w-2.5" />
          AI
        </span>
      </div>
      <ul className="mk-tabular mt-2 flex flex-col gap-1.5 text-[10px] text-[var(--mk-ink-2)]">
        <li className="flex justify-between gap-2">
          <span>Unga 2kg × 12</span>
          <span className="font-semibold text-[var(--mk-ink)]">KES 2,520</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Sugar 1kg × 10</span>
          <span className="font-semibold text-[var(--mk-ink)]">KES 1,600</span>
        </li>
        <li className="flex justify-between gap-2 border-t border-[var(--mk-line)] pt-1.5">
          <span>Total</span>
          <span className="font-semibold text-[var(--mk-ink)]">KES 4,120</span>
        </li>
      </ul>
    </div>
  );
}
