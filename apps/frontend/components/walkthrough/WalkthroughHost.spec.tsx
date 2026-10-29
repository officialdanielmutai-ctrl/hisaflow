import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WALKTHROUGH_START_EVENT, walkthroughSeenKey } from '@/lib/walkthrough'

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: { id: 'user_1' }, isLoaded: true }),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

vi.mock('@/hooks/useMyOrganization', () => ({
  useMyOrganization: () => ({ loading: false }),
}))

vi.mock('@/hooks/useRole', () => ({
  useRole: () => ({ businessType: 'DUKA' }),
}))

vi.mock('./FeatureWalkthrough', () => ({
  buildWalkthroughSteps: () => [],
  FeatureWalkthrough: ({
    open,
    onComplete,
  }: {
    open: boolean
    onComplete: () => void
  }) =>
    open ? (
      <button type="button" onClick={onComplete}>
        Finish walkthrough
      </button>
    ) : null,
}))

import { WalkthroughHost } from './WalkthroughHost'

describe('WalkthroughHost', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-plays once per user and remembers completion', async () => {
    const first = render(<WalkthroughHost />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900)
    })
    expect(screen.getByText('Finish walkthrough')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Finish walkthrough'))
    expect(window.localStorage.getItem(walkthroughSeenKey('user_1'))).toBe(
      'true'
    )

    first.unmount()
    render(<WalkthroughHost />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900)
    })
    expect(screen.queryByText('Finish walkthrough')).not.toBeInTheDocument()
  })

  it('replays when Settings requests it', () => {
    window.localStorage.setItem(walkthroughSeenKey('user_1'), 'true')
    render(<WalkthroughHost />)

    act(() => {
      window.dispatchEvent(new Event(WALKTHROUGH_START_EVENT))
    })
    expect(screen.getByText('Finish walkthrough')).toBeInTheDocument()
  })
})
