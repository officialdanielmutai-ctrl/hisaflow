import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SnapCarousel } from './SnapCarousel';

beforeAll(() => {
  // jsdom does not implement scrollTo.
  Element.prototype.scrollTo = vi.fn();
});

const items = [
  <div key="a">One</div>,
  <div key="b">Two</div>,
  <div key="c">Three</div>,
];

describe('SnapCarousel counter', () => {
  it('shows 01 /3 and advances the counter with the next button', () => {
    render(<SnapCarousel ariaLabel="Industries" items={items} />);

    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText(/\/3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next item/i }));
    expect(screen.getByText('02')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next item/i }));
    expect(screen.getByText('03')).toBeInTheDocument();

    // At the last item the next control is disabled.
    expect(screen.getByRole('button', { name: /next item/i })).toBeDisabled();
  });

  it('cannot move before the first item', () => {
    render(<SnapCarousel ariaLabel="Industries" items={items} />);

    expect(
      screen.getByRole('button', { name: /previous item/i }),
    ).toBeDisabled();
  });
});
