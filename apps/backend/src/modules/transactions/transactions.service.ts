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

  async create(
    dto: CreateTransactionDto,
    organizationId: string,
    actorContext?: { actorId: string; actorName: string; actorRole: string },
  ) {
    const product = await this.prisma.db.inventoryItem.findFirst({
      where: { id: dto.itemId, organizationId },
      include: {
        organization: { select: { businessType: true } },
        tieredPriceRules: { orderBy: { minQuantity: 'desc' } },
        recipeLines: { include: { ingredient: true } },
      }
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

    // Determine tiered selling price if applicable
    let appliedTierPrice: number | null = null;
    if (dto.type === TransactionTypeDto.SALE && product.tieredPriceRules && product.tieredPriceRules.length > 0) {
      const applicableRule = product.tieredPriceRules.find(r => Number(r.minQuantity) <= dto.quantity);
      if (applicableRule) {
        appliedTierPrice = Number(applicableRule.pricePerUnit);
      }
    }

    // Handle Restaurant composite deduction
    const isRestaurant = product.organization.businessType === 'RESTAURANT';
    if (isRestaurant && product.isComposite && isDeduction) {
      const txs: any[] = [];
      const ingredientNames: string[] = [];
      
      for (const recipeLine of product.recipeLines) {
        const qtyToDeduct = Number(recipeLine.quantityUsed) * dto.quantity;
        const ingredient = recipeLine.ingredient;
        const ingCurrentQty = Number(ingredient.quantity);
        const ingNewQty = ingCurrentQty - qtyToDeduct;

        if (ingNewQty < 0) {
          throw new BadRequestException(`Insufficient stock for ingredient: ${ingredient.name}`);
        }

        ingredientNames.push(`${qtyToDeduct} ${ingredient.unit} of ${ingredient.name}`);

        txs.push(
          this.prisma.db.inventoryItem.update({
            where: { id: ingredient.id },
            data: { quantity: ingNewQty },
          }),
          this.prisma.db.inventoryTransaction.create({
            data: {
              organizationId,
              itemId: ingredient.id,
              type: dto.type,
              quantityBefore: ingCurrentQty,
              quantityChange: -qtyToDeduct,
              quantityAfter: ingNewQty,
              reason: `Used in ${dto.quantity} x ${product.name}`,
              actorId: actorContext?.actorId ?? null,
              source: 'manual',
              metadata: dto.metadata ?? undefined,
            },
          })
        );
      }

      await this.prisma.db.$transaction(txs);
      
      const sellingPrice = appliedTierPrice ?? Number(product.sellingPrice ?? 0);
      const amountTotal = sellingPrice > 0 ? sellingPrice * dto.quantity : 0;
      
      const txRecord = await this.prisma.db.inventoryTransaction.create({
        data: {
          organizationId,
          itemId: dto.itemId,
          type: dto.type,
          quantityBefore: currentQty,
          quantityChange: 0, 
          quantityAfter: currentQty,
          reason: dto.note ?? `Sold composite: deducted ${ingredientNames.join(', ')}`,
          actorId: actorContext?.actorId ?? null,
          source: dto.isCredit ? 'credit' : 'manual',
          clientName: dto.clientName ?? null,
          metadata: { ...dto.metadata, appliedTierPrice },
        },
      });

      if (dto.isCredit && dto.type === TransactionTypeDto.SALE) {
        const clientName = dto.clientName ?? 'Unknown Client';
        this.creditService
          .createForTransaction(organizationId, txRecord.id, clientName, amountTotal, dto.dueDate, dto.creditNotes)
          .catch((e) => console.error('Credit record creation failed:', e));
      }

      this.alertsService.runAllChecks(organizationId).catch((e) =>
        console.error('Alert check failed after transaction:', e),
      );

      return { success: true, newQuantity: currentQty, isComposite: true };
    }

    // Handle Chemist batch deduction
    const isChemist = product.organization.businessType === 'CHEMIST';
    let batchTxs: any[] = [];
    if (isChemist && isDeduction) {
      const batches = await this.prisma.db.stockBatch.findMany({
        where: { inventoryItemId: dto.itemId, quantity: { gt: 0 } },
        orderBy: { expiryDate: 'asc' },
      });

      let remainingToDeduct = dto.quantity;
      let batchDeductions: string[] = [];

      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;
        const batchQty = Number(batch.quantity);
        const deductFromBatch = Math.min(batchQty, remainingToDeduct);
        
        batchDeductions.push(`${deductFromBatch} from batch ${batch.batchNumber}`);

        batchTxs.push(
          this.prisma.db.stockBatch.update({
            where: { id: batch.id },
            data: { quantity: batchQty - deductFromBatch },
          })
        );
        remainingToDeduct -= deductFromBatch;
      }

      if (remainingToDeduct > 0) {
        throw new BadRequestException(`Insufficient stock across all batches. Need ${remainingToDeduct} more.`);
      }

      if (dto.note) {
         dto.note = `${dto.note} (Deducted: ${batchDeductions.join(', ')})`;
      } else {
         dto.note = `Deducted: ${batchDeductions.join(', ')}`;
      }
    }

    const txRecordData = {
      organizationId,
      itemId: dto.itemId,
      type: dto.type,
      quantityBefore: currentQty,
      quantityChange: isDeduction ? -dto.quantity : dto.quantity,
      quantityAfter: newQty,
      reason: dto.note ?? null,
      actorId: actorContext?.actorId ?? null,
      source: dto.isCredit ? 'credit' : 'manual',
      clientName: dto.clientName ?? null,
      metadata: appliedTierPrice ? { ...dto.metadata, appliedTierPrice } : (dto.metadata ?? undefined),
    };

    const [, txRecord] = await this.prisma.db.$transaction([
      this.prisma.db.inventoryItem.update({
        where: { id: dto.itemId },
        data: { quantity: newQty },
      }),
      this.prisma.db.inventoryTransaction.create({ data: txRecordData }),
      ...batchTxs
    ]);

    if (dto.isCredit && dto.type === TransactionTypeDto.SALE) {
      const sellingPrice = appliedTierPrice ?? Number(product.sellingPrice ?? 0);
      const amountTotal = sellingPrice > 0 ? sellingPrice * dto.quantity : 0;
      const clientName = dto.clientName ?? 'Unknown Client';

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

    if (actorContext && actorContext.actorRole === 'STAFF') {
      const typeLabel = dto.type.toLowerCase();
      const qty = Math.abs(dto.quantity);
      const title = `${qty} ${product.name} ${typeLabel} reported by ${actorContext.actorName}`;

      this.prisma.db.alert
        .create({
          data: {
            organizationId,
            type: 'STAFF_ACTIVITY',
            severity: 'INFO',
            title,
            description: `${actorContext.actorName} reported a ${typeLabel} of ${qty} ${product.unit} of ${product.name}.`,
          },
        })
        .catch((e) => console.error('Staff activity alert creation failed:', e));
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
