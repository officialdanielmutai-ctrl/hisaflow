import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssistantMessageText } from './AssistantMessageText';

describe('AssistantMessageText', () => {
  it('renders natural prose and lists instead of raw markdown', () => {
    render(
      <AssistantMessageText
        text={'**Sales were up.**\n\n- Sold 3 unga\n- Sold 2 sugar'}
      />,
    );

    expect(screen.getByText('Sales were up.')).toBeInTheDocument();
    expect(screen.getByText('Sold 3 unga')).toBeInTheDocument();
    expect(screen.getByText('Sold 2 sugar')).toBeInTheDocument();
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it('turns a JSON code fence into readable labelled values', () => {
    render(<AssistantMessageText text={'```json\n{"revenue":1200}\n```'} />);

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.queryByText(/```/)).not.toBeInTheDocument();
    expect(screen.queryByText(/[{}]/)).not.toBeInTheDocument();
  });

  it('renders inline code as readable text, not a code block', () => {
    render(<AssistantMessageText text={'Sell **unga** at `KES 120`.'} />);

    expect(screen.getByText('unga').tagName).toBe('STRONG');
    expect(screen.getByText('KES 120').tagName).toBe('SPAN');
    expect(screen.queryByText(/`/)).not.toBeInTheDocument();
  });

  it('renders a markdown table as a readable list, not raw pipes', () => {
    render(
      <AssistantMessageText
        text={'| Item | Sales |\n| --- | --- |\n| Sugar | 850 |'}
      />,
    );

    expect(screen.getByText('Item · Sales')).toBeInTheDocument();
    expect(screen.getByText('Sugar · 850')).toBeInTheDocument();
    expect(screen.queryByText(/\|/)).not.toBeInTheDocument();
  });

  it('ignores horizontal rules and blockquote markers', () => {
    render(
      <AssistantMessageText
        text={'---\n> Sales improved this week.\n\nThat is good news.'}
      />,
    );

    expect(
      screen.getByText('Sales improved this week.'),
    ).toBeInTheDocument();
    expect(screen.getByText('That is good news.')).toBeInTheDocument();
    expect(screen.queryByText('---')).not.toBeInTheDocument();
    expect(screen.queryByText(/^>/)).not.toBeInTheDocument();
  });
});
