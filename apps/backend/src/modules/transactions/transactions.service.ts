import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateTransactionDto, TransactionTypeDto } from './dto/create-transaction.dto';
import { AlertsService } from '../alerts/alerts.service';
import { CreditService } from '../finance/credit.service';

export interface TransactionWithItem {
  id: string;
  type: string;
  quantity: number;
  note: string | null;
  createdAt: string;
  inventoryItem: {
    id: string;
    name: string;
    unit: string;
  };
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
    private readonly creditService: CreditService,
  ) {}

  async create(dto: CreateTransactionDto, organizationId: string) {
    const product = await this.prisma.db.inventoryItem.findFirst({
      where: { id: dto.itemId, organizationId },
    });

    if (!product) {
      throw new BadRequestException('Product not found');
    }

    const currentQty = Number(product.quantity);
    const isDeduction =
      dto.type === TransactionTypeDto.SALE ||
      dto.type === TransactionTypeDto.WASTAGE;
    const newQty = isDeduction
      ? currentQty - dto.quantity
      : currentQty + dto.quantity;

    if (newQty < 0) {
      throw new BadRequestException('Insufficient stock');
    }

    // Create the inventory transaction record
    const [, txRecord] = await this.prisma.db.$transaction([
      this.prisma.db.inventoryItem.update({
        where: { id: dto.itemId },
        data: { quantity: newQty },
      }),
      this.prisma.db.inventoryTransaction.create({
        data: {
          organizationId,
          itemId: dto.itemId,
          type: dto.type,
          quantityBefore: currentQty,
          quantityChange: isDeduction ? -dto.quantity : dto.quantity,
          quantityAfter: newQty,
          reason: dto.note ?? null,
          source: dto.isCredit ? 'credit' : 'manual',
          clientName: dto.clientName ?? null,
          metadata: dto.metadata ?? undefined,
        },
      }),
    ]);

    // If this is a credit sale, auto-create a CreditRecord
    if (dto.isCredit && dto.type === TransactionTypeDto.SALE) {
      const sellingPrice = Number(product.sellingPrice ?? 0);
      const amountTotal = sellingPrice > 0 ? sellingPrice * dto.quantity : 0;
      const clientName = dto.clientName ?? 'Unknown Client';

      // Non-blocking — don't fail the whole transaction if credit creation has issues
      this.creditService
        .createForTransaction(
          organizationId,
          txRecord.id,
          clientName,
          amountTotal,
          dto.dueDate,
          dto.creditNotes,
        )
        .catch((e) => console.error('Credit record creation failed:', e));
    }

    // Fire alert checks non-blocking so stock alerts update after every transaction
    this.alertsService.runAllChecks(organizationId).catch((e) =>
      console.error('Alert check failed after transaction:', e),
    );

    return { success: true, newQuantity: newQty };
  }

  async findAll(
    organizationId: string,
    filters?: { itemId?: string; type?: string },
  ): Promise<TransactionWithItem[]> {
    const where: any = { organizationId };
    if (filters?.itemId) {
      where.itemId = filters.itemId;
    }
    if (filters?.type) {
      where.type = filters.type;
    }

    const transactions = await this.prisma.db.inventoryTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: {
          select: { id: true, name: true, unit: true },
        },
      },
    });
    return transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      quantity: Number(tx.quantityChange),
      note: tx.reason,
      createdAt: tx.createdAt.toISOString(),
      inventoryItem: tx.item,
    }));
  }
}
