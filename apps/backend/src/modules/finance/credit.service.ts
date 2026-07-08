import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { RecordPaymentDto } from './dto/record-payment.dto';

@Injectable()
export class CreditService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List credits for an org ───────────────────────────────────────────────
  findAll(organizationId: string, status?: 'UNPAID' | 'PARTIAL' | 'PAID') {
    return this.prisma.db.creditRecord.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      include: {
        transaction: {
          include: { item: { select: { id: true, name: true, unit: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
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

  // ── Update credit metadata ─────────────────────────────────────────────────
  async updateCredit(
    id: string,
    organizationId: string,
    body: { notes?: string; dueDate?: string },
  ) {
    const credit = await this.prisma.db.creditRecord.findFirst({
      where: { id, organizationId },
    });
    if (!credit) throw new NotFoundException('Credit record not found');

    return this.prisma.db.creditRecord.update({
      where: { id },
      data: {
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.dueDate ? { dueDate: new Date(body.dueDate) } : {}),
      },
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
