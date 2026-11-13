import { BadRequestException } from '@nestjs/common';
import { DataExportService, toCsv } from './data-export.service';

describe('DataExportService', () => {
  it('escapes quotes, commas and newlines in CSV cells', () => {
    const csv = toCsv(
      ['name', 'note'],
      [
        ['Acme "Ltd"', 'a,b'],
        ['Line', 'first\nsecond'],
      ],
    );

    expect(csv.split('\n')[0]).toBe('name,note');
    expect(csv).toContain('"Acme ""Ltd"""');
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"first\nsecond"');
  });

  it('rejects an unknown dataset', async () => {
    const service = new DataExportService({ db: {} } as never);
    await expect(service.build('passwords', 'org-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('builds an owner-scoped inventory CSV', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'item-1',
        product: { name: 'Sugar' },
        name: '500g',
        barcode: '123',
        unit: 'packet',
        quantity: 3,
        reorderThreshold: 2,
        costPrice: 100,
        sellingPrice: 130,
        status: 'HEALTHY',
        expiryDate: null,
        batchNumber: null,
        isActive: true,
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
      },
    ]);
    const prisma = { db: { inventoryItem: { findMany } } };
    const service = new DataExportService(prisma as never);

    const result = await service.build('inventory', 'org-1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } }),
    );
    expect(result.filename).toBe('inventory.csv');
    expect(result.csv).toContain('Sugar');
    expect(result.csv).toContain('500g');
  });
});
