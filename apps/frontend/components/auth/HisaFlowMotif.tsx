import React from 'react';

interface HisaFlowMotifProps extends React.SVGProps<SVGSVGElement> {}

/**
 * HisaFlow Motif — fills the full brand zone (landscape).
 * viewBox 390×240 (matches typical phone width × ~40vh brand zone height).
 * Wordmark lives in the upper-LEFT of the zone (handled in AuthShell markup).
 * Chevrons live in the RIGHT HALF, stepping diagonally bottom→top.
 *
 * All three use identical angle (height = half-span, i.e. 45°):
 *
 *   #   Color    Peak         Left-base    Right-base   Stroke
 *   1   #1F7A5A  (275, 205)   (240, 240)   (310, 240)   18px  ← smallest, lowest
 *   2   #2E8B62  (325, 145)   (275, 195)   (375, 195)   20px  ← medium
 *   3   #52C48A  (380,  75)   (315, 140)   (445, 140)   22px  ← largest, bleeds right
 */
export function HisaFlowMotif({ className, ...props }: HisaFlowMotifProps) {
  return (
    <svg
      viewBox="0 0 390 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      overflow="visible"
      {...props}
    >
      {/* Chevron 1 — Smallest, lowest (darkest) */}
      <polyline
        points="240,240 275,205 310,240"
        stroke="#1F7A5A"
        strokeWidth="18"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        fill="none"
      />

      {/* Chevron 2 — Medium */}
      <polyline
        points="275,195 325,145 375,195"
        stroke="#2E8B62"
        strokeWidth="20"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        fill="none"
      />

      {/* Chevron 3 — Largest, top-right, bleeds off right edge */}
      <polyline
        points="315,140 380,75 445,140"
        stroke="#52C48A"
        strokeWidth="22"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        fill="none"
      />
    </svg>
  );
}


