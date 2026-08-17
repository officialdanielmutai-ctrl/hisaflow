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

      {/* Chevron 1 (Smallest) */}
      <g transform="translate(20, 360) scale(0.6)">
        <use href="#chevron" stroke="#3DAB76" strokeWidth="35" />
      </g>

      {/* Chevron 2 (Medium) */}
      <g transform="translate(120, 260) scale(0.8)">
        <use href="#chevron" stroke="#2E8B62" strokeWidth="30" />
      </g>

      {/* Chevron 3 (Largest) */}
      <g transform="translate(230, 150) scale(1.0)">
        <use href="#chevron" stroke="#52C48A" strokeWidth="26" />
      </g>
    </svg>
  );
}


