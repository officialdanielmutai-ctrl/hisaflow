import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: ReactNode
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { AiRecommendationsCard } from './AiRecommendationsCard'

describe('AiRecommendationsCard', () => {
  it('uses semantic theme surfaces and status tokens for every priority', () => {
    render(
      <AiRecommendationsCard
        recommendations={[
          {
            action: 'Resolve 12 open support tickets',
            reason: 'Open complaints increase subscriber churn.',
            priority: 'HIGH',
            href: '/tickets',
          },
          {
            action: 'Restock low inventory',
            reason: 'Three items are below their reorder point.',
            priority: 'MEDIUM',
            href: '/inventory',
          },
          {
            action: 'Review weekend rota',
            reason: 'Two shifts are still unfilled.',
            priority: 'LOW',
          },
        ]}
      />
    )

    const card = screen.getByTestId('ai-recommendations-card')
    expect(card.className).toContain(
      'bg-[var(--hf-status-success-surface)]'
    )
    expect(card.className).not.toContain('bg-[#F4FCF7]')

    expect(screen.getByText('HIGH').className).toContain(
      'text-[var(--hf-status-danger)]'
    )

    const mediumRow = screen
      .getByText('Restock low inventory')
      .closest('div.flex.items-start')
    const lowRow = screen
      .getByText('Review weekend rota')
      .closest('div.flex.items-start')

    expect(mediumRow?.querySelector('span')?.className).toContain(
      'bg-[var(--hf-status-warning)]'
    )
    expect(lowRow?.querySelector('span')?.className).toContain(
      'bg-[var(--hf-status-success)]'
    )
    expect(
      screen.getByText('Resolve 12 open support tickets')
    ).toBeInTheDocument()
  })
})
