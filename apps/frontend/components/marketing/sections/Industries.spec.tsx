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

import { Industries } from './Industries';
import { INDUSTRIES } from '@/features/marketing/config/content';

describe('Industries carousel', () => {
  it('shows 01 /4 and advances to the next industry', () => {
    render(<Industries />);

    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText(/\/4/)).toBeInTheDocument();
    expect(screen.getByText(INDUSTRIES[0].outcome)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next industry/i }));

    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText(INDUSTRIES[1].outcome)).toBeInTheDocument();
    expect(screen.queryByText(INDUSTRIES[0].outcome)).not.toBeInTheDocument();
  });

  it('cannot move before the first or past the last industry', () => {
    render(<Industries />);

    const next = () => screen.getByRole('button', { name: /next industry/i });
    expect(
      screen.getByRole('button', { name: /previous industry/i }),
    ).toBeDisabled();

    fireEvent.click(next());
    fireEvent.click(next());
    fireEvent.click(next());

    expect(next()).toBeDisabled();
    expect(screen.getByText('04')).toBeInTheDocument();
    expect(screen.getByText(INDUSTRIES[3].outcome)).toBeInTheDocument();
  });

  it('selects a vertical from the interlaced icon stack', () => {
    render(<Industries />);

    fireEvent.click(
      screen.getByRole('button', { name: `Show ${INDUSTRIES[2].name}` }),
    );

    expect(screen.getByText('03')).toBeInTheDocument();
    expect(screen.getByText(INDUSTRIES[2].outcome)).toBeInTheDocument();
  });
});
