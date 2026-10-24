import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DashboardGreeting } from './DashboardGreeting'

describe('DashboardGreeting', () => {
  it('renders only the cinematic greeting and name', () => {
    const { container } = render(
      <DashboardGreeting name="Amina" timeOfDay="morning" />
    )

    expect(
      screen.getByRole('heading', { name: 'Good morning, Amina' })
    ).toBeInTheDocument()
    expect(container.querySelector('.hf-greeting--morning')).not.toBeNull()
    expect(container.querySelector('.hf-greeting-orb')).not.toBeNull()
    expect(container.querySelector('.hf-greeting-cloud')).not.toBeNull()
    expect(screen.queryByText(/workspace/i)).not.toBeInTheDocument()
  })

  it('adds stars and a moon scene in the evening', () => {
    const { container } = render(
      <DashboardGreeting name="Amina" timeOfDay="evening" />
    )

    expect(container.querySelector('.hf-greeting--evening')).not.toBeNull()
    expect(container.querySelector('.hf-greeting-stars')).not.toBeNull()
    expect(container.querySelectorAll('.hf-greeting-stars i')).toHaveLength(8)
  })

  it('does not add evening stars in the afternoon', () => {
    const { container } = render(
      <DashboardGreeting name="Amina" timeOfDay="afternoon" />
    )
    expect(container.querySelector('.hf-greeting-stars')).toBeNull()
    expect(container.querySelector('.hf-greeting-birds')).toBeNull()
  })
})
