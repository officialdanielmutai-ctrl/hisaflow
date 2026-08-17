import React from 'react';

interface HisaFlowMotifProps extends React.SVGProps<SVGSVGElement> {}

/**
 * HisaFlow Motif — 3 upward-pointing chevrons arranged in a diagonal staircase.
 * Uses a base upward chevron scaled and translated to interlock perfectly.
 */
export function HisaFlowMotif({ className, ...props }: HisaFlowMotifProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      overflow="visible"
      {...props}
    >
      <defs>
        {/* Base Chevron: Peak is at (0,0). Points straight UP. */}
        {/* Left arm extends down and left (-100, +100). Right arm extends down and right (+100, +100). */}
        <path 
          id="chevron" 
          d="M -100,100 L 0,0 L 100,100" 
          fill="none" 
          strokeLinecap="square" 
          strokeLinejoin="miter" 
        />
      </defs>

      {/* Chevron 1 (Smallest, bottom-left) */}
      <g transform="translate(80, 320) scale(0.6)">
        <use href="#chevron" stroke="#1F7A5A" strokeWidth="35" />
      </g>

      {/* Chevron 2 (Medium, middle) */}
      <g transform="translate(160, 240) scale(0.8)">
        <use href="#chevron" stroke="#2E8B62" strokeWidth="30" />
      </g>

      {/* Chevron 3 (Largest, top-right) */}
      <g transform="translate(240, 160) scale(1.0)">
        <use href="#chevron" stroke="#52C48A" strokeWidth="26" />
      </g>
    </svg>
  );
}


