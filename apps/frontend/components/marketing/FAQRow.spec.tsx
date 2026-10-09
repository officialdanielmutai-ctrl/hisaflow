import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FAQRow } from './FAQRow';

describe('FAQRow', () => {
  it('is collapsed by default and exposes correct ARIA state', () => {
    render(
      <FAQRow
        question="Do I need a card to start?"
        answer="No. You get a 14-day free trial with no card required."
      />,
    );

    const button = screen.getByRole('button', {
      name: /do i need a card to start\?/i,
    });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('answers on click and collapses again on a second click', () => {
    render(
      <FAQRow
        question="Can I add staff?"
        answer="Yes. The Team plan includes three staff logins."
      />,
    );

    const button = screen.getByRole('button', { name: /can i add staff\?/i });

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(/the team plan includes three staff logins/i),
    ).toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
