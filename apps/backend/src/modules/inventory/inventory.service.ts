import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organizationId: string) {
    return this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  create(dto: CreateProductDto, organizationId: string) {
    return this.prisma.db.inventoryItem.create({
      data: { ...dto, organizationId },
    });
  }
}
