import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { RecordFeePaymentDto } from './dto/record-fee-payment.dto';

@Injectable()
export class SchoolFeesService {
  constructor(private readonly prisma: PrismaService) {}

  async generateForTerm(termId: string, orgId: string) {
    const term = await this.prisma.db.academicTerm.findUniqueOrThrow({
      where: { id_orgId: { id: termId, orgId } },
      include: { feeStructures: true },
    });

    const students = await this.prisma.db.student.findMany({
      where: { orgId, isActive: true },
    });

    const existingInvoices = await this.prisma.db.feeInvoice.findMany({
      where: { termId, orgId },
      select: { studentId: true },
    });

    const existingStudentIds = new Set(existingInvoices.map(i => i.studentId));

    let createdCount = 0;
    let skippedCount = 0;

    for (const student of students) {
      if (existingStudentIds.has(student.id)) {
        skippedCount++;
        continue;
      }

      const applicableStructures = term.feeStructures.filter(
        fs => fs.classId === null || fs.classId === student.classId
      );

      if (applicableStructures.length === 0) {
        skippedCount++;
        continue;
      }

      const totalExpected = applicableStructures.reduce((sum, fs) => sum + fs.amount, 0);

      await this.prisma.db.feeInvoice.create({
        data: {
          orgId,
          termId,
          studentId: student.id,
          totalExpected,
          status: 'DRAFT',
          lineItems: {
            create: applicableStructures.map(fs => ({
              description: fs.name,
              amount: fs.amount,
            })),
          },
        },
      });

      createdCount++;
    }

    return { created: createdCount, skipped: skippedCount };
  }

  async findInvoice(invoiceId: string, orgId: string) {
    return this.prisma.db.feeInvoice.findUniqueOrThrow({
      where: { id_orgId: { id: invoiceId, orgId } },
      include: {
        lineItems: true,
        payments: { orderBy: { paymentDate: 'desc' } },
        student: { include: { schoolClass: true } },
        term: true,
      },
    });
  }

