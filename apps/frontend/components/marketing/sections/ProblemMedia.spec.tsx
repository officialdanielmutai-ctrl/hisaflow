import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminMedia } from './ProblemMedia'

describe('AdminMedia notification shade', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pulls a full-width shade down with the notifications and retracts it', async () => {
    render(<AdminMedia />)

    const shade = screen.getByTestId('room-notification-shade')
    expect(shade).toHaveAttribute('data-shade', 'closed')
    expect(shade.className).toContain('-translate-y-full')
    expect(shade.className).toContain('inset-0')
    expect(shade.className).toContain('bg-[#0c151b]/95')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2400)
    })
    expect(shade).toHaveAttribute('data-shade', 'closed')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200)
    })
    expect(shade).toHaveAttribute('data-shade', 'open')
    expect(shade.className).toContain('translate-y-0')
    expect(screen.getByText('Room 4 checked in')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3200)
    })
    expect(shade).toHaveAttribute('data-shade', 'closed')
  })
})
