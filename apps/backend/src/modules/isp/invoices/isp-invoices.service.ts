import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Prisma, InvoiceStatus } from '@prisma/client';
import { CreateIspInvoiceDto } from './dto/create-isp-invoice.dto';
import { AddIspLineItemDto } from './dto/add-isp-line-item.dto';
import { RecordIspPaymentDto } from './dto/record-isp-payment.dto';
import { RouterActionService } from '../routers/router-action.service';

@Injectable()
export class IspInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routerActionService: RouterActionService,
  ) {}

  async generateForSubscriber(organizationId: string, dto: CreateIspInvoiceDto) {
    const subscriber = await this.prisma.db.subscriber.findFirst({
      where: { id: dto.subscriberId, organizationId },
      include: { plan: true },
    });

    if (!subscriber) {
      throw new NotFoundException(`Subscriber ${dto.subscriberId} not found`);
    }

    const planId = dto.planId || subscriber.planId;
    let plan: { id: string; name: string; price: any; billingCycle: string } | null = null;
    if (planId) {
      plan = await this.prisma.db.servicePlan.findFirst({
        where: { id: planId, organizationId },
      });
    }

    const planPrice = plan ? new Prisma.Decimal(plan.price) : new Prisma.Decimal(0);

    return this.prisma.db.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          subscriberId: subscriber.id,
          planId: plan ? plan.id : null,
          roomTotal: 0,
          consumptionTotal: 0,
          adjustmentsTotal: planPrice,
          amountPaid: 0,
          status: InvoiceStatus.DRAFT,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        },
      });

      if (plan && Number(planPrice) > 0) {
        await tx.invoiceLineItem.create({
          data: {
            invoiceId: invoice.id,
            description: `${plan.name} - ${plan.billingCycle} Subscription`,
            quantity: new Prisma.Decimal(1),
            unitPrice: planPrice,
            total: planPrice,
          },
        });
      }

      return tx.invoice.findUnique({
        where: { id: invoice.id },
        include: { lineItems: true, payments: true, plan: true },
      });
    });
  }

  async findBySubscriber(organizationId: string, subscriberId: string) {
    return this.prisma.db.invoice.findMany({
      where: { organizationId, subscriberId },
      orderBy: { createdAt: 'desc' },
      include: { lineItems: true, payments: true, plan: true },
    });
  }

  async findOne(organizationId: string, id: string) {
    const invoice = await this.prisma.db.invoice.findFirst({
      where: { id, organizationId },
      include: { subscriber: true, plan: true, lineItems: true, payments: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return invoice;
  }

  async addLineItem(organizationId: string, invoiceId: string, dto: AddIspLineItemDto) {
    const invoice = await this.findOne(organizationId, invoiceId);

    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.VOIDED) {
      throw new BadRequestException(`Cannot add line item to an invoice with status ${invoice.status}`);
    }

    const qty = new Prisma.Decimal(dto.quantity);
    const unitPrice = new Prisma.Decimal(dto.unitPrice);
    const total = qty.mul(unitPrice);

    return this.prisma.db.$transaction(async (tx) => {
      await tx.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id,
          description: dto.description,
          quantity: qty,
          unitPrice,
          total,
        },
      });

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          adjustmentsTotal: { increment: total },
        },
        include: { lineItems: true, payments: true, plan: true },
      });

      return updated;
    });
  }

  async recordPayment(organizationId: string, invoiceId: string, dto: RecordIspPaymentDto) {
    const invoice = await this.findOne(organizationId, invoiceId);
    const amount = new Prisma.Decimal(dto.amount);

    const result = await this.prisma.db.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount,
          method: dto.method,
          note: dto.note,
        },
      });

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: { increment: amount },
        },
        include: { lineItems: true, payments: true, plan: true },
      });

      const totalDue = Number(updated.adjustmentsTotal) + Number(updated.consumptionTotal) + Number(updated.roomTotal);
      const paid = Number(updated.amountPaid);

      let newStatus = updated.status;
      if (paid >= totalDue && totalDue > 0) {
        newStatus = InvoiceStatus.PAID;
      } else if (paid > 0 && paid < totalDue) {
        newStatus = InvoiceStatus.PARTIAL;
      }

      let finalInvoice = updated;
      if (newStatus !== updated.status) {
        finalInvoice = await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: newStatus },
          include: { lineItems: true, payments: true, plan: true },
        });
      }

      return finalInvoice;
    });

    // Phase 6d: Auto-reconnect on payment if invoice is fully settled
    const totalDue = Number(result.adjustmentsTotal) + Number(result.consumptionTotal) + Number(result.roomTotal);
    const paid = Number(result.amountPaid);
    if (paid >= totalDue && invoice.suspendedForNonPayment && invoice.subscriberId) {
      this.routerActionService.reconnect(organizationId, invoice.subscriberId, 'billing').catch(() => {});
      await this.prisma.db.invoice.update({
        where: { id: invoice.id },
        data: { suspendedForNonPayment: false },
      }).catch(() => {});
    }

    return result;
  }

  async issue(organizationId: string, id: string) {
    const invoice = await this.findOne(organizationId, id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(`Cannot issue invoice with status ${invoice.status}`);
    }

    return this.prisma.db.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
      },
      include: { lineItems: true, payments: true, plan: true },
    });
  }

  async void(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.db.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.VOIDED },
      include: { lineItems: true, payments: true, plan: true },
    });
  }
}
