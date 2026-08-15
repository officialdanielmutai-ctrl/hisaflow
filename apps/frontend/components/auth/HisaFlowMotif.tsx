import React from 'react';

interface HisaFlowMotifProps extends React.SVGProps<SVGSVGElement> {}

/**
 * HisaFlow Motif — 3 upward-pointing chevrons arranged in a diagonal staircase
 * from bottom-left to top-right, each one larger and higher than the last.
 *
 * Geometry (all same angle, tan = height/half-span = 35/42 ≈ 0.83):
 *
 *   Chevron  | Peak       | Left       | Right      | Stroke
 *   ---------|------------|------------|------------|-------
 *   1 (sm)   | (55, 175)  | (13, 210)  | (97, 210)  | 18px  #1F7A5A
 *   2 (md)   | (120, 115) | (58, 167)  | (182, 167) | 20px  #2E8B62
 *   3 (lg)   | (195, 45)  | (111, 115) | (279, 115) | 22px  #52C48A  ← bleeds right
 *
 * Container: 240×240, anchored absolute top-right, overflow-visible lets C3 bleed.
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
      {/* Chevron 1 — Smallest, bottom-left of motif */}
      <polyline
        points="13,210 55,175 97,210"
        stroke="#1F7A5A"
        strokeWidth="18"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        fill="none"
      />

      {/* Chevron 2 — Medium, middle of motif */}
      <polyline
        points="58,167 120,115 182,167"
        stroke="#2E8B62"
        strokeWidth="20"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        fill="none"
      />

      {/* Chevron 3 — Largest, top-right, bleeds off edge */}
      <polyline
        points="111,115 195,45 279,115"
        stroke="#52C48A"
        strokeWidth="22"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        fill="none"
      />
    </svg>
  );
}

