import React from 'react';

interface HisaFlowMotifProps extends React.SVGProps<SVGSVGElement> {}

/**
 * HisaFlow Motif — 3 upward-right chevrons, perfectly diagonal.
 * Uses a base path at (0,0) scaled and translated so the math is flawless.
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

      {/* Chevron 1 (Smallest): Peak at (70, 330) */}
      <g transform="translate(70, 330) scale(0.6)">
        <use href="#chevron" stroke="#1F7A5A" strokeWidth="35" />
      </g>

      {/* Chevron 2 (Medium): Peak at (170, 230) */}
      <g transform="translate(170, 230) scale(0.8)">
        <use href="#chevron" stroke="#2E8B62" strokeWidth="30" />
      </g>

      {/* Chevron 3 (Largest): Peak at (270, 130) */}
      <g transform="translate(270, 130) scale(1.0)">
        <use href="#chevron" stroke="#52C48A" strokeWidth="26" />
      </g>
    </svg>
  );
}


