import { BadRequestException } from '@nestjs/common';
import { ToolRegistryService } from './tool-registry.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import type { ToolContext, ToolDefinition } from '../tool.types';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: AppRole.OWNER,
  businessType: 'DUKA',
  tier: 'SOLO',
  isImpersonated: false,
} satisfies ToolContext;

function tool(name: string, overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name,
    description: `${name} desc`,
    kind: 'read',
    riskLevel: 'low',
    parameters: { type: 'object' },
    ...overrides,
  };
}

function build(tools: ToolDefinition[]) {
  return new ToolRegistryService({ all: () => tools } as never);
}

describe('ToolRegistryService', () => {
  it('resolves known tools and rejects unknown ones', () => {
    const registry = build([tool('a')]);
    expect(registry.get('a')?.name).toBe('a');
    expect(registry.assertKnown('a').name).toBe('a');
    expect(() => registry.assertKnown('missing')).toThrow(BadRequestException);
  });

  it('filters by vertical, role and impersonation', () => {
    const registry = build([
      tool('all'),
      tool('duka-only', { verticals: ['DUKA'] }),
      tool('isp-only', { verticals: ['ISP'] }),
      tool('owner-only', { roles: [AppRole.OWNER] }),
      tool('write', { kind: 'write' }),
    ]);

    const dukaOwner = registry.listFor(CTX).map((item) => item.name);
    expect(dukaOwner).toEqual(['all', 'duka-only', 'owner-only', 'write']);

    const staff = registry
      .listFor({ ...CTX, role: AppRole.STAFF })
      .map((item) => item.name);
    expect(staff).not.toContain('owner-only');

    const impersonated = registry
      .listFor({ ...CTX, isImpersonated: true })
      .map((item) => item.name);
    expect(impersonated).not.toContain('write');
  });

  it('exposes only name/description/parameters to the model', () => {
    const registry = build([tool('a', { roles: [AppRole.OWNER] })]);
    const [schema] = registry.toSchemas(registry.list());
    expect(Object.keys(schema).sort()).toEqual([
      'description',
      'name',
      'parameters',
    ]);
  });
});
