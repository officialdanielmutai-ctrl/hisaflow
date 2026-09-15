import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Prisma, TransactionType, InvoiceStatus } from '@prisma/client';
import { IssueEquipmentDto } from './dto/issue-equipment.dto';

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(organizationId: string, dto: IssueEquipmentDto) {
    const subscriber = await this.prisma.db.subscriber.findFirst({
      where: { id: dto.subscriberId, organizationId },
    });
    if (!subscriber) throw new NotFoundException(`Subscriber ${dto.subscriberId} not found`);

    if (dto.workOrderId) {
      const workOrder = await this.prisma.db.workOrder.findFirst({
        where: { id: dto.workOrderId, organizationId, subscriberId: dto.subscriberId },
      });
      if (!workOrder) throw new NotFoundException(`Work order ${dto.workOrderId} not found for this subscriber`);
    }

    const item = await this.prisma.db.inventoryItem.findFirst({
      where: { id: dto.itemId, organizationId },
    });
    if (!item) throw new NotFoundException(`Inventory item ${dto.itemId} not found`);

    const currentQty = Number(item.quantity);
    if (currentQty < dto.quantity) {
      throw new BadRequestException(`Insufficient stock. Available: ${currentQty}, Requested: ${dto.quantity}`);
    }

    const qtyDecimal = new Prisma.Decimal(dto.quantity);
    const newQty = currentQty - dto.quantity;

    return this.prisma.db.$transaction(async (tx) => {
      // 1. Deduct stock
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: new Prisma.Decimal(newQty) },
      });

      // 2. Record inventory transaction
      const transaction = await tx.inventoryTransaction.create({
        data: {
          organizationId,
          itemId: item.id,
          type: TransactionType.SALE,
          quantityBefore: item.quantity,
          quantityChange: new Prisma.Decimal(-dto.quantity),
          quantityAfter: new Prisma.Decimal(newQty),
          reason: dto.notes || `Equipment issued to subscriber ${subscriber.name}`,
          subscriberId: subscriber.id,
          workOrderId: dto.workOrderId || null,
        },
        include: { item: true, workOrder: true },
      });

      // 3. Optionally charge to a draft invoice
      if (dto.chargeToInvoice) {
        let invoice = await tx.invoice.findFirst({
          where: { organizationId, subscriberId: subscriber.id, status: InvoiceStatus.DRAFT },
          orderBy: { createdAt: 'desc' },
        });

        if (!invoice) {
          invoice = await tx.invoice.create({
            data: {
              organizationId,
              subscriberId: subscriber.id,
              roomTotal: 0,
              consumptionTotal: 0,
              adjustmentsTotal: 0,
              amountPaid: 0,
              status: InvoiceStatus.DRAFT,
            },
          });
        }

        const unitPrice = item.sellingPrice || item.costPrice || new Prisma.Decimal(0);
        const lineTotal = qtyDecimal.mul(unitPrice);

        await tx.invoiceLineItem.create({
          data: {
            invoiceId: invoice.id,
            description: `${item.name} (${dto.quantity} unit${dto.quantity > 1 ? 's' : ''})`,
            quantity: qtyDecimal,
            unitPrice,
            total: lineTotal,
          },
        });

        await tx.invoice.update({
          where: { id: invoice.id },
          data: { adjustmentsTotal: { increment: lineTotal } },
        });
      }

      return transaction;
    });
  }

  async findBySubscriber(organizationId: string, subscriberId: string) {
    return this.prisma.db.inventoryTransaction.findMany({
      where: { organizationId, subscriberId },
      orderBy: { createdAt: 'desc' },
      include: { item: true, workOrder: true },
    });
  }

  async findByWorkOrder(organizationId: string, workOrderId: string) {
    return this.prisma.db.inventoryTransaction.findMany({
      where: { organizationId, workOrderId },
      orderBy: { createdAt: 'desc' },
      include: { item: true },
    });
  }
}
