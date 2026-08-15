import React from 'react';

interface HisaFlowMotifProps extends React.SVGProps<SVGSVGElement> {}

/**
 * HisaFlow Motif — 3 upward chevrons.
 * viewBox is 240×240. Container is anchored top-right, overflowing to bleed.
 * Smallest chevron is most inward, largest bleeds off the top-right corner.
 * No group rotation — each chevron is positioned by its own points.
 *
 *   /\   /\   /\
 *  sm  md  lg  →  bleeding off top-right
 */
export function HisaFlowMotif({ className, ...props }: HisaFlowMotifProps) {
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      overflow="visible"
      {...props}
    >
      {/* Chevron 1 — Smallest, most inward (darkest green) */}
      <polyline
        points="60,190 110,130 160,190"
        stroke="#1F7A5A"
        strokeWidth="22"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        fill="none"
      />

      {/* Chevron 2 — Medium (mid green) */}
      <polyline
        points="100,155 160,85 220,155"
        stroke="#2E8B62"
        strokeWidth="22"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        fill="none"
      />

      {/* Chevron 3 — Largest, bleeds top-right (mint) */}
      <polyline
        points="145,115 215,35 285,115"
        stroke="#52C48A"
        strokeWidth="22"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        fill="none"
      />
    </svg>
  );
}

