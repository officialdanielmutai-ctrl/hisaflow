import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode, AnchorHTMLAttributes } from 'react';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}));

import { HowItWorks } from './HowItWorks';
import { HOW_IT_WORKS } from '@/features/marketing/config/content';

describe('HowItWorks list rows', () => {
  it('activates a row and reveals its true sub-badges', () => {
    render(<HowItWorks />);

    const step = HOW_IT_WORKS.steps[1];
    const row = screen.getByRole('button', {
      name: new RegExp(step.title, 'i'),
    });

    expect(row).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(row);

    expect(row).toHaveAttribute('aria-expanded', 'true');
    for (const chip of step.chips) {
      expect(screen.getAllByText(chip).length).toBeGreaterThan(0);
    }
  });

  it('implements the real onboarding steps in order', () => {
    render(<HowItWorks />);

    for (const step of HOW_IT_WORKS.steps) {
      expect(
        screen.getByRole('button', { name: new RegExp(step.title, 'i') }),
      ).toBeInTheDocument();
    }
  });
});
