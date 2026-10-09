'use client';

import { useEffect, useState } from 'react';
import { Check, ScanBarcode, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type ScanPhase = 'scan' | 'capture' | 'processing' | 'result';

/**
 * The looping capture sequence for the Features section: the camera drifts over
 * a label, a shutter snaps, the AI reads the label, and the confirmed fields
 * land. Motion is CSS transform/opacity only and stops under reduced motion
 * (`hisaflow-landing-visual-spec.md` Section 6).
 */
const SEQUENCE: { phase: ScanPhase; duration: number }[] = [
  { phase: 'scan', duration: 2400 },
  { phase: 'capture', duration: 650 },
  { phase: 'processing', duration: 1700 },
  { phase: 'result', duration: 2600 },
];

const RESULT_FIELDS: [string, string][] = [
  ['Name', 'Unga 2kg'],
  ['Category', 'Flour'],
  ['Expiry', '12/2027'],
];

/** Coded product label standing in for photography (`visual-spec` 7.2). */
function ProductLabel() {
  return (
    <div className="relative w-[64%] max-w-[300px]">
      <div className="rounded-[var(--mk-r-inner)] border border-black/5 bg-[linear-gradient(160deg,#f7ecda,#e6d2b3)] p-5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1F7A5A] text-[10px] font-bold text-white">
            2KG
          </span>
          <div>
            <p className="text-[15px] font-bold tracking-tight text-[#3a2d1a]">
              UNGA
            </p>
            <p className="text-[10px] text-[#6b5a3e]">Maize flour</p>
          </div>
        </div>
        <div aria-hidden="true" className="mt-4 flex h-10 items-end gap-[3px]">
          {[6, 2, 8, 3, 10, 4, 7, 2, 9, 5, 3, 8, 2, 6, 4, 7, 3, 9, 2, 5].map(
            (width, index) => (
              <span
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                className="h-full rounded-[1px] bg-[#2b2317]"
                style={{ width: `${width}px` }}
              />
            ),
          )}
        </div>
        <p className="mt-1 font-mono text-[9px] tracking-[0.18em] text-[#6b5a3e]">
          6161100123456
        </p>
      </div>
    </div>
  );
}

export function FeatureScanAnimation() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setStep(SEQUENCE.length - 1);
      return;
    }
    const timer = window.setTimeout(() => {
      setStep((current) => (current + 1) % SEQUENCE.length);
    }, SEQUENCE[step].duration);
    return () => window.clearTimeout(timer);
  }, [step]);

  const phase = SEQUENCE[step].phase;
  const scanning = phase === 'scan';
  const capturing = phase === 'capture';
  const processing = phase === 'processing';
  const done = phase === 'result';

  return (
    <div className="relative min-h-[380px] overflow-hidden rounded-[var(--mk-r-card)] bg-[var(--mk-scan-bg)] md:min-h-[500px]">
      {/* Camera scene with a slow drift, as if framing the label. */}
      <div className="absolute inset-0">
        <div className="mk-camera-drift flex h-full w-full items-center justify-center bg-[radial-gradient(120%_100%_at_50%_0%,var(--mk-scan-bg-2)_0%,var(--mk-scan-bg)_58%,#05080a_100%)] p-8">
          <ProductLabel />
        </div>
      </div>

      {/* Focus brackets and a sweeping scan line while the camera is active. */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-500',
          scanning ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="absolute left-1/2 top-1/2 h-[58%] w-[72%] -translate-x-1/2 -translate-y-1/2">
          <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-[var(--mk-r-inner)] border-l-2 border-t-2 border-[var(--mk-accent)]" />
          <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-[var(--mk-r-inner)] border-r-2 border-t-2 border-[var(--mk-accent)]" />
          <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-[var(--mk-r-inner)] border-b-2 border-l-2 border-[var(--mk-accent)]" />
          <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-[var(--mk-r-inner)] border-b-2 border-r-2 border-[var(--mk-accent)]" />
          <span className="mk-scan-sweep absolute inset-0">
            <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-[var(--mk-accent)] shadow-[0_0_12px_2px_var(--mk-accent)]" />
          </span>
        </div>
        <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-[var(--mk-r-pill)] bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80">
          Align the label
        </span>
      </div>

      {/* Shutter: two blades close, a flash pops, then they withdraw. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      >
        <span
          className={cn(
            'absolute inset-x-0 top-0 h-1/2 bg-black transition-transform duration-200 ease-[var(--mk-ease)]',
            capturing ? 'translate-y-0' : '-translate-y-full',
          )}
        />
        <span
          className={cn(
            'absolute inset-x-0 bottom-0 h-1/2 bg-black transition-transform duration-200 ease-[var(--mk-ease)]',
            capturing ? 'translate-y-0' : 'translate-y-full',
          )}
        />
        <span
          className={cn(
            'absolute inset-0 bg-white transition-opacity duration-150',
            capturing ? 'opacity-30' : 'opacity-0',
          )}
        />
      </div>

      {/* AI reading state. */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-5 transition-opacity duration-300',
          processing ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="w-[250px] rounded-[var(--mk-r-card)] bg-[rgba(255,255,255,0.95)] p-5 shadow-[var(--mk-e2)]">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--mk-ink)]">
            <Sparkles
              className="h-4 w-4 text-[var(--mk-accent)]"
              strokeWidth={1.75}
            />
            AI reading label
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <span
                // eslint-disable-next-line react/no-array-index-key
                key={row}
                className="relative block h-2.5 overflow-hidden rounded-full bg-[var(--mk-line)]"
              >
                <span className="mk-shimmer absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.9),transparent)]" />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmed AI result. */}
      <div
        className={cn(
          'absolute inset-0 z-10 flex items-center justify-center p-5 transition-opacity duration-500',
          done ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div
          key={done ? 'shown' : 'hidden'}
          className={cn(
            'mk-float-panel w-[270px] rounded-[var(--mk-r-card)] bg-[var(--mk-surface)] p-5',
            done && 'mk-step-swap',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--mk-ink)]">
              <ScanBarcode className="h-4 w-4" strokeWidth={1.75} />
              Label scanned
            </span>
            <span className="inline-flex items-center gap-1 rounded-[var(--mk-r-pill)] bg-[var(--mk-accent)] px-2.5 py-1 text-[10px] font-semibold text-white">
              <Sparkles className="h-3 w-3" strokeWidth={2} />
              AI
            </span>
          </div>

          <ul className="mt-3 flex flex-col gap-2 text-[11px]">
            {RESULT_FIELDS.map(([label, value]) => (
              <li
                key={label}
                className="flex items-center justify-between gap-3 border-b border-[var(--mk-line)] pb-2 last:border-0 last:pb-0"
              >
                <span className="text-[var(--mk-ink-2)]">{label}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-[var(--mk-ink)]">
                  <Check
                    className="h-3 w-3 text-[var(--mk-accent)]"
                    strokeWidth={2.5}
                  />
                  {value}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3 rounded-[var(--mk-r-pill)] bg-[var(--mk-ink)] px-4 py-2 text-center text-[12px] font-semibold text-white">
            Add to stock
          </div>
        </div>
      </div>
    </div>
  );
}
