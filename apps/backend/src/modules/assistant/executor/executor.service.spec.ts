import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AssistantExecutorService } from './executor.service';
import { hashArgs } from '../proposal/proposal.service';
import type { ToolContext } from '../tool.types';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: 'OWNER',
  businessType: 'DUKA',
  tier: 'SOLO',
  isImpersonated: false,
} as unknown as ToolContext;

function proposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop_1',
    organizationId: 'org_1',
    userId: 'user_1',
    tool: 'create_note',
    argsJson: JSON.stringify({ title: 'x' }),
    argsHash: hashArgs({ title: 'x' }),
    summary: 's',
    diffJson: null,
    riskLevel: 'low',
    status: 'APPROVED',
    idempotencyKey: 'idem',
    version: 1,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    decidedAt: new Date(),
    decidedBy: 'user_1',
    executedAt: null,
    resultJson: null,
    errorMessage: null,
    ...overrides,
  };
}

function build(options: {
  proposal?: Record<string, unknown> | null;
  commit?: jest.Mock;
} = {}) {
  const commit = options.commit ?? jest.fn(async () => ({ id: 'note_1' }));
  const tool = { name: 'create_note', kind: 'write', commit };
  const db = {
    assistantProposal: {
      findFirst: jest.fn(async () =>
        options.proposal === undefined ? proposalRow() : options.proposal,
      ),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...proposalRow(),
        ...data,
      })),
    },
  };
  const registry = { assertKnown: jest.fn(() => tool) };
  const policy = { assertToolAllowed: jest.fn(async () => undefined) };
  const audit = { record: jest.fn(async () => undefined) };
  const service = new AssistantExecutorService(
    { db } as never,
    registry as never,
    policy as never,
    audit as never,
  );
  return { service, db, registry, policy, audit, commit };
}

describe('AssistantExecutorService', () => {
  it('refuses to execute a proposal that is not approved', async () => {
    const { service, commit, audit } = build({
      proposal: proposalRow({ status: 'PROPOSED' }),
    });

    await expect(
      service.execute('org_1', CTX, 'prop_1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(commit).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('refuses to execute when the approved arguments were changed', async () => {
    const { service, commit } = build({
      proposal: proposalRow({ argsHash: 'tampered' }),
    });

    await expect(
      service.execute('org_1', CTX, 'prop_1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(commit).not.toHaveBeenCalled();
  });

  it('returns the stored result for an already-executed proposal (idempotent)', async () => {
    const { service, commit } = build({
      proposal: proposalRow({
        status: 'EXECUTED',
        resultJson: JSON.stringify({ id: 'note_1' }),
      }),
    });

    const result = await service.execute('org_1', CTX, 'prop_1');

    expect(result).toEqual({
      proposalId: 'prop_1',
      status: 'EXECUTED',
      result: { id: 'note_1' },
      idempotent: true,
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it('rejects a proposal outside the calling organization', async () => {
    const { service, commit } = build({ proposal: null });

    await expect(
      service.execute('org_1', CTX, 'prop_other_org'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(commit).not.toHaveBeenCalled();
  });

  it('executes an approved proposal through the tool commit and audits it', async () => {
    const { service, db, policy, audit, commit } = build();

    const result = await service.execute('org_1', CTX, 'prop_1');

    expect(policy.assertToolAllowed).toHaveBeenCalled();
    expect(commit).toHaveBeenCalledWith({ title: 'x' }, CTX);
    expect(db.assistantProposal.update).toHaveBeenCalledWith({
      where: { id: 'prop_1' },
      data: expect.objectContaining({ status: 'EXECUTED' }),
    });
    expect(result.idempotent).toBe(false);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'execute_start' }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'executed' }),
    );
  });

  it('marks a failing commit as FAILED and audits the failure', async () => {
    const commit = jest.fn(async () => {
      throw new Error('insufficient stock');
    });
    const { service, db, audit } = build({ commit });

    await expect(
      service.execute('org_1', CTX, 'prop_1'),
    ).rejects.toThrow('insufficient stock');
    expect(db.assistantProposal.update).toHaveBeenCalledWith({
      where: { id: 'prop_1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'insufficient stock',
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'execute_failed' }),
    );
  });
});
