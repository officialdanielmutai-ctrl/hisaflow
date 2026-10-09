import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode, AnchorHTMLAttributes } from 'react';

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

import { FloatingNav } from './FloatingNav';

describe('FloatingNav mobile menu', () => {
  it('toggles the menu with correct ARIA and closes on Escape', () => {
    render(<FloatingNav />);

    const open = screen.getByRole('button', { name: /open menu/i });
    expect(open).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(open);
    const close = screen.getByRole('button', { name: /close menu/i });
    expect(close).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.getByRole('button', { name: /open menu/i }),
    ).toHaveAttribute('aria-expanded', 'false');
  });
});
