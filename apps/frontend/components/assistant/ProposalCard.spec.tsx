import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode, AnchorHTMLAttributes } from 'react';
import type { AssistantProposal } from '@/services/assistant.service';
import { ProposalCard } from './ProposalCard';

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
    tool: 'record_sale',
    summary: 'Record a sale of 3 kg of Maize flour',
    args: { itemId: 'i1', quantity: 3 },
    diff: { item: 'Maize flour', quantity: { before: 20, after: 17 } },
    riskLevel: 'medium',
    status: 'PROPOSED',
    version: 1,
    createdAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    decidedAt: null,
    ...overrides,
  };
}

describe('ProposalCard', () => {
  it('shows the summary, status and before/after diff', () => {
    render(<ProposalCard proposal={proposal()} />);

    expect(screen.getByText('Record sale')).toBeInTheDocument();
    expect(screen.getByText('Proposed')).toBeInTheDocument();
    expect(
      screen.getByText('Record a sale of 3 kg of Maize flour'),
    ).toBeInTheDocument();
    expect(screen.getByText('quantity')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText(/not applied until you approve/i)).toBeInTheDocument();
  });

  it('calls onApprove with the id', () => {
    const onApprove = vi.fn();
    render(<ProposalCard proposal={proposal()} onApprove={onApprove} />);

    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    expect(onApprove).toHaveBeenCalledWith('p1');
  });

  it('requires a second tap for high-risk actions', () => {
    const onApprove = vi.fn();
    render(
      <ProposalCard
        proposal={proposal({ riskLevel: 'high' })}
        onApprove={onApprove}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));
    expect(onApprove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /tap again to approve/i }));
    expect(onApprove).toHaveBeenCalledWith('p1');
  });

  it('offers Apply for an approved proposal and Retry for a failed one', () => {
    const onExecute = vi.fn();
    const { rerender } = render(
      <ProposalCard
        proposal={proposal({ status: 'APPROVED' })}
        onExecute={onExecute}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(onExecute).toHaveBeenCalledWith('p1');

    rerender(
      <ProposalCard
        proposal={proposal({ status: 'FAILED' })}
        onExecute={onExecute}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onExecute).toHaveBeenCalledTimes(2);
  });

  it('shows an applied result and no undo affordance', () => {
    render(
      <ProposalCard
        proposal={proposal({ status: 'EXECUTED' })}
        result="Applied successfully."
      />,
    );

    expect(screen.getByText('Applied successfully.')).toBeInTheDocument();
    expect(screen.getByText(/undo is not available/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /view in transactions/i }),
    ).toHaveAttribute('href', '/transactions');
    expect(
      screen.queryByRole('button', { name: /approve/i }),
    ).not.toBeInTheDocument();
  });

  it('links an executed note proposal to the Notes page', () => {
    render(
      <ProposalCard
        proposal={proposal({ tool: 'create_note', status: 'EXECUTED' })}
      />,
    );

    expect(
      screen.getByRole('link', { name: /view in notes/i }),
    ).toHaveAttribute('href', '/notes');
  });

  it('edits scalar and nested args and saves coerced values', () => {
    const onEdit = vi.fn();
    render(
      <ProposalCard
        proposal={proposal({
          tool: 'update_inventory_item',
          args: { itemId: 'i1', updates: { sellingPrice: 150 } },
          diff: { before: { sellingPrice: 120 }, after: { sellingPrice: 150 } },
        })}
        onEdit={onEdit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText('updates.sellingPrice'), {
      target: { value: '175' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(onEdit).toHaveBeenCalledWith('p1', {
      itemId: 'i1',
      updates: { sellingPrice: 175 },
    });
  });
});
