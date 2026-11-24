import { EntityResolutionService } from './entity-resolution.service';
import type { PrismaService } from '../../../infrastructure/prisma.service';

describe('EntityResolutionService', () => {
  let service: EntityResolutionService;
  let mockPrisma: {
    db: {
      inventoryItem: {
        findMany: jest.Mock;
      };
    };
  };

  const mockInventory = [
    {
      id: 'item_sugar_1kg',
      name: 'Default',
      unit: 'kg',
      quantity: 50,
      sellingPrice: 150,
      product: { name: 'White Sugar 1kg' },
    },
    {
      id: 'item_maize_flour',
      name: 'Default',
      unit: 'packet',
      quantity: 20,
      sellingPrice: 180,
      product: { name: 'Maize Flour 2kg' },
    },
    {
      id: 'item_milk_500ml',
      name: 'Fresh',
      unit: 'packet',
      quantity: 30,
      sellingPrice: 65,
      product: { name: 'Brookside Milk 500ml' },
    },
    {
      id: 'item_paracetamol',
      name: 'Default',
      unit: 'tablet',
      quantity: 100,
      sellingPrice: 10,
      product: { name: 'Paracetamol 500mg' },
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      db: {
        inventoryItem: {
          findMany: jest.fn().mockResolvedValue(mockInventory),
        },
      },
    };
    service = new EntityResolutionService(mockPrisma as unknown as PrismaService);
  });

  it('resolves exact match with high confidence', async () => {
    const res = await service.resolveInventoryItem('org_1', 'White Sugar 1kg');
    expect(res.bestMatch).not.toBeNull();
    expect(res.bestMatch?.id).toBe('item_sugar_1kg');
    expect(res.confidence).toBe('high');
  });

  it('resolves common shorthand e.g. "sugar" to "White Sugar 1kg"', async () => {
    const res = await service.resolveInventoryItem('org_1', 'sugar');
    expect(res.bestMatch).not.toBeNull();
    expect(res.bestMatch?.id).toBe('item_sugar_1kg');
  });

  it('resolves Swahili term "unga" to "Maize Flour 2kg"', async () => {
    const res = await service.resolveInventoryItem('org_1', 'unga');
    expect(res.bestMatch).not.toBeNull();
    expect(res.bestMatch?.id).toBe('item_maize_flour');
  });

  it('resolves Swahili term "sukari" to "White Sugar 1kg"', async () => {
    const res = await service.resolveInventoryItem('org_1', 'sukari');
    expect(res.bestMatch).not.toBeNull();
    expect(res.bestMatch?.id).toBe('item_sugar_1kg');
  });

  it('resolves Sheng/brand "panadol" to "Paracetamol 500mg"', async () => {
    const res = await service.resolveInventoryItem('org_1', 'panadol');
    expect(res.bestMatch).not.toBeNull();
    expect(res.bestMatch?.id).toBe('item_paracetamol');
  });

  it('handles minor typos gracefully e.g. "shuger" -> "White Sugar 1kg"', async () => {
    const res = await service.resolveInventoryItem('org_1', 'shuger');
    expect(res.bestMatch).not.toBeNull();
    expect(res.bestMatch?.id).toBe('item_sugar_1kg');
  });

  it('returns empty when no items exist', async () => {
    mockPrisma.db.inventoryItem.findMany.mockResolvedValueOnce([]);
    const res = await service.resolveInventoryItem('org_1', 'sugar');
    expect(res.bestMatch).toBeNull();
    expect(res.candidates).toEqual([]);
    expect(res.confidence).toBe('low');
  });
});
