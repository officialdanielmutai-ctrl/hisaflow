import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { PenUnderline } from './PenUnderline'

describe('PenUnderline', () => {
  it('renders two decorative pen strokes around the word', () => {
    const { container } = render(<PenUnderline>hassle</PenUnderline>)

    expect(container.textContent).toContain('hassle')
    expect(container.querySelectorAll('svg path')).toHaveLength(2)
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
  })
})
