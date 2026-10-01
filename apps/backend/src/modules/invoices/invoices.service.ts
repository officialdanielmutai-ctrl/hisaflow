import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { Prisma, InvoiceStatus } from '@prisma/client';
import { InvoiceTaxService } from '../tax/invoice-tax.service';
import { CreateInvoiceLineItemDto } from './dto/create-invoice-line-item.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceTax: InvoiceTaxService,
  ) {}

  async getDraftForBooking(organizationId: string, bookingId: string) {
    const booking = await this.prisma.db.booking.findFirst({
      where: { id: bookingId, organizationId },
      include: {
        room: true,
        consumptions: { include: { item: true } },
        invoice: { include: { lineItems: true, payments: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking not found`);
    }

    if (booking.invoice) {
      return booking.invoice;
    }

    // Generate new draft (idempotent because of the check above)
    // 1. Calculate room total
    const checkIn = booking.actualCheckIn || booking.checkInDate;
    const checkOut = booking.actualCheckOut || booking.checkOutDate;
    const diffHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
    const nights = Math.max(1, Math.ceil(diffHours / 24)); // Gap 3: Min 1 night rule
    const roomTotal = new Prisma.Decimal(nights).mul(booking.ratePerNight);

    // 2. Consumption charges stay 0: consumption is recorded as an inventory
    //    ledger without a per-transaction selling price, so priced consumption
    //    is added as explicit line items instead (which the tax factory taxes).

    // Generate the draft invoice with roomTotal.
    const invoice = await this.invoiceTax.createInvoice(this.prisma.db, {
      data: {
        organizationId,
        bookingId,
        roomTotal,
        consumptionTotal: 0,
        status: InvoiceStatus.DRAFT,
      },
      include: { lineItems: true, payments: true },
    });

    return invoice;
  }

  async issue(organizationId: string, bookingId: string) {
    const invoice = await this.getDraftForBooking(organizationId, bookingId);
    
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(`Cannot issue invoice with status ${invoice.status}`);
    }

    return this.prisma.db.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
      },
      include: { lineItems: true, payments: true },
    });
  }

  async void(organizationId: string, bookingId: string) {
    const invoice = await this.getDraftForBooking(organizationId, bookingId);
    
    return this.prisma.db.invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.VOIDED },
      include: { lineItems: true, payments: true },
    });
  }

  async addLineItem(organizationId: string, bookingId: string, dto: CreateInvoiceLineItemDto) {
    const invoice = await this.getDraftForBooking(organizationId, bookingId);
    
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.VOIDED) {
      throw new BadRequestException(`Cannot add line items to a ${invoice.status} invoice`);
    }

    const qty = new Prisma.Decimal(dto.quantity);
    const price = new Prisma.Decimal(dto.unitPrice);
    const total = qty.mul(price);

    return this.prisma.db.$transaction(async (tx) => {
      await this.invoiceTax.createLineItem(tx, {
        invoiceId: invoice.id,
        description: dto.description,
        quantity: qty,
        unitPrice: price,
        total,
      });

      return tx.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: { lineItems: true, payments: true },
      });
    });
  }

  async addPayment(organizationId: string, bookingId: string, dto: CreatePaymentDto) {
    const invoice = await this.getDraftForBooking(organizationId, bookingId);
    
    const amount = new Prisma.Decimal(dto.amount);

    return this.prisma.db.$transaction(async (tx) => {
      // Create payment ledger entry
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount,
          method: dto.method,
          note: dto.note,
        },
      });

      // Update cached total
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: { increment: amount },
        },
        include: { lineItems: true, payments: true },
      });

      // Optionally auto-update status if fully paid? We can do this here or leave it to frontend.
      const totalDue = Number(updatedInvoice.roomTotal) + Number(updatedInvoice.consumptionTotal) + Number(updatedInvoice.adjustmentsTotal);
      const paid = Number(updatedInvoice.amountPaid);
      
      let newStatus = updatedInvoice.status;
      if (paid > 0 && paid < totalDue && newStatus === InvoiceStatus.ISSUED) {
        newStatus = InvoiceStatus.PARTIAL;
      } else if (paid >= totalDue && totalDue > 0) {
        newStatus = InvoiceStatus.PAID;
      }

      if (newStatus !== updatedInvoice.status) {
        return tx.invoice.update({
          where: { id: invoice.id },
          data: { status: newStatus },
          include: { lineItems: true, payments: true },
        });
      }

      return updatedInvoice;
    });
  }
}
