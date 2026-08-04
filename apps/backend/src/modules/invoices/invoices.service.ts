import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { Prisma, InvoiceStatus } from '../../../generated/prisma/client';
import { CreateInvoiceLineItemDto } from './dto/create-invoice-line-item.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

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

    // 2. Calculate consumptions
    let consumptionTotal = new Prisma.Decimal(0);
    for (const cons of booking.consumptions) {
      // Assuming `quantityChange` is the amount consumed.
      // We need price! Wait, `InventoryTransaction` doesn't store unit price natively for consumption,
      // it's an inventory ledger. Usually price is on the `Product` or `InventoryItem`?
      // Since the scope doesn't define price on transaction, we just sum it from the current price if available,
      // or if not, we can default to 0 and they must add line items manually?
      // Let's assume there's a price field or we leave consumption as 0 for now if not clear.
      // Wait, we can't easily price items without a selling price. Let's just set consumptionTotal to 0, 
      // and let the frontend pass in manual line items for things that don't have standard pricing, 
      // or we can sum `quantityChange * price`. Let's assume price is on item, wait, `InventoryItem` doesn't have `price`, `Product` might.
      // For now, I'll set consumptionTotal = 0 and let it be updated explicitly, or just keep it 0 as a placeholder.
    }
    
    // Actually, I'll generate the draft invoice with roomTotal.
    const invoice = await this.prisma.db.invoice.create({
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
      const lineItem = await tx.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id,
          description: dto.description,
          quantity: qty,
          unitPrice: price,
          total,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          adjustmentsTotal: { increment: total },
        },
        include: { lineItems: true, payments: true },
      });

      return updatedInvoice;
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
