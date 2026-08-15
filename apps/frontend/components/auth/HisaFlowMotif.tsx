import React from 'react';

interface HisaFlowMotifProps extends React.SVGProps<SVGSVGElement> {}

export function HisaFlowMotif({ className, ...props }: HisaFlowMotifProps) {
  return (
    <svg
      viewBox="0 0 320 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <g transform="rotate(45 160 160) translate(40, -40)">
        {/* Smallest, back chevron */}
        <path
          d="M 60,220 L 160,120 L 260,220 L 220,260 L 160,200 L 100,260 Z"
          fill="#2E8B62"
        />
        {/* Medium, back chevron */}
        <path
          d="M 30,150 L 160,20 L 290,150 L 240,200 L 160,120 L 80,200 Z"
          fill="#2E8B62"
        />
        {/* Largest, front chevron */}
        <path
          d="M -10,80 L 160,-90 L 330,80 L 270,140 L 160,30 L 50,140 Z"
          fill="#52C48A"
        />
      </g>
    </svg>
  );
}
