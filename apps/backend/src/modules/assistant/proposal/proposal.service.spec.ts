import { BadRequestException } from '@nestjs/common';
import {
  ProposalService,
  hashArgs,
  stableStringify,
} from './proposal.service';
import type { ProposalDraft, ToolContext, ToolDefinition } from '../tool.types';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: 'OWNER',
  businessType: 'DUKA',
  tier: 'SOLO',
  isImpersonated: false,
} as unknown as ToolContext;

const TOOL = {
  name: 'create_note',
  kind: 'write',
  riskLevel: 'low',
} as unknown as ToolDefinition;

function proposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop_1',
    organizationId: 'org_1',
    userId: 'user_1',
    tool: 'create_note',
    argsJson: '{"title":"x"}',
    argsHash: 'hash',
    summary: 's',
    diffJson: null,
    riskLevel: 'low',
    status: 'PROPOSED',
    idempotencyKey: 'idem',
    version: 1,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    decidedAt: null,
    decidedBy: null,
    executedAt: null,
    resultJson: null,
    errorMessage: null,
    ...overrides,
  };
}

function build() {
  const db = {
    assistantProposal: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...proposalRow(),
        ...data,
      })),
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => []),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...proposalRow(),
        ...data,
      })),
    },
  };
  const service = new ProposalService({ db } as never);
  return { service, db };
}

describe('stableStringify / hashArgs', () => {
  it('is deterministic regardless of key order', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
    expect(hashArgs({ b: 1, a: 2 })).toBe(hashArgs({ a: 2, b: 1 }));
  });

  it('changes when a value changes', () => {
    expect(hashArgs({ quantity: 2 })).not.toBe(hashArgs({ quantity: 3 }));
  });
});

describe('ProposalService', () => {
  it('stores the args JSON and their hash', async () => {
    const { service, db } = build();
    const draft: ProposalDraft = { args: { title: 'Restock' }, summary: 's' };

    await service.create(CTX, TOOL, draft);

    const [{ data }] = db.assistantProposal.create.mock.calls[0];
    expect(data.organizationId).toBe('org_1');
    expect(data.argsJson).toBe('{"title":"Restock"}');
    expect(data.argsHash).toBe(hashArgs({ title: 'Restock' }));
    expect(data.status).toBeUndefined(); // defaults to PROPOSED in the DB
  });

  it('scopes the lookup by organization', async () => {
    const { service, db } = build();

    await service.getScoped('org_1', 'prop_1');

    expect(db.assistantProposal.findFirst).toHaveBeenCalledWith({
      where: { id: 'prop_1', organizationId: 'org_1' },
    });
  });

  it('approves a proposed, unexpired proposal', async () => {
    const { service, db } = build();
    db.assistantProposal.findFirst.mockResolvedValue(
      proposalRow({ status: 'PROPOSED' }),
    );

    await service.approve('org_1', 'prop_1', 'user_1');

    expect(db.assistantProposal.update).toHaveBeenCalledWith({
      where: { id: 'prop_1' },
      data: expect.objectContaining({ status: 'APPROVED', decidedBy: 'user_1' }),
    });
  });

  it('refuses to approve an already-decided proposal', async () => {
    const { service, db } = build();
    db.assistantProposal.findFirst.mockResolvedValue(
      proposalRow({ status: 'EXECUTED' }),
    );

    await expect(
      service.approve('org_1', 'prop_1', 'user_1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('expires and refuses an expired proposal', async () => {
    const { service, db } = build();
    db.assistantProposal.findFirst.mockResolvedValue(
      proposalRow({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(
      service.approve('org_1', 'prop_1', 'user_1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.assistantProposal.update).toHaveBeenCalledWith({
      where: { id: 'prop_1' },
      data: { status: 'EXPIRED' },
    });
  });
});
