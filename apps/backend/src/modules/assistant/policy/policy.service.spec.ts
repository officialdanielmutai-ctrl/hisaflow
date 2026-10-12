import { ForbiddenException } from '@nestjs/common';
import { TierFeature } from '../../../core/entitlements/entitlements.constant';
import { AppRole } from '../../../core/decorators/roles.decorator';
import { AssistantPolicyService } from './policy.service';
import type { ToolContext, ToolDefinition } from '../tool.types';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: AppRole.OWNER,
  businessType: 'DUKA',
  tier: 'SOLO',
  isImpersonated: false,
} satisfies ToolContext;

function tool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'tool',
    description: '',
    kind: 'read',
    riskLevel: 'low',
    parameters: {},
    ...overrides,
  };
}

function build() {
  const flags = { assertEnabled: jest.fn(async (_key: string) => undefined) };
  const entitlements = { assertFeatures: jest.fn(async () => undefined) };
  const service = new AssistantPolicyService(
    flags as never,
    entitlements as never,
  );
  return { service, flags, entitlements };
}

describe('AssistantPolicyService', () => {
  it('maps each tool kind to its own flag', async () => {
    const { service, flags } = build();

    await service.assertToolAllowed(tool({ kind: 'read' }), CTX);
    await service.assertToolAllowed(tool({ kind: 'utility' }), CTX);
    await service.assertToolAllowed(tool({ kind: 'write' }), CTX);
    await service.assertToolAllowed(tool({ kind: 'communicate' }), CTX);

    expect(flags.assertEnabled.mock.calls.map((call) => call[0])).toEqual([
      'assistant.read',
      'assistant.read',
      'assistant.write',
      'assistant.communicate',
    ]);
  });

  it('denies writes in read-only impersonation without consulting flags', async () => {
    const { service, flags } = build();

    await expect(
      service.assertToolAllowed(
        tool({ kind: 'write' }),
        { ...CTX, isImpersonated: true },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(flags.assertEnabled).not.toHaveBeenCalled();
  });

  it('allows reads in read-only impersonation', async () => {
    const { service } = build();

    await expect(
      service.assertToolAllowed(
        tool({ kind: 'read' }),
        { ...CTX, isImpersonated: true },
      ),
    ).resolves.toBeUndefined();
  });

  it('denies tools outside the org business type', async () => {
    const { service, flags } = build();

    await expect(
      service.assertToolAllowed(tool({ verticals: ['ISP'] }), CTX),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(flags.assertEnabled).not.toHaveBeenCalled();
  });

  it('denies tools outside the user role', async () => {
    const { service } = build();

    await expect(
      service.assertToolAllowed(tool({ roles: [AppRole.OWNER] }), {
        ...CTX,
        role: AppRole.STAFF,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces the tier feature gate before flags', async () => {
    const { service, entitlements } = build();

    await service.assertToolAllowed(
      tool({ feature: TierFeature.InventoryBasics }),
      CTX,
    );

    expect(entitlements.assertFeatures).toHaveBeenCalledWith('org_1', [
      TierFeature.InventoryBasics,
    ]);
  });

  it('propagates a disabled flag as a denial', async () => {
    const { service, flags } = build();
    flags.assertEnabled.mockRejectedValueOnce(
      new ForbiddenException('assistant.write not enabled'),
    );

    await expect(
      service.assertToolAllowed(tool({ kind: 'write' }), CTX),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('filters out tools that fail policy (used to shape the model tool list)', async () => {
    const { service, flags } = build();
    flags.assertEnabled.mockImplementation(async (key: string) => {
      if (key === 'assistant.write') {
        throw new ForbiddenException('assistant.write not enabled');
      }
    });

    const allowed = await service.filterTools(
      [tool({ name: 'read-tool', kind: 'read' }), tool({ name: 'write-tool', kind: 'write' })],
      CTX,
    );

    expect(allowed.map((entry) => entry.name)).toEqual(['read-tool']);
  });
});
