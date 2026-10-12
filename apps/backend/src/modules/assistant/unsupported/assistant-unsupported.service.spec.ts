import { AssistantUnsupportedService } from './assistant-unsupported.service';

function build() {
  const db = {
    unsupportedIntent: {
      create: jest.fn(async (_args: { data: Record<string, unknown> }) => ({})),
      findMany: jest.fn(async () => []),
    },
  };
  const service = new AssistantUnsupportedService({ db } as never);
  return { service, db };
}

describe('AssistantUnsupportedService', () => {
  it('redacts identifiers before storing the intent', async () => {
    const { service, db } = build();

    const result = await service.record(
      'org_1',
      'user_1',
      'email the customer at jane@example.com or 0712345678',
    );

    expect(result).toEqual({ recorded: true });
    const [{ data }] = db.unsupportedIntent.create.mock.calls[0];
    expect(data).toMatchObject({
      organizationId: 'org_1',
      userId: 'user_1',
      intent: 'email the customer at [email] or [phone]',
    });
  });

  it('does not store an empty intent', async () => {
    const { service, db } = build();

    await expect(service.record('org_1', 'user_1', '   ')).resolves.toEqual({
      recorded: false,
    });
    expect(db.unsupportedIntent.create).not.toHaveBeenCalled();
  });

  it('lists intents scoped to the organization', async () => {
    const { service, db } = build();

    await service.list('org_1', 200);

    expect(db.unsupportedIntent.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org_1' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });
});
