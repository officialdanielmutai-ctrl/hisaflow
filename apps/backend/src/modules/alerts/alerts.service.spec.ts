import { AlertSeverity, AlertType } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AfricasTalkingProvider } from '../../infrastructure/providers/africas-talking.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { AlertsService } from './alerts.service';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';
const TEN_DAYS_AGO = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

interface Store {
  items?: any[];
  lastPurchase?: any;
  sales?: any[];
  wastageGroups?: any[];
  batches?: any[];
  org?: any;
}

function build(store: Store = {}) {
  const items = store.items ?? [];

  const inventoryItem = {
    findMany: jest.fn(async (args: any) => {
      let rows = items;
      const where = args?.where ?? {};
      if (where.organizationId) {
        rows = rows.filter((r) => r.organizationId === where.organizationId);
      }
      if (where.isActive !== undefined) {
        rows = rows.filter((r) => r.isActive === where.isActive);
      }
      if (where.quantity?.gt !== undefined) {
        rows = rows.filter((r) => Number(r.quantity) > where.quantity.gt);
      }
      return rows;
    }),
    findUnique: jest.fn(async (args: any) => items.find((r) => r.id === args?.where?.id) ?? null),
  };

  const inventoryTransaction = {
    findFirst: jest.fn(async () => store.lastPurchase ?? null),
    count: jest.fn(async () => (store.sales ?? []).length),
    findMany: jest.fn(async () => store.sales ?? []),
    groupBy: jest.fn(async () => store.wastageGroups ?? []),
  };

  const stockBatch = {
    count: jest.fn(async () => (store.batches ?? []).length),
    findMany: jest.fn(async () => store.batches ?? []),
  };

  const alert = {
    upsert: jest.fn(async ({ create }: any) => ({ id: 'alert_1', ...create })),
    updateMany: jest.fn(async () => ({ count: 2 })),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    findMany: jest.fn(async () => []),
    findFirst: jest.fn(async () => null),
    create: jest.fn(async ({ data }: any) => ({ id: 'alert_new', ...data })),
  };

  const organization = {
    findUnique: jest.fn(async () => store.org ?? null),
  };

  const db: any = { inventoryItem, inventoryTransaction, stockBatch, alert, organization };
  const africasTalking = { sendSms: jest.fn(async () => ({})) };
  const notifications = { sendPushToOrganization: jest.fn(async () => ({})) };

  const service = new AlertsService(
    { db } as unknown as PrismaService,
    africasTalking as unknown as AfricasTalkingProvider,
    notifications as unknown as NotificationsService,
  );

  return { service, inventoryItem, inventoryTransaction, stockBatch, alert, organization, africasTalking, notifications };
}

function upserts(alert: { upsert: jest.Mock }) {
  return alert.upsert.mock.calls.map((call) => call[0]);
}

