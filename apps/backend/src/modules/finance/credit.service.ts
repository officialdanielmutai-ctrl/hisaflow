import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateCreditDto } from './dto/update-credit.dto';

@Injectable()
export class CreditService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List credits for an org ───────────────────────────────────────────────
  async findAll(organizationId: string, status?: 'UNPAID' | 'PARTIAL' | 'PAID') {
    const records = await this.prisma.db.creditRecord.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      include: {
        transaction: {
          include: { item: { select: { id: true, name: true, unit: true, sellingPrice: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Auto-fix stale $0 credits: if amountTotal is 0 but the linked transaction
    // item now has a price, recalculate and persist the correct amount.
    const fixes: Promise<any>[] = [];
    for (const record of records) {
      if (
        Number(record.amountTotal) === 0 &&
        record.transaction?.item?.sellingPrice != null
      ) {
        const qty = Math.abs(Number(record.transaction.quantityChange ?? 1));
        const price = Number(record.transaction.item.sellingPrice);
        const corrected = qty * price;
        if (corrected > 0) {
          (record as any).amountTotal = corrected;
          fixes.push(
            this.prisma.db.creditRecord.update({
              where: { id: record.id },
              data: { amountTotal: corrected },
            }),
          );
        }
      }
    }
    if (fixes.length > 0) await Promise.all(fixes);

    return records;
  }

  // ── Get a single credit ───────────────────────────────────────────────────
  async findOne(id: string, organizationId: string) {
    const record = await this.prisma.db.creditRecord.findFirst({
      where: { id, organizationId },
      include: {
        transaction: {
          include: { item: { select: { id: true, name: true, unit: true } } },
        },
      },
    });
    if (!record) throw new NotFoundException('Credit record not found');
    return record;
  }

  // ── Record a payment ──────────────────────────────────────────────────────
  async recordPayment(id: string, organizationId: string, dto: RecordPaymentDto) {
    const credit = await this.prisma.db.creditRecord.findFirst({
      where: { id, organizationId },
    });
    if (!credit) throw new NotFoundException('Credit record not found');

    const previousPaid = Number(credit.amountPaid);
    const newAmountPaid = previousPaid + dto.amount;
    const total = Number(credit.amountTotal);
    const isPaidOff = newAmountPaid >= total;

    // Determine updated status
    const newStatus = isPaidOff ? 'PAID' : newAmountPaid > 0 ? 'PARTIAL' : 'UNPAID';

    // Update the credit record in a transaction alongside creating a ledger income entry
    const [updatedCredit] = await this.prisma.db.$transaction([
      this.prisma.db.creditRecord.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
        },
      }),
      // Automatically log the payment as INCOME in the business ledger
      this.prisma.db.businessTransaction.create({
        data: {
          organizationId,
          type: 'INCOME',
          category: 'CREDIT_PAYMENT',
          amount: dto.amount,
          description: `Credit payment from ${credit.clientName}${dto.notes ? ` — ${dto.notes}` : ''}`,
        },
      }),
    ]);

    return updatedCredit;
  }

  // ── Update credit record (full edit) ─────────────────────────────────────
  async updateCredit(
    id: string,
    organizationId: string,
    dto: UpdateCreditDto,
  ) {
    const credit = await this.prisma.db.creditRecord.findFirst({
      where: { id, organizationId },
    });
    if (!credit) throw new NotFoundException('Credit record not found');

    const data: any = {};
    if (dto.clientName !== undefined) data.clientName = dto.clientName;
    if (dto.amountTotal !== undefined) data.amountTotal = dto.amountTotal;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.dueDate !== undefined) {
      const d = new Date(dto.dueDate);
      data.dueDate = !isNaN(d.getTime()) ? d : null;
    }

    return this.prisma.db.creditRecord.update({
      where: { id },
      data,
    });
  }

  // ── Create a credit record manually ──────────────────────────────────────────
  async createManualCredit(
    organizationId: string,
    dto: { clientName: string; amountTotal: number; dueDate?: string; notes?: string }
  ) {
    let parsedDate: Date | undefined;
    if (dto.dueDate) {
      const d = new Date(dto.dueDate);
      if (!isNaN(d.getTime())) {
        parsedDate = d;
      }
    }

    return this.prisma.db.creditRecord.create({
      data: {
        organizationId,
        clientName: dto.clientName,
        amountTotal: dto.amountTotal,
        ...(parsedDate ? { dueDate: parsedDate } : {}),
        ...(dto.notes ? { notes: dto.notes } : {}),
      },
    });
  }

  // ── Create a credit record (called by transaction service) ────────────────
  createForTransaction(
    organizationId: string,
    transactionId: string,
    clientName: string,
    amountTotal: number,
    dueDate?: string,
    notes?: string,
  ) {
    let parsedDate: Date | undefined;
    if (dueDate) {
      const d = new Date(dueDate);
      if (!isNaN(d.getTime())) {
        parsedDate = d;
      }
    }

    return this.prisma.db.creditRecord.create({
      data: {
        organizationId,
        transactionId,
        clientName,
        amountTotal,
        ...(parsedDate ? { dueDate: parsedDate } : {}),
        ...(notes ? { notes } : {}),
      },
    });
  }
}
