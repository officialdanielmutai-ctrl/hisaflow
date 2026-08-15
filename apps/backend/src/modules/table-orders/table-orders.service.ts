import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateTableOrderDto, AddOrderItemDto } from './dto/create-table-order.dto';

@Injectable()
export class TableOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTableOrderDto, orgId: string) {
    return this.prisma.db.tableOrder.create({
      data: {
        organizationId: orgId,
        tableLabel: dto.tableLabel,
        notes: dto.notes,
        status: 'OPEN',
        items: {
          create: dto.items?.map(item => ({
            itemId: item.itemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes,
          })) || [],
        },
      },
      include: { items: true },
    });
  }

  async findAll(orgId: string, status: any = 'OPEN') {
    return this.prisma.db.tableOrder.findMany({
      where: { organizationId: orgId, status },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, orgId: string) {
    return this.prisma.db.tableOrder.findFirstOrThrow({
      where: { id, organizationId: orgId },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    });
  }

  async addItem(orderId: string, dto: AddOrderItemDto, orgId: string) {
    const order = await this.prisma.db.tableOrder.findFirstOrThrow({
      where: { id: orderId, organizationId: orgId },
    });

    if (order.status !== 'OPEN') {
      throw new BadRequestException('Can only add items to OPEN orders');
    }

    return this.prisma.db.tableOrderItem.create({
      data: {
        orderId,
        itemId: dto.itemId,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        notes: dto.notes,
      },
    });
  }

  async removeItem(orderItemId: string, orgId: string) {
    const tableItem = await this.prisma.db.tableOrderItem.findUniqueOrThrow({
      where: { id: orderItemId },
      include: { order: true },
    });

    if (tableItem.order.organizationId !== orgId || tableItem.order.status !== 'OPEN') {
      throw new BadRequestException('Cannot remove item or unauthorized');
    }

    return this.prisma.db.tableOrderItem.delete({
      where: { id: orderItemId },
    });
  }

  async closeOrder(orderId: string, orgId: string) {
    return this.prisma.db.$transaction(async (tx) => {
      const order = await tx.tableOrder.findFirstOrThrow({
        where: { id: orderId, organizationId: orgId },
        include: {
          items: {
            include: {
              item: {
                include: { recipeLines: true },
              },
            },
          },
        },
      });

      if (order.status !== 'OPEN') {
        throw new BadRequestException('Order is not OPEN');
      }

      for (const tableItem of order.items) {
        if (tableItem.item.isComposite) {
          for (const ingredient of tableItem.item.recipeLines) {
            const deductionQuantity = ingredient.quantityUsed.toNumber() * tableItem.quantity.toNumber();
            await tx.inventoryItem.update({
              where: { id: ingredient.ingredientId },
              data: { quantity: { decrement: deductionQuantity } },
            });
          }
        } else {
          await tx.inventoryItem.update({
            where: { id: tableItem.item.id },
            data: { quantity: { decrement: tableItem.quantity } },
          });
        }
      }

      return tx.tableOrder.update({
        where: { id: orderId },
        data: { status: 'PAID', closedAt: new Date() },
      });
    });
  }

  async voidOrder(orderId: string, orgId: string) {
    const order = await this.prisma.db.tableOrder.findFirstOrThrow({
      where: { id: orderId, organizationId: orgId },
    });

    if (order.status !== 'OPEN') {
      throw new BadRequestException('Can only void OPEN orders');
    }

    return this.prisma.db.tableOrder.update({
      where: { id: orderId },
      data: { status: 'VOIDED', closedAt: new Date() },
    });
  }
}
