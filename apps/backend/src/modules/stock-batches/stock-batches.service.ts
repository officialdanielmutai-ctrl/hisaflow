import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateStockBatchDto } from './dto/create-stock-batch.dto';

@Injectable()
export class StockBatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStockBatchDto, orgId: string) {
    return this.prisma.db.$transaction(async (tx) => {
      const batch = await tx.stockBatch.create({
        data: {
          ...dto,
          expiryDate: new Date(dto.expiryDate),
          orgId,
        },
      });

      await tx.inventoryItem.update({
        where: { id_orgId: { id: dto.inventoryItemId, orgId } },
        data: {
          quantity: { increment: dto.quantity },
        },
      });

      return batch;
    });
  }

  async findByItem(itemId: string, orgId: string) {
    return this.prisma.db.stockBatch.findMany({
      where: { orgId, inventoryItemId: itemId },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async findExpiring(orgId: string, daysAhead: number) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.prisma.db.stockBatch.findMany({
      where: {
        orgId,
        quantity: { gt: 0 },
        expiryDate: { lte: futureDate },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async deductFifo(itemId: string, orgId: string, quantityNeeded: number, prismaClient?: any) {
    const client = prismaClient || this.prisma.db;
    const batches = await client.stockBatch.findMany({
      where: { orgId, inventoryItemId: itemId, quantity: { gt: 0 } },
      orderBy: { expiryDate: 'asc' },
    });

    let remaining = quantityNeeded;
    const applied: { batchId: string, deducted: number }[] = [];

    const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);
    if (totalStock < quantityNeeded) {
      throw new Error(`Insufficient stock in batches for item ${itemId}`);
    }

    for (const batch of batches) {
      if (remaining <= 0) break;

      const deductAmount = Math.min(batch.quantity, remaining);
      await client.stockBatch.update({
        where: { id: batch.id },
        data: { quantity: { decrement: deductAmount } },
      });

      applied.push({ batchId: batch.id, deducted: deductAmount });
      remaining -= deductAmount;
    }

    return applied;
  }

  async retire(batchId: string, orgId: string) {
    return this.prisma.db.stockBatch.update({
      where: { id_orgId: { id: batchId, orgId } },
      data: { quantity: 0 },
    });
  }
}
