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

  it('renders a blue info badge in the trailing slot', () => {
    render(
      <StatCard
        label="Occupied Rooms"
        value="8"
        icon={Wallet}
        trailing={{ kind: 'badge', text: '72%', tone: 'blue' }}
      />,
    );

    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  it('applies value and footnote emphasis slots without forking the card', () => {
    render(
      <StatCard
        label="Profit Est."
        value="KES -12,000"
        icon={Wallet}
        valueTone="critical"
        footnote="Down this month"
        footnoteTone="warning"
      />,
    );

    expect(screen.getByText('KES -12,000').className).toContain(
      'text-[var(--color-status-critical)]',
    );
    expect(screen.getByText('Down this month').className).toContain(
      'text-amber-600',
    );
  });

  it('renders the hero tone from theme tokens with contrast typography', () => {
    render(
      <StatCard
        label="Total Sales"
        value="KES 542,376"
        icon={Wallet}
        cardTone="hero"
      />,
    );

    const card = screen.getByTestId('stat-card');
    expect(card.className).toContain('bg-[var(--hf-accent-default)]');
    expect(card.className).toContain('text-[var(--hf-accent-foreground)]');
    expect(screen.getByText('Total Sales').className).toContain(
      'text-[var(--hf-accent-foreground)]',
    );
    expect(screen.getByText('KES 542,376').className).toContain(
      'text-[var(--hf-accent-foreground)]',
    );
  });

  it('renders delta comparison badge with upward arrow and period label', () => {
    render(
      <StatCard
        label="Today's Sales"
        value="KES 120,000"
        icon={Wallet}
        delta={{
          value: '+22%',
          period: 'vs last month',
          direction: 'up',
          tone: 'success',
        }}
      />,
    );

    expect(screen.getByText('+22%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('renders micro-visualizations (sparkline, gauge, and progress)', () => {
    const { container, rerender } = render(
      <StatCard
        label="Sales Velocity"
        value="KES 80,000"
        icon={Wallet}
        sparklineData={[10, 25, 40, 30, 60, 55, 90]}
      />,
    );

    expect(container.querySelector('svg')).toBeInTheDocument();

    rerender(
      <StatCard
        label="Occupancy Rate"
        value="84"
        icon={Wallet}
        gauge={{ value: 84, max: 100, label: 'Occupied' }}
      />,
    );
    expect(screen.getByText('Occupied')).toBeInTheDocument();

    rerender(
      <StatCard
        label="User Growth"
        value="205,890"
        icon={Wallet}
        progress={{ value: 65, max: 100, label: 'Checking totally', targetLabel: '+210 today' }}
      />,
    );
    expect(screen.getByText('Checking totally')).toBeInTheDocument();
    expect(screen.getByText('+210 today')).toBeInTheDocument();
  });

  it('renders in-card quick action button', () => {
    render(
      <StatCard
        label="Total Balance"
        value="KES 32,678"
        icon={Wallet}
        action={{ label: '+ Quick Sale', href: '/transactions?action=new' }}
      />,
    );

    const actionBtn = screen.getByText('+ Quick Sale');
    expect(actionBtn).toBeInTheDocument();
    expect(actionBtn.closest('a')).toHaveAttribute('href', '/transactions?action=new');
  });
});
