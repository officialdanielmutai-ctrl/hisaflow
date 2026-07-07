import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

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
    const data: any = { ...dto, organizationId };
    
    if (data.expiryDate) {
      data.expiryDate = new Date(data.expiryDate);
    }
    
    return this.prisma.db.inventoryItem.create({
      data,
    });
  }

  async update(id: string, dto: UpdateProductDto, organizationId: string) {
    const item = await this.prisma.db.inventoryItem.findFirst({
      where: { id, organizationId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    
    const data: any = { ...dto };
    if (data.expiryDate) {
      data.expiryDate = new Date(data.expiryDate);
    }

    return this.prisma.db.inventoryItem.update({
      where: { id },
      data,
    });
  }
}
