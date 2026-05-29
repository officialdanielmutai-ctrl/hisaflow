import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryRepository } from './inventory.repository';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { StockStatus, TransactionType } from '../../../generated/prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  private computeStatus(quantity: number, threshold: number | null): StockStatus {
    if (quantity <= 0) return StockStatus.OUT_OF_STOCK;
    if (threshold !== null && quantity <= threshold) return StockStatus.LOW;
    if (threshold !== null && quantity <= threshold * 1.5) return StockStatus.LOW;
    return StockStatus.HEALTHY;
  }

  findAll(organizationId: string) {
    return this.repository.findAll(organizationId);
  }

  async findById(id: string, organizationId: string) {
    const item = await this.repository.findById(id, organizationId);
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async create(organizationId: string, dto: CreateInventoryItemDto) {
    const initialQuantity = dto.quantity ?? 0;
    const threshold = dto.reorderThreshold ?? null;
    const status = this.computeStatus(initialQuantity, threshold);

    const created = await this.repository.create(organizationId, {
      organizationId,
      name: dto.name,
      category: dto.category ?? null,
      unit: dto.unit ?? 'units',
      quantity: initialQuantity,
      reorderThreshold: threshold,
      costPrice: dto.costPrice ?? null,
      sellingPrice: dto.sellingPrice ?? null,
      status,
      isActive: true,
    });

    if (initialQuantity > 0) {
      await this.repository.createTransaction({
        organizationId,
        itemId: created.id,
        type: TransactionType.PURCHASE,
        quantityBefore: 0,
        quantityChange: initialQuantity,
        quantityAfter: initialQuantity,
        reason: 'Initial stock',
        source: 'web',
      });
    }

    return created;
  }

  async adjustStock(organizationId: string, dto: AdjustStockDto) {
    const item = await this.findById(dto.itemId, organizationId);
    const currentQty = Number(item.quantity);
    const change = dto.quantityChange;
    let newQuantity: number;

    switch (dto.type) {
      case TransactionType.SALE:
      case TransactionType.WASTAGE:
      case TransactionType.TRANSFER:
        newQuantity = currentQty - Math.abs(change);
        break;
      case TransactionType.PURCHASE:
      case TransactionType.RETURN:
      case TransactionType.ADJUSTMENT:
        newQuantity = currentQty + Math.abs(change);
        break;
      default:
        throw new BadRequestException('Unsupported transaction type');
    }

    if (newQuantity < 0) throw new BadRequestException('Insufficient stock');

    const newStatus = this.computeStatus(
      newQuantity,
      item.reorderThreshold ? Number(item.reorderThreshold) : null,
    );

    const updated = await this.repository.updateQuantityAndStatus(
      item.id,
      organizationId,
      newQuantity,
      newStatus,
    );

    await this.repository.createTransaction({
      organizationId,
      itemId: item.id,
      type: dto.type,
      quantityBefore: currentQty,
      quantityChange: change,
      quantityAfter: newQuantity,
      reason: dto.reason ?? null,
      source: 'web',
    });

    return updated;
  }
}
