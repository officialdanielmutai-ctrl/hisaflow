import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateTableOrderDto, AddOrderItemDto } from './dto/create-table-order.dto';

@Injectable()
export class TableOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTableOrderDto, orgId: string) {
    return this.prisma.db.tableOrder.create({
      data: {
        orgId,
        tableLabel: dto.tableLabel,
        notes: dto.notes,
        status: 'OPEN',
        items: {
          create: dto.items?.map(item => ({
            inventoryItemId: item.itemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes,
          })) || [],
        },
      },
      include: { items: true },
    });
  }

  async findAll(orgId: string, status: string = 'OPEN') {
    return this.prisma.db.tableOrder.findMany({
      where: { orgId, status },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, orgId: string) {
    return this.prisma.db.tableOrder.findUniqueOrThrow({
      where: { id_orgId: { id, orgId } },
      include: {
        items: {
          include: {
            inventoryItem: true,
          },
        },
      },
    });
  }

  async addItem(orderId: string, dto: AddOrderItemDto, orgId: string) {
    const order = await this.prisma.db.tableOrder.findUniqueOrThrow({
      where: { id_orgId: { id: orderId, orgId } },
    });

    if (order.status !== 'OPEN') {
      throw new BadRequestException('Can only add items to OPEN orders');
    }

    return this.prisma.db.tableOrderItem.create({
      data: {
        orderId,
        inventoryItemId: dto.itemId,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        notes: dto.notes,
      },
    });
  }

  async removeItem(orderItemId: string, orgId: string) {
    const item = await this.prisma.db.tableOrderItem.findUniqueOrThrow({
      where: { id: orderItemId },
      include: { order: true },
    });

    if (item.order.orgId !== orgId || item.order.status !== 'OPEN') {
      throw new BadRequestException('Cannot remove item or unauthorized');
    }

    return this.prisma.db.tableOrderItem.delete({
      where: { id: orderItemId },
    });
  }

  async closeOrder(orderId: string, orgId: string) {
    return this.prisma.db.$transaction(async (tx) => {
      const order = await tx.tableOrder.findUniqueOrThrow({
        where: { id_orgId: { id: orderId, orgId } },
        include: {
          items: {
            include: {
              inventoryItem: {
                include: { recipeIngredients: true },
              },
            },
          },
        },
      });

      if (order.status !== 'OPEN') {
        throw new BadRequestException('Order is not OPEN');
      }

      for (const item of order.items) {
        if (item.inventoryItem.isComposite) {
          for (const ingredient of item.inventoryItem.recipeIngredients) {
            const deductionQuantity = ingredient.quantity * item.quantity;
            await tx.inventoryItem.update({
              where: { id_orgId: { id: ingredient.ingredientId, orgId } },
              data: { quantity: { decrement: deductionQuantity } },
            });
          }
        } else {
          await tx.inventoryItem.update({
            where: { id_orgId: { id: item.inventoryItem.id, orgId } },
            data: { quantity: { decrement: item.quantity } },
          });
        }
      }

      return tx.tableOrder.update({
        where: { id_orgId: { id: orderId, orgId } },
        data: { status: 'PAID' },
      });
    });
  }

  async voidOrder(orderId: string, orgId: string) {
    const order = await this.prisma.db.tableOrder.findUniqueOrThrow({
      where: { id_orgId: { id: orderId, orgId } },
    });

    if (order.status !== 'OPEN') {
      throw new BadRequestException('Can only void OPEN orders');
    }

    return this.prisma.db.tableOrder.update({
      where: { id_orgId: { id: orderId, orgId } },
      data: { status: 'VOIDED' },
    });
  }
}
