import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto, UpdateVariantDto } from './dto/update-product.dto';
import { StockStatus } from '../../../generated/prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.db.product.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        variants: {
          where: { isActive: true },
          include: {
            packaging: true,
          },
        },
      },
    });
  }

  async create(dto: CreateProductDto, organizationId: string) {
    let variantsData: any[] = [];
    if (dto.variants && dto.variants.length > 0) {
      variantsData = dto.variants;
    } else {
      variantsData = [{
        name: 'Default',
        unit: dto.unit || 'units',
        quantity: dto.quantity || 0,
        reorderThreshold: dto.reorderThreshold || 0,
        costPrice: dto.costPrice,
        sellingPrice: dto.sellingPrice,
      }];
    }

    return this.prisma.db.product.create({
      data: {
        organizationId,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        variants: {
          create: variantsData.map((v) => ({
            organization: { connect: { id: organizationId } },
            name: v.name,
            unit: v.unit,
            measureValue: v.measureValue,
            measureUnit: v.measureUnit,
            quantity: v.quantity || 0,
            costPrice: v.costPrice,
            sellingPrice: v.sellingPrice,
            reorderThreshold: v.reorderThreshold || 0,
            status:
              (v.quantity || 0) > (v.reorderThreshold || 0)
                ? StockStatus.HEALTHY
                : (v.quantity || 0) > 0
                ? StockStatus.LOW
                : StockStatus.OUT_OF_STOCK,
            packaging: {
              create:
                v.packaging?.map((p: any) => ({
                  name: p.name,
                  quantityPerUnit: p.quantityPerUnit,
                  barcode: p.barcode,
                  costPrice: p.costPrice,
                  sellingPrice: p.sellingPrice,
                })) || [],
            },
          })),
        },
      },
      include: { variants: { include: { packaging: true } } },
    });
  }

  async update(id: string, dto: UpdateProductDto, organizationId: string) {
    const product = await this.prisma.db.product.findFirst({
      where: { id, organizationId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.db.product.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        description: (dto as any).description,
      },
      include: { variants: { include: { packaging: true } } },
    });
  }

  async updateVariant(
    variantId: string,
    dto: UpdateVariantDto,
    organizationId: string,
  ) {
    const variant = await this.prisma.db.inventoryItem.findFirst({
      where: { id: variantId, organizationId },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    const newQty = dto.quantity !== undefined ? dto.quantity : Number(variant.quantity);
    const newThreshold =
      dto.reorderThreshold !== undefined ? dto.reorderThreshold : Number(variant.reorderThreshold);
    const status: StockStatus =
      newQty > newThreshold ? StockStatus.HEALTHY : newQty > 0 ? StockStatus.LOW : StockStatus.OUT_OF_STOCK;

    return this.prisma.db.inventoryItem.update({
      where: { id: variantId },
      data: {
        name: dto.name,
        unit: dto.unit,
        measureValue: dto.measureValue,
        measureUnit: dto.measureUnit,
        quantity: dto.quantity,
        reorderThreshold: dto.reorderThreshold,
        costPrice: dto.costPrice,
        sellingPrice: dto.sellingPrice,
        status,
        ...(dto.packaging && {
          packaging: {
            deleteMany: {},
            create: dto.packaging,
          },
        }),
      },
      include: { packaging: true },
    });
  }

  async deleteVariant(variantId: string, organizationId: string) {
    const variant = await this.prisma.db.inventoryItem.findFirst({
      where: { id: variantId, organizationId },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return this.prisma.db.inventoryItem.update({
      where: { id: variantId },
      data: { isActive: false },
    });
  }
}
