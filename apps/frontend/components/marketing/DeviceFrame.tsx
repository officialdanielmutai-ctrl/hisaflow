import type { CSSProperties, ReactNode } from 'react';
import { BatteryFull, Signal, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeviceFrameProps {
  children: ReactNode;
  /** Extra classes for the outer wrapper (width/size live here). */
  className?: string;
}

/** Bottom of the casing and screen dissolve into the canvas (Section 4.13). */
const BOTTOM_FADE =
  'linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)';

const maskStyle: CSSProperties = {
  WebkitMaskImage: BOTTOM_FADE,
  maskImage: BOTTOM_FADE,
};

/**
 * A realistic device frame built in CSS (Section 4.13).
 *
 * The body faces slightly right so the shiny left edge is visible. Inside out:
 * a thick black body with a soft diffuse shadow and a metallic side rail; an
 * inner metallic/grey stroke for the hardware bezel; the screen container
 * (scroll-clipped, large radius) with a status bar, the app image below the
 * cutout, and a centred black pill dynamic island; and a masked bottom fade.
 */
export function DeviceFrame({ children, className }: DeviceFrameProps) {
  return (
    <div className={cn('relative', className)} style={maskStyle}>
      <div className="relative rounded-[52px] bg-[var(--mk-ink)] p-[13px] [transform:perspective(1700px)_rotateY(14deg)] [transform-style:preserve-3d]">
        {/* Flush metal glint on the visible edge (no protruding rail, which
            read as the back of the phone and reversed its orientation). */}
        <span
          aria-hidden="true"
          className="absolute inset-y-[34px] left-[2px] w-[3px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.85)_0%,rgba(190,196,203,0.45)_45%,rgba(100,106,113,0.2)_100%)] opacity-70"
        />

        {/* Inner metallic/grey stroke simulating the hardware bezel */}
        <div className="rounded-[42px] border border-[#4b4e56] p-[3px]">
          {/* Screen container: image clips to the rounded inner corners */}
          <div className="relative aspect-[437/782] overflow-hidden rounded-[38px] bg-[var(--mk-surface)]">
            {/* Status bar sits above the app content so the cutout never disrupts it */}
            <div className="absolute inset-x-0 top-0 z-20 flex h-[36px] items-center justify-between px-5 text-[10px] font-semibold text-[var(--mk-ink)]">
              <span className="mk-tabular">9:41</span>
              <span aria-hidden="true" className="flex items-center gap-1">
                <Signal className="h-3 w-3" strokeWidth={2} />
                <Wifi className="h-3 w-3" strokeWidth={2} />
                <BatteryFull className="h-3.5 w-3.5" strokeWidth={1.75} />
              </span>
            </div>

            {/* App image starts below the status bar */}
            <div className="absolute inset-x-0 bottom-0 top-[36px]">
              {children}
            </div>

            {/* Camera / sensor cutout */}
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-[7px] z-30 h-[22px] w-[78px] -translate-x-1/2 rounded-[var(--mk-r-pill)] bg-black"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
