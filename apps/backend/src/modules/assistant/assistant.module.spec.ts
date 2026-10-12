import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '../../config/config.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { EntitlementsModule } from '../../core/entitlements/entitlements.module';
import { AppRole } from '../../core/decorators/roles.decorator';
import { AssistantModule } from './assistant.module';
import { ToolRegistryService } from './registry/tool-registry.service';
import { ASSISTANT_TOOL_PROVIDERS } from './tool.types';
import type { AssistantToolProvider } from './tool.types';

/**
 * Guards the Phase E wiring: the registry aggregates every provider from the
 * `ASSISTANT_TOOL_PROVIDERS` token, and verticals are filtered at the registry
 * boundary. If a vertical provider stops being registered (or the token wiring
 * regresses), this fails before a deployment.
 *
 * Compiles the module graph only; no lifecycle hooks or database calls run.
 */
describe('AssistantModule wiring', () => {
  let ref: TestingModule;
  let registry: ToolRegistryService;

  const contextFor = (businessType: string) => ({
    organizationId: 'org_1',
    userId: 'user_1',
    role: AppRole.OWNER,
    businessType,
    tier: 'SOLO',
    isImpersonated: false,
  });

  beforeAll(async () => {
    ref = await Test.createTestingModule({
      imports: [
        ConfigModule,
        DatabaseModule,
        EntitlementsModule,
        AssistantModule,
      ],
    }).compile();
    registry = ref.get(ToolRegistryService);
  });

  it('registers the foundation, ISP and guest-house providers behind the token', () => {
    const providers = ref.get<AssistantToolProvider[]>(ASSISTANT_TOOL_PROVIDERS);
    expect(providers).toHaveLength(3);
  });

  it('offers only ISP tools to an ISP org', () => {
    const tools = registry.listFor(contextFor('ISP'));
    const names = tools.map((tool) => tool.name);
    expect(names).toContain('issue_equipment');
    expect(names).toContain('search_inventory');
    // Retail-only tools must not leak into an ISP org.
    expect(names).not.toContain('record_sale');
    expect(tools.filter((tool) => tool.verticals?.includes('ISP'))).toHaveLength(
      19,
    );
  });

  it('offers DUKA tools (and not ISP tools) to a retail org', () => {
    const names = registry.listFor(contextFor('DUKA')).map((tool) => tool.name);
    expect(names).toContain('record_sale');
    expect(names).not.toContain('issue_equipment');
    expect(names).not.toContain('create_booking');
  });

  it('offers guest-house tools only to a guest-house org', () => {
    const guestHouse = registry
      .listFor(contextFor('GUEST_HOUSE'))
      .map((tool) => tool.name);
    expect(guestHouse).toContain('create_booking');
    expect(guestHouse).toContain('add_consumption');
    expect(guestHouse).not.toContain('issue_equipment');
    expect(guestHouse).not.toContain('record_sale');
  });
});
