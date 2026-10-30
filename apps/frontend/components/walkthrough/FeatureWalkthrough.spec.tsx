import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Package, Wallet } from 'lucide-react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/inventory',
}))

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
    target: '[data-walkthrough-href="/inventory"], main',
    icon: Package,
  },
  {
    id: 'finance',
    title: 'Keep the money straight',
    description: 'Finance description',
    detail: 'Sidebar → Finance',
    href: '/finance',
    target: '[data-walkthrough-href="/finance"], main',
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

    fireEvent.click(screen.getByRole('button', { name: 'Finish tour' }))
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

    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('unlocks the AI step only after the user types a message', async () => {
    vi.useFakeTimers()
    const aiStep: WalkthroughStep = {
      id: 'assistant',
      title: 'Ask HisaFlow',
      description: 'Try the assistant',
      detail: 'Sidebar → Assistant',
      href: '/inventory',
      target: '[data-walkthrough="assistant-input"]',
      icon: Package,
    }

    render(
      <>
        <textarea
          data-walkthrough="assistant-input"
          aria-label="Assistant message"
        />
        <FeatureWalkthrough
          open
          steps={[aiStep, STEPS[1]]}
          onSkip={vi.fn()}
          onComplete={vi.fn()}
        />
      </>
    )

    const next = screen.getByRole('button', { name: /Next feature/ })
    expect(next).toBeDisabled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    fireEvent.input(screen.getByLabelText('Assistant message'), {
      target: { value: 'What should I reorder?' },
    })
    expect(next).toBeEnabled()

    // Sending the message clears the composer. The step stays unlocked so the
    // user is never trapped on the AI slide after using it.
    fireEvent.input(screen.getByLabelText('Assistant message'), {
      target: { value: '' },
    })
    expect(next).toBeEnabled()
    vi.useRealTimers()
  })

  it('targets a specific page region for every feature slide', () => {
    const steps = buildWalkthroughSteps('GUEST_HOUSE')

    for (const step of steps) {
      expect(step.target).toContain('data-walkthrough')
      expect(step.target).not.toContain('data-walkthrough-href')
    }

    expect(steps.find((step) => step.id === 'sales')?.target).toBe(
      '[data-walkthrough="feature-sales"], main'
    )
    expect(steps.find((step) => step.id === 'assistant')?.target).toBe(
      '[data-walkthrough="assistant-composer"], [data-walkthrough="assistant-input"], main'
    )
  })

  it('prefers the nested page anchor over the main fallback', async () => {
    vi.useFakeTimers()
    const rect = (
      top: number,
      left: number,
      width: number,
      height: number
    ): DOMRect => ({
      top,
      left,
      width,
      height,
      x: left,
      y: top,
      right: left + width,
      bottom: top + height,
      toJSON: () => ({}),
    })
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.testid === 'feature-anchor') {
          return rect(100, 100, 400, 80)
        }
        if (this.tagName === 'MAIN') return rect(0, 0, 1000, 700)
        return rect(0, 0, 0, 0)
      })

    try {
      const step: WalkthroughStep = {
        id: 'sales',
        title: 'Record sales',
        description: 'Sales description',
        detail: 'Sidebar → Transactions',
        href: '/inventory',
        target: '[data-walkthrough="feature-sales"], main',
        icon: Package,
      }

      render(
        <>
          <main>
            <div data-testid="feature-anchor" data-walkthrough="feature-sales">
              Sales
            </div>
          </main>
          <FeatureWalkthrough
            open
            steps={[step]}
            onSkip={vi.fn()}
            onComplete={vi.fn()}
          />
        </>
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })

      const spotlight = screen.getByTestId('walkthrough-spotlight')
      expect(spotlight).toHaveStyle({
        top: '94px',
        left: '94px',
        width: '412px',
        height: '92px',
      })
    } finally {
      spy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('adapts the vertical step to the business type', () => {
    const isp = buildWalkthroughSteps('ISP')
    expect(isp.some((step) => step.title.includes('Subscribers'))).toBe(true)

    const guestHouse = buildWalkthroughSteps('GUEST_HOUSE')
    expect(guestHouse.some((step) => step.title.includes('Rooms'))).toBe(true)
  })
})
