import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  AssistantMemoryService,
  CHAT_RETENTION_DAYS,
  HISTORY_MESSAGES,
  MAX_CONVERSATIONS_PER_USER,
} from './assistant-memory.service';

function build() {
  const db = {
    assistantConversation: {
      create: jest.fn(async (_args: { data: Record<string, unknown> }) => ({
        id: 'conv_1',
        title: 'Hello',
        createdAt: new Date('2026-10-01T00:00:00Z'),
        lastMessageAt: new Date('2026-10-01T00:00:00Z'),
      })),
      findFirst: jest.fn(async (): Promise<unknown> => null),
      findMany: jest.fn(async (_args?: unknown): Promise<unknown[]> => []),
      update: jest.fn(async () => ({})),
      deleteMany: jest.fn(
        async (_args: { where: Record<string, unknown> }) => ({ count: 0 }),
      ),
    },
    assistantMessage: {
      create: jest.fn(async () => ({})),
      findMany: jest.fn(async (): Promise<unknown[]> => []),
    },
    $transaction: jest.fn(async (operations: unknown[]) =>
      Promise.all(operations),
    ),
  };
  const service = new AssistantMemoryService({ db } as unknown as PrismaService);
  return { service, db };
}

describe('AssistantMemoryService', () => {
  it('starts a thread scoped to the org and user, trimming the title', async () => {
    const { service, db } = build();

    const conversation = await service.start('org_1', 'user_1', `  ${'x'.repeat(100)}  `);

    expect(conversation.id).toBe('conv_1');
    const [{ data }] = db.assistantConversation.create.mock.calls[0];
    expect(data).toMatchObject({ organizationId: 'org_1', userId: 'user_1' });
    expect((data.title as string).length).toBe(80);
  });

  it('returns null when a thread is outside the caller scope', async () => {
    const { service } = build();
    await expect(
      service.getScoped('org_1', 'user_1', 'conv_other'),
    ).resolves.toBeNull();
  });

  it('replays only this thread and org as model messages, oldest first', async () => {
    const { service, db } = build();
    db.assistantMessage.findMany.mockResolvedValueOnce([
      { role: 'assistant', content: 'Sure' },
      { role: 'user', content: 'How much sugar?' },
    ]);

    const history = await service.history('conv_1', 'org_1');

    expect(history).toEqual([
      { role: 'user', content: 'How much sugar?' },
      { role: 'assistant', content: 'Sure', toolCalls: [] },
    ]);
    expect(db.assistantMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 'conv_1', organizationId: 'org_1' },
        take: HISTORY_MESSAGES,
      }),
    );
  });

  it('persists a turn and touches the thread timestamp', async () => {
    const { service, db } = build();

    await service.append('conv_1', 'org_1', 'user_1', 'user', '  hello  ');

    expect(db.assistantMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv_1',
        organizationId: 'org_1',
        userId: 'user_1',
        role: 'user',
        content: 'hello',
      },
    });
    expect(db.assistantConversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_1' },
      data: { lastMessageAt: expect.any(Date) },
    });
  });

  it('does not persist an empty assistant reply', async () => {
    const { service, db } = build();
    await service.append('conv_1', 'org_1', 'user_1', 'assistant', '   ');
    expect(db.assistantMessage.create).not.toHaveBeenCalled();
  });

  it('prunes threads older than the retention window and beyond the cap', async () => {
    const { service, db } = build();
    db.assistantConversation.findMany.mockResolvedValueOnce([
      { id: 'stale_1' },
      { id: 'stale_2' },
    ]);

    await service.prune('org_1', 'user_1');

    const expiredWhere = db.assistantConversation.deleteMany.mock.calls[0][0];
    expect(expiredWhere).toMatchObject({
      where: { organizationId: 'org_1', userId: 'user_1' },
    });
    const window = expiredWhere.where.lastMessageAt as { lt: Date };
    const cutoff = window.lt;
    const expected = Date.now() - CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(5000);

    expect(db.assistantConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: MAX_CONVERSATIONS_PER_USER }),
    );
    expect(db.assistantConversation.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['stale_1', 'stale_2'] } },
    });
  });

  it('returns no messages for a thread outside the caller scope', async () => {
    const { service, db } = build();
    await expect(
      service.getMessages('org_1', 'user_1', 'conv_other'),
    ).resolves.toEqual([]);
    expect(db.assistantMessage.findMany).not.toHaveBeenCalled();
  });
});
