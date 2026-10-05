import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminAuditService } from '../audit/admin-audit.service';
import { ProvidersService } from './providers.service';

const adminUser = { id: 'adm_1', name: 'Admin One' } as any;
const realFetch = globalThis.fetch;

function build() {
  const configService = {
    get: jest.fn(() => undefined),
  };
  const auditService = { write: jest.fn(async () => ({})) };
  const service = new ProvidersService(
    configService as unknown as ConfigService,
    auditService as unknown as AdminAuditService,
  );
  return { service, configService, auditService };
}

describe('ProvidersService', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  describe('listProviders', () => {
    it('maps models from a reachable LiteLLM proxy', async () => {
      globalThis.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            {
              model_name: 'gemini-2.5-flash',
              litellm_params: { model: 'gemini/gemini-2.5-flash', api_key: 'AIzaSy1234567890' },
              model_info: { id: 'm1' },
            },
          ],
        }),
      })) as unknown as typeof fetch;

      const { service } = build();
      const result = await service.listProviders();

      expect(result.connected).toBe(true);
      expect(result.providers[0]).toMatchObject({
        id: 'm1',
        modelName: 'gemini-2.5-flash',
        provider: 'gemini',
        litellmModelId: 'gemini/gemini-2.5-flash',
        maskedKey: 'AIzaSy...****',
      });
    });

    it('falls back to the local registry when the proxy is unreachable', async () => {
      globalThis.fetch = jest.fn(async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch;

      const { service } = build();
      const result = await service.listProviders();

      expect(result.connected).toBe(false);
      expect(result.providers).toHaveLength(3);
      expect(result.providers[0].priority).toBe(1);
    });

    it('serves the local registry when the proxy replies with no models', async () => {
      globalThis.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ data: [] }),
      })) as unknown as typeof fetch;

      const { service } = build();
      const result = await service.listProviders();

      expect(result.providers).toHaveLength(3);
    });
  });

  describe('addProvider', () => {
    it('registers the provider, masks the API key and audits it', async () => {
      globalThis.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
      const { service, auditService } = build();

      const created = await service.addProvider(
        { modelName: 'gpt-4o', provider: 'OpenAI', litellmModelId: 'openai/gpt-4o', apiKey: 'sk-1234567890' } as any,
        adminUser,
      );

      expect(created.maskedKey).toBe('sk-123...****');
      expect(created.status).toBe('ACTIVE');
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'provider.add', targetType: 'provider' }),
      );
    });

    it('still adds and audits when the LiteLLM dispatch throws', async () => {
      globalThis.fetch = jest.fn(async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch;
      const { service, auditService } = build();

      await service.addProvider(
        { modelName: 'x', provider: 'Custom', litellmModelId: 'custom/x', apiKey: 'abcdefgh' } as any,
        adminUser,
      );

      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'provider.add' }),
      );
    });
  });

  describe('updateProvider', () => {
    it('throws NotFound for an unknown model id', async () => {
      globalThis.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
      const { service } = build();

      await expect(service.updateProvider('nope', { rpm: 1 } as any, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('mutates the registry and audits before/after state', async () => {
      globalThis.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
      const { service, auditService } = build();

      await service.updateProvider('prov-gemini-25', { rpm: 500, apiKey: 'newkey12345' } as any, adminUser);

      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'provider.update',
          targetId: 'prov-gemini-25',
          metadata: expect.objectContaining({
            before: expect.objectContaining({ rpm: 1000 }),
            after: expect.objectContaining({ rpm: 500, maskedKey: 'newkey...****' }),
          }),
        }),
      );
    });
  });

  describe('deleteProvider', () => {
    it('throws NotFound when the model is absent', async () => {
      globalThis.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
      const { service } = build();

      await expect(service.deleteProvider('nope', adminUser)).rejects.toThrow(NotFoundException);
    });

    it('removes the model and audits the removal', async () => {
      globalThis.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
      const { service, auditService } = build();

      const result = await service.deleteProvider('prov-claude-35-haiku', adminUser);

      expect(result.success).toBe(true);
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'provider.remove', targetId: 'prov-claude-35-haiku' }),
      );
      const remaining = await service.listProviders();
      expect(remaining.providers.find((p) => p.id === 'prov-claude-35-haiku')).toBeUndefined();
    });
  });

  describe('reorderProviders', () => {
    it('applies the new failover order and audits it', async () => {
      globalThis.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
      const { service, auditService } = build();

      const result = await service.reorderProviders(
        { orderedModelIds: ['prov-gpt4o-mini', 'prov-gemini-25'] } as any,
        adminUser,
      );

      expect(result.success).toBe(true);
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'provider.reorder',
          metadata: { newOrder: ['prov-gpt4o-mini', 'prov-gemini-25'] },
        }),
      );
      expect(result.providers[0].id).toBe('prov-gpt4o-mini');
      expect(result.providers[1].id).toBe('prov-gemini-25');
    });
  });

  describe('checkHealth', () => {
    it('reports HEALTHY when the proxy health endpoint is reachable', async () => {
      globalThis.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
      const { service } = build();

      const health = await service.checkHealth();

      expect(health.status).toBe('HEALTHY');
      expect(health.totalModelsConfigured).toBe(3);
      expect(health.fallbackChain).toHaveLength(3);
      expect(health.error).toBeNull();
    });

    it('reports STANDBY with the error when the proxy is down', async () => {
      globalThis.fetch = jest.fn(async () => {
        throw new Error('timeout');
      }) as unknown as typeof fetch;
      const { service } = build();

      const health = await service.checkHealth();

      expect(health.status).toBe('STANDBY');
      expect(health.error).toBe('timeout');
    });
  });
});
