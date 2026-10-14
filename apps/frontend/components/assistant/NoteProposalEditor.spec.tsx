import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode, AnchorHTMLAttributes } from 'react';
import type { AssistantProposal } from '@/services/assistant.service';
import { NoteProposalEditor } from './NoteProposalEditor';

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

function proposal(
  overrides: Partial<AssistantProposal> = {},
): AssistantProposal {
  return {
    id: 'p1',
    tool: 'create_note',
    summary: 'Create a MEDIUM note: “Call the plumber”',
    args: {
      title: 'Call the plumber',
      content: 'Ask about the leak\nBefore Friday',
      importance: 'HIGH',
    },
    diff: {
      before: null,
      after: {
        title: 'Call the plumber',
        content: 'Ask about the leak\nBefore Friday',
        importance: 'HIGH',
      },
    },
    riskLevel: 'low',
    status: 'PROPOSED',
    version: 1,
    createdAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    decidedAt: null,
    ...overrides,
  };
}

describe('NoteProposalEditor', () => {
  it('prefills the note panel from the assistant draft', () => {
    render(<NoteProposalEditor proposal={proposal()} onSave={vi.fn()} />);

    expect(screen.getByText('New note')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Call the plumber')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(/Ask about the leak/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nothing is saved until you press save note/i),
    ).toBeInTheDocument();
  });

  it('saves the prefilled draft through the governed path', () => {
    const onSave = vi.fn();
    render(<NoteProposalEditor proposal={proposal()} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: /save note/i }));

    expect(onSave).toHaveBeenCalledWith('p1', {
      title: 'Call the plumber',
      content: 'Ask about the leak\nBefore Friday',
      importance: 'HIGH',
      dueDate: undefined,
    });
  });

  it('sends the edited title when the user changes it', () => {
    const onSave = vi.fn();
    render(<NoteProposalEditor proposal={proposal()} onSave={onSave} />);

    fireEvent.change(screen.getByDisplayValue('Call the plumber'), {
      target: { value: 'Call the electrician' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save note/i }));

    expect(onSave).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ title: 'Call the electrician' }),
    );
  });

  it('does not allow saving an empty title', () => {
    render(<NoteProposalEditor proposal={proposal()} onSave={vi.fn()} />);

    fireEvent.change(screen.getByDisplayValue('Call the plumber'), {
      target: { value: '   ' },
    });

    expect(screen.getByRole('button', { name: /save note/i })).toBeDisabled();
  });

  it('discards the draft', () => {
    const onDiscard = vi.fn();
    render(
      <NoteProposalEditor
        proposal={proposal()}
        onSave={vi.fn()}
        onDiscard={onDiscard}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(onDiscard).toHaveBeenCalledWith('p1');
  });

  it('shows a saved state with a link to Notes', () => {
    render(
      <NoteProposalEditor
        proposal={proposal({ status: 'EXECUTED' })}
        onSave={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /save note/i })).toBeNull();
    expect(screen.getByText('Saved.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view in notes/i })).toHaveAttribute(
      'href',
      '/notes',
    );
  });
});
