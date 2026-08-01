import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { AddConsumptionDto } from './dto/add-consumption.dto';
import { BookingStatus, RoomStatus, TransactionType, Prisma } from '../../../generated/prisma/client';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.db.booking.findMany({
      where: { organizationId },
      include: { room: true, guest: true },
      orderBy: { checkInDate: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const booking = await this.prisma.db.booking.findFirst({
      where: { id, organizationId },
      include: { room: true, guest: true, consumptions: { include: { item: true } } },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    return booking;
  }

  async create(organizationId: string, dto: CreateBookingDto) {
    // Check for double booking
    const overlapping = await this.prisma.db.booking.findFirst({
      where: {
        roomId: dto.roomId,
        organizationId,
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW, BookingStatus.CHECKED_OUT],
        },
        AND: [
          { checkInDate: { lt: new Date(dto.checkOutDate) } },
          { checkOutDate: { gt: new Date(dto.checkInDate) } },
        ],
      },
    });

    if (overlapping) {
      throw new ConflictException('Room is already booked for these dates.');
    }

    // Get room base rate if ratePerNight not provided
    let rate = dto.ratePerNight;
    if (rate === undefined) {
      const room = await this.prisma.db.room.findUnique({ where: { id: dto.roomId } });
      if (!room) throw new NotFoundException('Room not found');
      rate = Number(room.baseRate);
    }

    return this.prisma.db.booking.create({
      data: {
        organizationId,
        roomId: dto.roomId,
        guestId: dto.guestId,
        checkInDate: new Date(dto.checkInDate),
        checkOutDate: new Date(dto.checkOutDate),
        ratePerNight: rate,
        notes: dto.notes,
        status: BookingStatus.RESERVED,
      },
    });
  }

  async checkIn(organizationId: string, id: string) {
    const booking = await this.findOne(organizationId, id);
    if (booking.status !== BookingStatus.RESERVED) {
      throw new BadRequestException(`Cannot check in. Current status: ${booking.status}`);
    }

    return this.prisma.db.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CHECKED_IN,
          actualCheckIn: new Date(),
        },
      });
      await tx.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });
      return updated;
    });
  }

  async checkOut(organizationId: string, id: string, force: boolean = false) {
    const booking = await this.findOne(organizationId, id);
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException(`Cannot check out. Current status: ${booking.status}`);
    }

    // Check unpaid balance (Gap 6: force checkout only if owner, enforced in controller)
    const invoice = await this.prisma.db.invoice.findUnique({ where: { bookingId: id } });
    if (invoice && !force) {
      const totalDue = Number(invoice.roomTotal) + Number(invoice.consumptionTotal) + Number(invoice.adjustmentsTotal);
      const paid = Number(invoice.amountPaid);
      if (paid < totalDue) {
        throw new ConflictException(`Cannot check out. Unpaid balance: ${totalDue - paid}. Use force=true if authorized.`);
      }
    }

    return this.prisma.db.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CHECKED_OUT,
          actualCheckOut: new Date(),
        },
      });
      await tx.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.VACANT_DIRTY },
      });
      return updated;
    });
  }

  async cancel(organizationId: string, id: string) {
    const booking = await this.findOne(organizationId, id);
    if (booking.status !== BookingStatus.RESERVED) {
      throw new BadRequestException(`Cannot cancel. Current status: ${booking.status}`);
    }

    return this.prisma.db.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });
  }

  async addConsumption(organizationId: string, bookingId: string, dto: AddConsumptionDto, actorId?: string) {
    const booking = await this.findOne(organizationId, bookingId);
    
    // Gap 4: Must be checked in
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException(`Cannot add consumption. Booking status is ${booking.status}.`);
    }

    const item = await this.prisma.db.inventoryItem.findFirst({
      where: { id: dto.itemId, organizationId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    const qty = new Prisma.Decimal(dto.quantity);
    if (item.quantity.lessThan(qty)) {
      throw new ConflictException(`Not enough stock. Available: ${item.quantity}`);
    }

    // Reuse InventoryTransaction ledger logic
    return this.prisma.db.$transaction(async (tx) => {
      const updatedItem = await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          quantity: { decrement: qty },
        },
      });

      const transaction = await tx.inventoryTransaction.create({
        data: {
          organizationId,
          itemId: item.id,
          bookingId: booking.id,
          type: TransactionType.SALE,
          quantityBefore: item.quantity,
          quantityChange: qty,
          quantityAfter: updatedItem.quantity,
          actorId,
          reason: 'Guest House Consumption',
        },
      });

      // If draft invoice exists, we should invalidate it or update it?
      // The implementation plan (Gap 2) says: 
      // "Once a draft exists, totals are only updated by explicit PATCH or by adding a Payment / InvoiceLineItem"
      // Since consumption is effectively an implicit line item, we should probably let the user sync it, or update it automatically.
      // For now, we just log the transaction. Generating/refreshing the invoice will handle it.

      return transaction;
    });
  }
}
