import { PrismaService } from '../../infrastructure/prisma.service';
import { InventoryRepository } from './inventory.repository';

const ORG = 'org_1';

function build() {
  const inventoryItem: any = {
    findMany: jest.fn(async (): Promise<any[]> => []),
    findFirst: jest.fn(async (): Promise<any> => null),
    create: jest.fn(async ({ data }: any) => ({ id: 'item_1', ...data })),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const inventoryTransaction: any = { create: jest.fn(async ({ data }: any) => ({ id: 'tx_1', ...data })) };
  const db: any = { inventoryItem, inventoryTransaction };
  return {
    repo: new InventoryRepository({ db } as unknown as PrismaService),
    inventoryItem,
    inventoryTransaction,
  };
}

describe('InventoryRepository', () => {
  it('findAll is org-scoped and only returns active items', async () => {
    const { repo, inventoryItem } = build();

    await repo.findAll(ORG);

    expect(inventoryItem.findMany).toHaveBeenCalledWith({
      where: { organizationId: ORG, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('findById is org-scoped and only returns active items', async () => {
    const { repo, inventoryItem } = build();

    await repo.findById('item_1', ORG);

    expect(inventoryItem.findFirst).toHaveBeenCalledWith({
      where: { id: 'item_1', organizationId: ORG, isActive: true },
    });
  });

  it('updates quantity and status with a fresh updatedAt', async () => {
    const { repo, inventoryItem } = build();

    await repo.updateQuantityAndStatus('item_1', ORG, 8, 'LOW' as any);

    expect(inventoryItem.update).toHaveBeenCalledWith({
      where: { id: 'item_1' },
      data: { quantity: 8, status: 'LOW', updatedAt: expect.any(Date) },
    });
  });

  it('creates a transaction row', async () => {
    const { repo, inventoryTransaction } = build();

    await repo.createTransaction({ organizationId: ORG, itemId: 'item_1' } as any);

    expect(inventoryTransaction.create).toHaveBeenCalledWith({
      data: { organizationId: ORG, itemId: 'item_1' },
    });
  });
});
