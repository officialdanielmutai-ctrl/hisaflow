import { NotFoundException } from '@nestjs/common';
import { CatalogSource, StockStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { InventoryService } from './inventory.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build(opts: { catalog?: any; off?: any; upc?: any; productExists?: boolean } = {}) {
  const product = {
    findMany: jest.fn(async () => [{ id: 'p1', organizationId: ORG, variants: [] }]),
    findFirst: jest.fn(async (args: any) =>
      args?.where?.organizationId !== ORG ? null : { id: 'p1', organizationId: ORG },
    ),
    create: jest.fn(async ({ data }: any) => ({ id: 'p1', ...data })),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const inventoryItem = {
    findFirst: jest.fn(async (args: any) =>
      args?.where?.organizationId !== ORG
        ? null
        : { id: 'v1', organizationId: ORG, quantity: 10, reorderThreshold: 3 },
    ),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const catalogEntry = {
    findUnique: jest.fn(async () => opts.catalog ?? null),
    update: jest.fn(async ({ where, data }: any) => ({ barcode: where.barcode, ...data })),
    create: jest.fn(async ({ data }: any) => ({ ...data })),
  };
  const db: any = { product, inventoryItem, productCatalogEntry: catalogEntry };
  const service = new InventoryService({ db } as unknown as PrismaService);
  return { service, product, inventoryItem, catalogEntry };
}

describe('InventoryService — listing and barcode lookup', () => {
  it('lists products for the org with only active variants', async () => {
    const { service, product } = build();

    await service.findAll(ORG);

    expect(product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG },
        include: {
          variants: expect.objectContaining({
            where: { isActive: true },
            include: { packaging: true },
          }),
        },
      }),
    );
    expectEveryCallScopedToOrg(product.findMany, ORG);
  });

  it('throws NotFound for a barcode that is not in the calling org', async () => {
    const { service, inventoryItem } = build();

    await expect(service.findByBarcode('123456', OTHER_ORG)).rejects.toThrow(NotFoundException);
    expectEveryCallScopedToOrg(inventoryItem.findFirst, OTHER_ORG);
  });

  it('returns a catalog hit and bumps its confirmation count', async () => {
    const { service, catalogEntry } = build({
      catalog: { barcode: '111', name: 'Shared Sugar', brand: 'B', category: 'dry', unit: 'kg', imageUrl: null },
    });

    const result = await service.lookupExternalProduct('111');

    expect(result).toMatchObject({ name: 'Shared Sugar', source: 'CATALOG' });
    expect(catalogEntry.update).toHaveBeenCalledWith({
      where: { barcode: '111' },
      data: { confirmations: { increment: 1 } },
    });
  });

  it('falls back to Open Food Facts and seeds the shared catalog', async () => {
    const { service, catalogEntry } = build();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: { product_name: 'Oat Milk', brands: 'Bio, Other', categories: 'Dairy, Plant', image_front_url: 'x' },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await service.lookupExternalProduct('222');

    expect(result).toMatchObject({ name: 'Oat Milk', brand: 'Bio', category: 'Dairy', source: 'OPEN_FOOD_FACTS' });
    expect(catalogEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ barcode: '222', name: 'Oat Milk', source: CatalogSource.OPEN_FOOD_FACTS }),
    });
  });

  it('returns null when both external providers miss', async () => {
    const { service } = build();
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    await expect(service.lookupExternalProduct('333')).resolves.toBeNull();
  });
});

describe('InventoryService — shared catalog upsert', () => {
  it('creates an entry when the barcode is new', async () => {
    const { service, catalogEntry } = build();

    await service.upsertCatalogEntry('444', { name: 'New Thing', source: CatalogSource.MANUAL });

    expect(catalogEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ barcode: '444', name: 'New Thing', source: CatalogSource.MANUAL }),
    });
  });

  it('never overwrites an existing entry from an external provider', async () => {
    const { service, catalogEntry } = build({ catalog: { barcode: '444', name: 'Trusted' } });

    await service.upsertCatalogEntry('444', { name: 'External Guess', source: CatalogSource.OPEN_FOOD_FACTS });

    expect(catalogEntry.update).toHaveBeenCalledWith({
      where: { barcode: '444' },
      data: { confirmations: { increment: 1 } },
    });
  });

  it('lets a manual contribution overwrite the name of an existing entry', async () => {
    const { service, catalogEntry } = build({ catalog: { barcode: '444', name: 'Old', brand: 'X' } });

    await service.upsertCatalogEntry('444', {
      name: 'Corrected',
      brand: null,
      source: CatalogSource.MANUAL,
    });

    const data = catalogEntry.update.mock.calls[0][0].data;
    expect(data.name).toBe('Corrected');
    expect(data.source).toBe(CatalogSource.MANUAL);
  });
});

describe('InventoryService — variants and stock status', () => {
  it('derives HEALTHY / LOW / OUT_OF_STOCK on the default variant', async () => {
    const { service, product } = build();

    await service.create({ name: 'Sugar', unit: 'kg', quantity: 5, reorderThreshold: 3 }, ORG);
    await service.create({ name: 'Salt', unit: 'kg', quantity: 2, reorderThreshold: 3 }, ORG);
    await service.create({ name: 'Oil', unit: 'ltr', quantity: 0 }, ORG);

    const statuses = product.create.mock.calls.map(
      (call) => call[0].data.variants.create[0].status,
    );
    expect(statuses).toEqual([StockStatus.HEALTHY, StockStatus.LOW, StockStatus.OUT_OF_STOCK]);
  });

  it('re-computes status when a variant quantity is edited', async () => {
    const { service, inventoryItem } = build();

    await service.updateVariant('v1', { quantity: 0 }, ORG);
    expect(inventoryItem.update.mock.calls[0][0].data.status).toBe(StockStatus.OUT_OF_STOCK);

    await service.updateVariant('v1', { quantity: 99 }, ORG);
    expect(inventoryItem.update.mock.calls[1][0].data.status).toBe(StockStatus.HEALTHY);
  });

  it('refuses to edit a variant in another org', async () => {
    const { service, inventoryItem } = build();

    await expect(service.updateVariant('v1', { quantity: 1 }, OTHER_ORG)).rejects.toThrow(
      NotFoundException,
    );
    expect(inventoryItem.update).not.toHaveBeenCalled();
  });

  it('soft-deletes a variant instead of removing the row', async () => {
    const { service, inventoryItem } = build();

    await service.deleteVariant('v1', ORG);

    expect(inventoryItem.update.mock.calls[0][0].data).toEqual({ isActive: false });
  });

  it('refuses to delete a variant in another org', async () => {
    const { service, inventoryItem } = build();

    await expect(service.deleteVariant('v1', OTHER_ORG)).rejects.toThrow(NotFoundException);
    expect(inventoryItem.update).not.toHaveBeenCalled();
  });
});
