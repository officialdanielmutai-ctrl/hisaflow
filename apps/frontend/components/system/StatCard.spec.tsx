import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode, AnchorHTMLAttributes } from 'react';
import { Wallet } from 'lucide-react';

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

import { StatCard } from './StatCard';

describe('StatCard (shared building block)', () => {
  it('renders the filled slots and links when href is set', () => {
    render(
      <StatCard
        label="Monthly Revenue"
        sublabel="Recurring Invoicing"
        value="KES 48,350"
        valueSuffix="/ 120"
        fullValue="KES 1,200,000"
        footnote="KES 402 ARPU / active sub"
        icon={Wallet}
        cardTone="blue"
        href="/finance"
        trailing={{ kind: 'arrow' }}
      />,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/finance');
    expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
    expect(screen.getByText('Recurring Invoicing')).toBeInTheDocument();
    expect(screen.getByText('/ 120')).toBeInTheDocument();
    expect(screen.getByText('KES 402 ARPU / active sub')).toBeInTheDocument();
    expect(screen.getByTitle('KES 1,200,000')).toBeInTheDocument();
  });

  it('omits empty slots without leaving visible text', () => {
    render(
      <StatCard
        label="Support Queue"
        value="3"
        icon={Wallet}
        cardTone="neutral"
      />,
    );

    expect(screen.queryByText('Recurring Invoicing')).not.toBeInTheDocument();
    // The footnote row is reserved but empty, so it contributes no text.
    expect(screen.getByTestId('stat-card').textContent).toMatch(
      /Support Queue\s*3/,
    );
  });

  it('renders a skeleton with no value while loading', () => {
    render(
      <StatCard
        label="Monthly Revenue"
        value="KES 48,350"
        icon={Wallet}
        state="loading"
      />,
    );

    expect(screen.queryByText('KES 48,350')).not.toBeInTheDocument();
    expect(screen.getByTestId('stat-card')).toBeInTheDocument();
  });

  it('shows a dash and message on error', () => {
    render(
      <StatCard
        label="Monthly Revenue"
        value="KES 48,350"
        icon={Wallet}
        state="error"
        stateMessage="Could not load revenue."
      />,
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Could not load revenue.')).toBeInTheDocument();
  });

  it('renders a status badge in the trailing slot', () => {
    render(
      <StatCard
        label="Field Work & Dispatch"
        value="4"
        icon={Wallet}
        trailing={{ kind: 'badge', text: '4 Pending', tone: 'amber' }}
      />,
    );

    expect(screen.getByText('4 Pending')).toBeInTheDocument();
  });
});
