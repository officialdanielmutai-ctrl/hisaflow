import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Package, Wallet } from 'lucide-react'
import {
  FeatureWalkthrough,
  buildWalkthroughSteps,
  type WalkthroughStep,
} from './FeatureWalkthrough'

const STEPS: WalkthroughStep[] = [
  {
    id: 'inventory',
    title: 'Know what you have',
    description: 'Inventory description',
    detail: 'Sidebar → Inventory',
    href: '/inventory',
    icon: Package,
  },
  {
    id: 'finance',
    title: 'Keep the money straight',
    description: 'Finance description',
    detail: 'Sidebar → Finance',
    href: '/finance',
    icon: Wallet,
  },
]

describe('FeatureWalkthrough', () => {
  it('moves through features and completes on the last step', () => {
    const onComplete = vi.fn()
    render(
      <FeatureWalkthrough
        open
        steps={STEPS}
        onSkip={vi.fn()}
        onComplete={onComplete}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Know what you have' })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next feature' }))
    expect(
      screen.getByRole('heading', { name: 'Keep the money straight' })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Get started' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('can be skipped without completing', () => {
    const onSkip = vi.fn()
    const onComplete = vi.fn()
    render(
      <FeatureWalkthrough
        open
        steps={STEPS}
        onSkip={onSkip}
        onComplete={onComplete}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('adapts the vertical step to the business type', () => {
    const isp = buildWalkthroughSteps('ISP')
    expect(isp.some((step) => step.title.includes('Subscribers'))).toBe(true)

    const guestHouse = buildWalkthroughSteps('GUEST_HOUSE')
    expect(guestHouse.some((step) => step.title.includes('Rooms'))).toBe(true)
  })
})