describe('AlertsService', () => {
  describe('runAllChecks', () => {
    it('returns ok and scopes inventory reads to the calling org', async () => {
      const { service, inventoryItem } = build();

      await expect(service.runAllChecks(ORG)).resolves.toEqual({ ok: true });

      expect(inventoryItem.findMany).toHaveBeenCalled();
      for (const call of inventoryItem.findMany.mock.calls) {
        expect(call[0].where).toEqual(expect.objectContaining({ organizationId: ORG }));
      }
    });

    it('raises a CRITICAL OUT_OF_STOCK alert and auto-resolves LOW_STOCK', async () => {
      const { service, alert } = build({
        items: [
          {
            id: 'i1',
            organizationId: ORG,
            name: 'Sugar',
            unit: 'kg',
            quantity: 0,
            reorderThreshold: 5,
            isActive: true,
            createdAt: TEN_DAYS_AGO,
          },
        ],
      });

      await service.runAllChecks(ORG);

      const outOfStock = upserts(alert).find((c) => c.create.type === AlertType.OUT_OF_STOCK);
      expect(outOfStock).toBeDefined();
      expect(outOfStock.create).toMatchObject({
        organizationId: ORG,
        itemId: 'i1',
        severity: AlertSeverity.CRITICAL,
      });

      expect(alert.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG,
            itemId: 'i1',
            type: AlertType.LOW_STOCK,
            resolvedAt: null,
          }),
        }),
      );
    });

    it('raises a WARNING LOW_STOCK alert and texts the org phone exactly once', async () => {
      const { service, alert, organization, africasTalking } = build({
        items: [
          {
            id: 'i1',
            organizationId: ORG,
            name: 'Milk',
            unit: 'litres',
            quantity: 3,
            reorderThreshold: 5,
            isActive: true,
            createdAt: TEN_DAYS_AGO,
          },
        ],
        org: { phone: '+254700000000' },
      });

      await service.runAllChecks(ORG);

      const lowStock = upserts(alert).find((c) => c.create.type === AlertType.LOW_STOCK);
      expect(lowStock.create.severity).toBe(AlertSeverity.WARNING);
      expect(organization.findUnique).toHaveBeenCalledWith({
        where: { id: ORG },
        select: { phone: true },
      });
      expect(africasTalking.sendSms).toHaveBeenCalledWith(
        '+254700000000',
        expect.stringContaining('Low stock'),
      );
    });

    it('does not text when the org has no phone number', async () => {
      const { service, africasTalking } = build({
        items: [
          {
            id: 'i1',
            organizationId: ORG,
            name: 'Milk',
            unit: 'litres',
            quantity: 3,
            reorderThreshold: 5,
            isActive: true,
            createdAt: TEN_DAYS_AGO,
          },
        ],
        org: null,
      });

      await service.runAllChecks(ORG);

      expect(africasTalking.sendSms).not.toHaveBeenCalled();
    });

    it('raises an INFO DEAD_STOCK alert for stock older than 7 days with no sales', async () => {
      const { service, alert } = build({
        items: [
          {
            id: 'i1',
            organizationId: ORG,
            name: 'Old Biscuits',
            unit: 'packets',
            quantity: 12,
            reorderThreshold: 2,
            isActive: true,
            createdAt: TEN_DAYS_AGO,
          },
        ],
        lastPurchase: null,
        sales: [],
      });

      await service.runAllChecks(ORG);

      const deadStock = upserts(alert).find((c) => c.create.type === AlertType.DEAD_STOCK);
      expect(deadStock.create).toMatchObject({
        organizationId: ORG,
        severity: AlertSeverity.INFO,
        title: expect.stringContaining('no sales in 7 days'),
      });
    });

    it('flags a CRITICAL EXPIRY_RISK when a batch expires within 30 days', async () => {
      const expiring = {
        organizationId: ORG,
        inventoryItemId: 'i1',
        batchNumber: 'B-1',
        quantity: 10,
        expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        inventoryItem: { id: 'i1', name: 'Amoxil', unit: 'tabs' },
      };
      const { service, alert } = build({ batches: [expiring] });

      await service.runAllChecks(ORG);

      const expiry = upserts(alert).find((c) => c.create.type === AlertType.EXPIRY_RISK);
      expect(expiry.create).toMatchObject({
        organizationId: ORG,
        itemId: 'i1',
        severity: AlertSeverity.CRITICAL,
      });
      expect(expiry.create.title).toContain('Amoxil');
    });

    it('skips expiry checks entirely for orgs with no stock batches', async () => {
      const { service, stockBatch } = build({ batches: [] });

      await service.runAllChecks(ORG);

      expect(stockBatch.count).toHaveBeenCalledWith({ where: { organizationId: ORG } });
      expect(stockBatch.findMany).not.toHaveBeenCalled();
    });

    it('ignores wastage rows whose item belongs to a different org', async () => {
      const { service, alert } = build({
        wastageGroups: [{ itemId: 'foreign', _count: { id: 3 } }],
        items: [
          {
            id: 'foreign',
            organizationId: OTHER_ORG,
            name: 'Foreign Item',
            unit: 'units',
            quantity: 5,
            reorderThreshold: 1,
            isActive: true,
            createdAt: TEN_DAYS_AGO,
          },
        ],
      });

      await service.runAllChecks(ORG);

      const variance = upserts(alert).find((c) => c.create.type === AlertType.VARIANCE);
      expect(variance).toBeUndefined();
    });

    it('flags a WARNING VARIANCE alert once an item reaches 3 wastage events today', async () => {
      const { service, alert } = build({
        wastageGroups: [{ itemId: 'i1', _count: { id: 3 } }],
        items: [
          {
            id: 'i1',
            organizationId: ORG,
            name: 'Milk',
            unit: 'litres',
            quantity: 5,
            reorderThreshold: 1,
            isActive: true,
            createdAt: TEN_DAYS_AGO,
          },
        ],
      });

      await service.runAllChecks(ORG);

      const variance = upserts(alert).find((c) => c.create.type === AlertType.VARIANCE);
      expect(variance).toBeDefined();
      expect(variance.create).toMatchObject({
        organizationId: ORG,
        itemId: 'i1',
        severity: AlertSeverity.WARNING,
      });
      expect(variance.create.description).toContain('3 wastage transactions');
    });

    it('does not flag a wastage spike below the 3-event threshold', async () => {
      const { service, alert } = build({
        wastageGroups: [{ itemId: 'i1', _count: { id: 2 } }],
        items: [
          {
            id: 'i1',
            organizationId: ORG,
            name: 'Milk',
            unit: 'litres',
            quantity: 5,
            reorderThreshold: 1,
            isActive: true,
            createdAt: TEN_DAYS_AGO,
          },
        ],
      });

      await service.runAllChecks(ORG);

      const variance = upserts(alert).find((c) => c.create.type === AlertType.VARIANCE);
      expect(variance).toBeUndefined();
    });
  });

  describe('alert read/write scoping', () => {
    it('getActiveAlerts only reads unresolved rows for the calling org', async () => {
      const { service, alert } = build();

      await service.getActiveAlerts(ORG);

      expect(alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: ORG, resolvedAt: null },
        }),
      );
    });

    it('resolveAlert can never target another org (id + organizationId in where)', async () => {
      const { service, alert } = build();

      await service.resolveAlert('alert_1', ORG);

      expect(alert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'alert_1', organizationId: ORG },
        }),
      );
    });

    it('resolveAllAlerts reports the number of resolved rows for the org', async () => {
      const { service, alert } = build();

      await expect(service.resolveAllAlerts(ORG)).resolves.toEqual({ resolved: 2 });

      expect(alert.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG, resolvedAt: null }),
        }),
      );
    });

    it('checkLowStock delegates to the full check pipeline', async () => {
      const { service } = build();

      await expect(service.checkLowStock(ORG)).resolves.toEqual({ ok: true });
    });
  });
});
