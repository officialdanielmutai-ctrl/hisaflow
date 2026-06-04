import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateTransactionDto, TransactionTypeDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTransactionDto, organizationId: string) {
    const product = await this.prisma.db.product.findFirst({
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

    await this.prisma.db.$transaction([
      this.prisma.db.product.update({
        where: { id: dto.itemId },
        data: { quantity: newQty },
      }),
      this.prisma.db.stockTransaction.create({
        data: {
          organizationId,
          productId: dto.itemId,
          type: dto.type,
          quantityBefore: currentQty,
          quantityChange: isDeduction ? -dto.quantity : dto.quantity,
          quantityAfter: newQty,
          note: dto.note ?? null,
          source: 'manual',
        },
      }),
    ]);

    return { success: true, newQuantity: newQty };
  }
}
