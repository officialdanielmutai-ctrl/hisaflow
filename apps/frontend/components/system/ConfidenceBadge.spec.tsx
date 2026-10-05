import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ConfidenceBadge from './ConfidenceBadge';

describe('ConfidenceBadge', () => {
  it('labels a high-confidence OCR read as correct', () => {
    render(<ConfidenceBadge level="high" />);

    expect(screen.getByText('Looks correct')).toBeInTheDocument();
  });

  it('asks for review on a medium-confidence read', () => {
    render(<ConfidenceBadge level="medium" />);

    expect(screen.getByText('Please review')).toBeInTheDocument();
  });

  it('flags a low-confidence read as needing attention', () => {
    render(<ConfidenceBadge level="low" />);

    expect(screen.getByText('Needs attention')).toBeInTheDocument();
  });
});