  async findByStudent(studentId: string, orgId: string) {
    return this.prisma.db.feeInvoice.findMany({
      where: { studentId, orgId },
      include: { term: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByTerm(termId: string, orgId: string, status?: string) {
    const where: any = { termId, orgId };
    if (status) {
      where.status = status;
    }

    return this.prisma.db.feeInvoice.findMany({
      where,
      include: {
        student: { include: { schoolClass: true } },
      },
      orderBy: { student: { name: 'asc' } },
    });
  }

  async recordPayment(invoiceId: string, dto: RecordFeePaymentDto, orgId: string) {
    return this.prisma.db.$transaction(async (tx) => {
      const invoice = await tx.feeInvoice.findUniqueOrThrow({
        where: { id_orgId: { id: invoiceId, orgId } },
      });

      if (invoice.status === 'VOIDED' || invoice.status === 'DRAFT') {
        throw new BadRequestException('Cannot pay a DRAFT or VOIDED invoice');
      }

      const payment = await tx.feePayment.create({
        data: {
          invoiceId,
          amount: dto.amount,
          method: dto.method,
          reference: dto.reference,
          note: dto.note,
        },
      });

      const newAmountPaid = invoice.amountPaid + dto.amount;
      const balance = invoice.totalExpected - invoice.adjustmentsTotal - newAmountPaid;

      let newStatus = invoice.status;
      if (balance <= 0) {
        newStatus = 'PAID';
      } else if (newAmountPaid > 0) {
        newStatus = 'PARTIAL';
      }

      await tx.feeInvoice.update({
        where: { id_orgId: { id: invoiceId, orgId } },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
        },
      });

      return payment;
    });
  }

  async addAdjustment(invoiceId: string, description: string, amount: number, isWaived: boolean, orgId: string) {
    return this.prisma.db.$transaction(async (tx) => {
      const invoice = await tx.feeInvoice.findUniqueOrThrow({
        where: { id_orgId: { id: invoiceId, orgId } },
      });

      await tx.feeLineItem.create({
        data: {
          invoiceId,
          description,
          amount,
          isWaived,
        },
      });

      let adjustmentsTotal = invoice.adjustmentsTotal;
      if (isWaived) {
        adjustmentsTotal += amount;
      }

      let totalExpected = invoice.totalExpected;
      if (!isWaived) {
        totalExpected += amount;
      }

      const balance = totalExpected - adjustmentsTotal - invoice.amountPaid;
      let newStatus = invoice.status;
      if (balance <= 0 && invoice.amountPaid > 0) {
        newStatus = 'PAID';
      } else if (invoice.amountPaid > 0) {
        newStatus = 'PARTIAL';
      }

      return tx.feeInvoice.update({
        where: { id_orgId: { id: invoiceId, orgId } },
        data: {
          totalExpected,
          adjustmentsTotal,
          status: invoice.status === 'DRAFT' || invoice.status === 'VOIDED' ? invoice.status : newStatus,
        },
      });
    });
  }

  async getTermSummary(termId: string, orgId: string) {
    const invoices = await this.prisma.db.feeInvoice.findMany({
      where: { termId, orgId, status: { not: 'VOIDED' } },
      include: {
        student: { include: { schoolClass: true } },
      },
    });

    let totalExpected = 0;
    let totalCollected = 0;
    const byClassMap = new Map<string, { className: string, totalExpected: number, totalCollected: number, studentCount: number }>();

    for (const inv of invoices) {
      const invExpected = inv.totalExpected - inv.adjustmentsTotal;
      totalExpected += invExpected;
      totalCollected += inv.amountPaid;

      const className = inv.student?.schoolClass?.name || 'Unassigned';
      if (!byClassMap.has(className)) {
        byClassMap.set(className, { className, totalExpected: 0, totalCollected: 0, studentCount: 0 });
      }

      const classStats = byClassMap.get(className)!;
      classStats.totalExpected += invExpected;
      classStats.totalCollected += inv.amountPaid;
      classStats.studentCount++;
    }

    const outstanding = totalExpected - totalCollected;
    const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

    return {
      totalExpected,
      totalCollected,
      outstanding,
      collectionRate,
      byClass: Array.from(byClassMap.values()),
    };
  }

  async getDefaulters(termId: string, orgId: string) {
    const invoices = await this.prisma.db.feeInvoice.findMany({
      where: { termId, orgId, status: { notIn: ['PAID', 'VOIDED'] } },
      include: {
        student: { include: { schoolClass: true } },
      },
      orderBy: { student: { name: 'asc' } },
    });

    return invoices.map(inv => ({
      studentId: inv.studentId,
      studentName: inv.student.name,
      className: inv.student.schoolClass?.name,
      amountPaid: inv.amountPaid,
      totalExpected: inv.totalExpected - inv.adjustmentsTotal,
      balance: (inv.totalExpected - inv.adjustmentsTotal) - inv.amountPaid,
      status: inv.status,
    }));
  }

  async issueInvoice(invoiceId: string, orgId: string) {
    const invoice = await this.prisma.db.feeInvoice.findUniqueOrThrow({
      where: { id_orgId: { id: invoiceId, orgId } },
    });

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Can only issue DRAFT invoices');
    }

    const balance = invoice.totalExpected - invoice.adjustmentsTotal - invoice.amountPaid;
    const newStatus = balance <= 0 && invoice.amountPaid > 0 ? 'PAID' : 'ISSUED';

    return this.prisma.db.feeInvoice.update({
      where: { id_orgId: { id: invoiceId, orgId } },
      data: { status: newStatus },
    });
  }

  async voidInvoice(invoiceId: string, orgId: string) {
    return this.prisma.db.feeInvoice.update({
      where: { id_orgId: { id: invoiceId, orgId } },
      data: { status: 'VOIDED' },
    });
  }
}
