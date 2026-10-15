import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/services/assistant.service', () => ({
  sendAssistantMessage: vi.fn(async () => ({
    reply: 'Your biggest leak is uncollected invoices (KES 25,000).',
    toolCalls: [],
    proposals: [],
    capped: false,
    conversationId: 'conv_1',
  })),
}));

import { sendAssistantMessage } from '@/services/assistant.service';
import { FinanceAskBox } from './FinanceAskBox';

describe('FinanceAskBox', () => {
  it('offers prompt suggestions and shows the assistant answer', async () => {
    render(<FinanceAskBox orgId="org_1" getToken={async () => 'token'} />);

    expect(screen.getByText('Where is my money leaking?')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Ask a question about your business…');
    fireEvent.change(input, { target: { value: 'Where is my money leaking?' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await waitFor(() =>
      expect(
        screen.getByText('Your biggest leak is uncollected invoices (KES 25,000).'),
      ).toBeInTheDocument(),
    );
    expect(sendAssistantMessage).toHaveBeenCalledWith(
      'Where is my money leaking?',
      'token',
      'org_1',
      undefined,
    );
  });
});
