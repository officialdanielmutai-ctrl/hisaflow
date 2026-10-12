import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnsupportedIntentsCard } from './UnsupportedIntentsCard';

describe('UnsupportedIntentsCard', () => {
  it('renders nothing when there are no intents', () => {
    const { container } = render(<UnsupportedIntentsCard intents={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists captured intents with a count', () => {
    render(
      <UnsupportedIntentsCard
        intents={[
          {
            id: 'u1',
            intent: 'file my KRA return',
            createdAt: '2026-10-12T10:00:00.000Z',
          },
          {
            id: 'u2',
            intent: 'suspend subscriber 4471',
            createdAt: '2026-10-12T11:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('Unsupported requests (2)')).toBeInTheDocument();
    expect(screen.getByText('file my KRA return')).toBeInTheDocument();
    expect(screen.getByText('suspend subscriber 4471')).toBeInTheDocument();
  });
});
