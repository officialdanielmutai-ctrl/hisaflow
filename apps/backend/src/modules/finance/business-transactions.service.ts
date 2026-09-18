import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateBusinessTransactionDto } from './dto/create-business-transaction.dto';
import { UpdateBusinessTransactionDto } from './dto/update-business-transaction.dto';

export interface BusinessTransactionRecord {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string | null;
  staffName: string | null;
  date: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  createdAt: string;
}

@Injectable()
export class BusinessTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  mapBusinessTx(record: any): BusinessTransactionRecord {
    return {
      id: record.id,
      type: record.type as 'INCOME' | 'EXPENSE',
      category: record.category,
      amount: Number(record.amount),
      description: record.description,
      staffName: record.staffName,
      date: record.date instanceof Date ? record.date.toISOString().slice(0, 10) : record.date,
      isRecurring: record.isRecurring,
      recurrenceRule: record.recurrenceRule,
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    };
  }

  async createBusinessTransaction(
    organizationId: string,
    dto: CreateBusinessTransactionDto,
  ): Promise<BusinessTransactionRecord> {
    const record = await this.prisma.db.businessTransaction.create({
      data: {
        organizationId,
        type: dto.type,
        category: dto.category,
        amount: dto.amount,
        description: dto.description ?? null,
        staffName: dto.staffName ?? null,
        date: dto.date ? new Date(dto.date) : new Date(),
        isRecurring: dto.isRecurring ?? false,
        recurrenceRule: dto.recurrenceRule ?? null,
      },
    });
    return this.mapBusinessTx(record);
  }

  async getBusinessTransactions(
    organizationId: string,
    filters?: {
      type?: 'INCOME' | 'EXPENSE';
      category?: string;
      from?: string;
      to?: string;
    },
  ): Promise<BusinessTransactionRecord[]> {
    const where: any = { organizationId };
    if (filters?.type) where.type = filters.type;
    if (filters?.category) where.category = filters.category;
    if (filters?.from || filters?.to) {
      where.date = {};
      if (filters.from) where.date.gte = new Date(filters.from);
      if (filters.to) where.date.lte = new Date(filters.to);
    }
    const records = await this.prisma.db.businessTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 200,
    });
    return records.map(r => this.mapBusinessTx(r));
  }

  async deleteBusinessTransaction(
    id: string,
    organizationId: string,
  ): Promise<void> {
    await this.prisma.db.businessTransaction.deleteMany({
      where: { id, organizationId },
    });
  }

  async updateBusinessTransaction(
    id: string,
    organizationId: string,
    dto: UpdateBusinessTransactionDto,
  ): Promise<BusinessTransactionRecord> {
    // Verify ownership first
    const existing = await this.prisma.db.businessTransaction.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new Error('Transaction not found');

    const data: any = {};
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.staffName !== undefined) data.staffName = dto.staffName;
    if (dto.isRecurring !== undefined) data.isRecurring = dto.isRecurring;
    if (dto.recurrenceRule !== undefined) data.recurrenceRule = dto.recurrenceRule;
    if (dto.date !== undefined) data.date = new Date(dto.date);

    const updated = await this.prisma.db.businessTransaction.update({
      where: { id },
      data,
    });
    return this.mapBusinessTx(updated);
  }
}
