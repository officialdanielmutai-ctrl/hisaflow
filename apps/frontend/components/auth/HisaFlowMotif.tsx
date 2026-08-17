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
        {/* Base Chevron: Peak is at (0,0). Points top-right. */}
        {/* Left arm extends left (-100). Bottom arm extends down (+100). */}
        <path 
          id="chevron" 
          d="M -100,0 L 0,0 L 0,100" 
          fill="none" 
          strokeLinecap="square" 
          strokeLinejoin="miter" 
        />
      </defs>

      {/* Chevron 1 (Smallest): Peak at (20, 380) */}
      <g transform="translate(20, 380) scale(0.6)">
        <use href="#chevron" stroke="#1F7A5A" strokeWidth="35" />
      </g>

      {/* Chevron 2 (Medium): Peak at (120, 280) */}
      <g transform="translate(120, 280) scale(0.8)">
        <use href="#chevron" stroke="#2E8B62" strokeWidth="30" />
      </g>

      {/* Chevron 3 (Largest): Brought closer to Chevron 2 (Peak at 180, 220) */}
      <g transform="translate(180, 220) scale(1.0)">
        <use href="#chevron" stroke="#52C48A" strokeWidth="26" />
      </g>
    </svg>
  );
}


