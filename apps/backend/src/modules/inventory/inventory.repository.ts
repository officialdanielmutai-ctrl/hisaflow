import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { Prisma, StockStatus } from '../../../generated/prisma/client';

@Injectable()
export class InventoryRepository {
  constructor(private prisma: PrismaService) {}

  findAll(organizationId: string) {
    return this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findById(id: string, organizationId: string) {
    return this.prisma.db.inventoryItem.findFirst({
      where: { id, organizationId, isActive: true },
    });
  }

  create(organizationId: string, data: Prisma.InventoryItemUncheckedCreateInput) {
    return this.prisma.db.inventoryItem.create({ data });
  }

  updateQuantityAndStatus(
    id: string,
    organizationId: string,
    quantity: number,
    status: StockStatus,
  ) {
    return this.prisma.db.inventoryItem.update({
      where: { id },
      data: { quantity, status, updatedAt: new Date() },
    });
  }

  createTransaction(data: Prisma.InventoryTransactionUncheckedCreateInput) {
    return this.prisma.db.inventoryTransaction.create({ data });
  }
}
