import React from 'react';

interface HisaFlowMotifProps extends React.SVGProps<SVGSVGElement> {}

export function HisaFlowMotif({ className, ...props }: HisaFlowMotifProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      preserveAspectRatio="xMaxYMin meet"
      {...props}
    >
      <g strokeLinecap="square" strokeLinejoin="miter">
        <g transform="rotate(45 100 100) translate(20, -20)">
          {/* Back chevron 1 (Smallest, bottom left) */}
          <polyline
            points="50,180 100,130 150,180"
            stroke="#2E8B62"
            strokeWidth="28"
          />
          {/* Back chevron 2 (Medium, middle) */}
          <polyline
            points="20,130 100,50 180,130"
            stroke="#2E8B62"
            strokeWidth="28"
          />
          {/* Front chevron 3 (Largest, top right) */}
          <polyline
            points="-20,70 100,-50 220,70"
            stroke="#52C48A"
            strokeWidth="28"
          />
        </g>
      </g>
    </svg>
  );
}
