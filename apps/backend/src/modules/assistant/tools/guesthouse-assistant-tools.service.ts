import { BadRequestException, Injectable } from '@nestjs/common';
import { BookingStatus, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import { BookingsService } from '../../bookings/bookings.service';
import { GuestsService } from '../../guests/guests.service';
import { RoomsService } from '../../rooms/rooms.service';
import { InvoicesService } from '../../invoices/invoices.service';
import type { AssistantToolProvider, ToolDefinition } from '../tool.types';
import {
  asDate,
  asEnum,
  asLimit,
  asOptionalEmail,
  asOptionalEnum,
  asOptionalNonNegative,
  asOptionalString,
  asPositiveNumber,
  asRecord,
  asString,
} from './tool-args';

const ROOM_STATUSES = Object.values(RoomStatus);
const BOOKING_STATUSES = Object.values(BookingStatus);
const PAYMENT_METHODS = ['MPESA', 'CASH', 'CARD'] as const;

const GUEST_HOUSE = ['GUEST_HOUSE'];
const STAFF_ROLES = [AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF];
const MANAGER_ROLES = [AppRole.OWNER, AppRole.MANAGER];

interface InvoiceTotals {
  adjustmentsTotal: unknown;
  consumptionTotal: unknown;
  roomTotal: unknown;
  amountPaid: unknown;
}

/** Invoice total (rooms + consumption + adjustments) minus what was paid. */
function balanceOf(invoice: InvoiceTotals): number {
  const total =
    Number(invoice.roomTotal) +
    Number(invoice.consumptionTotal) +
    Number(invoice.adjustmentsTotal);
  return Math.round((total - Number(invoice.amountPaid)) * 100) / 100;
}

function nightsBetween(checkInIso: string, checkOutIso: string): number {
  const diff = new Date(checkOutIso).getTime() - new Date(checkInIso).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function kes(amount: number): string {
  return `KES ${new Intl.NumberFormat('en-KE').format(amount)}`;
}

/**
 * GUEST_HOUSE tool set (overhaul Duty 2, Phase E — remaining verticals).
 *
 * Same contract as DUKA/ISP: `read` tools run immediately, `write` tools only
 * build a proposal, and the executor commits through the same bookings /
 * guests / rooms / invoices services the manual UI uses.
 */
@Injectable()
export class GuestHouseAssistantToolsService implements AssistantToolProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    private readonly guests: GuestsService,
    private readonly rooms: RoomsService,
    private readonly invoices: InvoicesService,
  ) {}

  all(): ToolDefinition[] {
    return [
      // reads
      this.searchGuests(),
      this.listRooms(),
      this.listBookings(),
      this.getArrivalsDepartures(),
      this.getBookingInvoice(),
      // writes
      this.createGuest(),
      this.createRoom(),
      this.updateRoom(),
      this.setRoomStatus('mark_room_dirty', 'dirty', RoomStatus.VACANT_DIRTY),
      this.setRoomStatus('mark_room_clean', 'clean', RoomStatus.VACANT_CLEAN),
      this.reportRoomIssue(),
      this.createBooking(),
      this.checkInBooking(),
      this.checkOutBooking(),
      this.addConsumption(),
      this.generateBookingInvoice(),
      this.recordBookingPayment(),
      this.addInvoiceLineItem(),
    ];
  }

  // ── scoped lookups ──────────────────────────────────────────────────────
  private async findBooking(organizationId: string, id: string) {
    const booking = await this.prisma.db.booking.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        status: true,
        checkInDate: true,
        checkOutDate: true,
        actualCheckIn: true,
        actualCheckOut: true,
        ratePerNight: true,
        room: { select: { id: true, name: true, type: true, status: true } },
        guest: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!booking) {
      throw new BadRequestException(
        'No matching booking in this organization.',
      );
    }
    return booking;
  }

  private async findRoom(organizationId: string, id: string) {
    const room = await this.prisma.db.room.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        type: true,
        baseRate: true,
        status: true,
        isActive: true,
        notes: true,
      },
    });
    if (!room) {
      throw new BadRequestException(
        'No matching room in this organization.',
      );
    }
    return room;
  }

  private async findGuest(organizationId: string, id: string) {
    const guest = await this.prisma.db.guest.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true, phone: true },
    });
    if (!guest) {
      throw new BadRequestException(
        'No matching guest in this organization.',
      );
    }
    return guest;
  }

  // ── read: guests ────────────────────────────────────────────────────────
  private searchGuests(): ToolDefinition {
    return {
      name: 'search_guests',
      description:
        'Search guest-house guests by name or phone. Read-only. Use this to resolve a guest name to its ID before booking.',
      kind: 'read',
      riskLevel: 'low',
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Guest name or phone.' },
          limit: { type: 'number' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const query = asString(args.query, 'query', 100);
        const limit = asLimit(args.limit, 10);
        return this.prisma.db.guest.findMany({
          where: {
            organizationId: ctx.organizationId,
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query } },
            ],
          },
          orderBy: { name: 'asc' },
          take: limit,
          select: { id: true, name: true, phone: true, email: true },
        });
      },
    };
  }

  // ── read: rooms ─────────────────────────────────────────────────────────
  private listRooms(): ToolDefinition {
    return {
      name: 'list_rooms',
      description:
        'List the guest house\u2019s rooms with type, night rate and status. Read-only. Use this to resolve a room name to its ID before booking.',
      kind: 'read',
      riskLevel: 'low',
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ROOM_STATUSES },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const status = asOptionalEnum(args.status, 'status', ROOM_STATUSES);
        const rooms = await this.prisma.db.room.findMany({
          where: {
            organizationId: ctx.organizationId,
            isActive: true,
            ...(status ? { status } : {}),
          },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            type: true,
            baseRate: true,
            status: true,
          },
        });
        return rooms.map((room) => ({
          ...room,
          baseRate: Number(room.baseRate),
        }));
      },
    };
  }

  // ── read: bookings ──────────────────────────────────────────────────────
  private listBookings(): ToolDefinition {
    return {
      name: 'list_bookings',
      description:
        'List guest-house bookings, optionally filtered by status. Read-only. Use this to resolve a booking ID before check-in, check-out or adding charges.',
      kind: 'read',
      riskLevel: 'low',
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: BOOKING_STATUSES },
          limit: { type: 'number' },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const status = asOptionalEnum(args.status, 'status', BOOKING_STATUSES);
        const limit = asLimit(args.limit, 10);
        const bookings = await this.prisma.db.booking.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(status ? { status } : {}),
          },
          orderBy: { checkInDate: 'desc' },
          take: limit,
          select: {
            id: true,
            status: true,
            checkInDate: true,
            checkOutDate: true,
            ratePerNight: true,
            room: { select: { id: true, name: true } },
            guest: { select: { id: true, name: true, phone: true } },
          },
        });
        return bookings.map((booking) => ({
          ...booking,
          ratePerNight: Number(booking.ratePerNight),
        }));
      },
    };
  }

  // ── read: arrivals / departures ─────────────────────────────────────────
  private getArrivalsDepartures(): ToolDefinition {
    return {
      name: 'get_arrivals_departures',
      description:
        'List the guests arriving and departing on a given date. Read-only. Use the ISO date (YYYY-MM-DD); defaults are not guessed.',
      kind: 'read',
      riskLevel: 'low',
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: { date: { type: 'string', description: 'ISO date.' } },
        required: ['date'],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const day = new Date(asDate(args.date, 'date'));
        const start = new Date(
          Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
        );
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        const select = {
          id: true,
          status: true,
          room: { select: { name: true } },
          guest: { select: { name: true, phone: true } },
        } as const;
        const [arrivals, departures] = await Promise.all([
          this.prisma.db.booking.findMany({
            where: {
              organizationId: ctx.organizationId,
              checkInDate: { gte: start, lt: end },
            },
            orderBy: { checkInDate: 'asc' },
            select,
          }),
          this.prisma.db.booking.findMany({
            where: {
              organizationId: ctx.organizationId,
              checkOutDate: { gte: start, lt: end },
            },
            orderBy: { checkOutDate: 'asc' },
            select,
          }),
        ]);
        return {
          date: start.toISOString().slice(0, 10),
          arrivals,
          departures,
        };
      },
    };
  }

  // ── read: booking invoice ───────────────────────────────────────────────
  private getBookingInvoice(): ToolDefinition {
    return {
      name: 'get_booking_invoice',
      description:
        'Show an existing guest-house invoice with its line items, payments and balance. Read-only (does not create one). Use this to resolve a booking before taking payment.',
      kind: 'read',
      riskLevel: 'low',
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: { bookingId: { type: 'string' } },
        required: ['bookingId'],
        additionalProperties: false,
      },
      execute: async (raw, ctx) => {
        const args = asRecord(raw);
        const bookingId = asString(args.bookingId, 'bookingId', 100);
        await this.findBooking(ctx.organizationId, bookingId);
        const invoice = await this.prisma.db.invoice.findUnique({
          where: { bookingId },
          include: { lineItems: true, payments: true },
        });
        if (!invoice) {
          return { bookingId, invoice: null };
        }
        return {
          bookingId,
          invoiceId: invoice.id,
          status: invoice.status,
          dueDate: invoice.dueDate,
          total: Math.round(
            (Number(invoice.roomTotal) +
              Number(invoice.consumptionTotal) +
              Number(invoice.adjustmentsTotal)) *
              100,
          ) / 100,
          amountPaid: Number(invoice.amountPaid),
          balance: balanceOf(invoice),
          lineItems: invoice.lineItems.map((line) => ({
            description: line.description,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            total: Number(line.total),
          })),
          payments: invoice.payments.map((payment) => ({
            amount: Number(payment.amount),
            method: payment.method,
            recordedAt: payment.recordedAt,
          })),
        };
      },
    };
  }

  // ── write: create a guest ───────────────────────────────────────────────
  private createGuest(): ToolDefinition {
    return {
      name: 'create_guest',
      description:
        'Create a guest-house guest record. Requires approval. Create the guest before booking them.',
      kind: 'write',
      riskLevel: 'low',
      roles: STAFF_ROLES,
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          idNumber: { type: 'string' },
          email: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      },
      buildProposal: (raw) => {
        const args = asRecord(raw);
        const normalised = {
          name: asString(args.name, 'name', 200),
          phone: asOptionalString(args.phone, 'phone', 40),
          idNumber: asOptionalString(args.idNumber, 'idNumber', 60),
          email: asOptionalEmail(args.email),
          notes: asOptionalString(args.notes, 'notes', 500),
        };
        return {
          args: normalised,
          summary: `Create guest ${normalised.name}`,
          diff: { before: null, after: normalised },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.guests.create(ctx.organizationId, {
          name: asString(args.name, 'name', 200),
          phone: asOptionalString(args.phone, 'phone', 40),
          idNumber: asOptionalString(args.idNumber, 'idNumber', 60),
          email: asOptionalEmail(args.email),
          notes: asOptionalString(args.notes, 'notes', 500),
        });
      },
    };
  }

  // ── write: create a room ────────────────────────────────────────────────
  private createRoom(): ToolDefinition {
    return {
      name: 'create_room',
      description:
        'Create a guest-house room with a type and night rate. Requires approval.',
      kind: 'write',
      riskLevel: 'medium',
      roles: MANAGER_ROLES,
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string' },
          baseRate: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['name', 'type', 'baseRate'],
        additionalProperties: false,
      },
      buildProposal: (raw) => {
        const args = asRecord(raw);
        const normalised = {
          name: asString(args.name, 'name', 100),
          type: asString(args.type, 'type', 60),
          baseRate: asPositiveNumber(args.baseRate, 'baseRate'),
          notes: asOptionalString(args.notes, 'notes', 500),
        };
        return {
          args: normalised,
          summary: `Create room ${normalised.name} (${normalised.type}) at ${kes(normalised.baseRate)}/night`,
          diff: { before: null, after: normalised },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.rooms.create(ctx.organizationId, {
          name: asString(args.name, 'name', 100),
          type: asString(args.type, 'type', 60),
          baseRate: asPositiveNumber(args.baseRate, 'baseRate'),
          notes: asOptionalString(args.notes, 'notes', 500),
        });
      },
    };
  }

  // ── write: update a room ────────────────────────────────────────────────
  private updateRoom(): ToolDefinition {
    return {
      name: 'update_room',
      description:
        'Change a room\u2019s name, type, night rate or status. Requires approval.',
      kind: 'write',
      riskLevel: 'medium',
      roles: MANAGER_ROLES,
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: {
          roomId: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
          baseRate: { type: 'number' },
          status: { type: 'string', enum: ROOM_STATUSES },
          notes: { type: 'string' },
          isActive: { type: 'boolean' },
        },
        required: ['roomId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const roomId = asString(args.roomId, 'roomId', 100);
        const room = await this.findRoom(ctx.organizationId, roomId);
        const updates: {
          name?: string;
          type?: string;
          baseRate?: number;
          status?: RoomStatus;
          notes?: string;
          isActive?: boolean;
        } = {};
        const name = asOptionalString(args.name, 'name', 100);
        const type = asOptionalString(args.type, 'type', 60);
        const baseRate = asOptionalNonNegative(args.baseRate, 'baseRate');
        const status = asOptionalEnum(args.status, 'status', ROOM_STATUSES);
        const notes = asOptionalString(args.notes, 'notes', 500);
        const isActive =
          typeof args.isActive === 'boolean' ? args.isActive : undefined;
        if (name !== undefined) updates.name = name;
        if (type !== undefined) updates.type = type;
        if (baseRate !== undefined) updates.baseRate = baseRate;
        if (status !== undefined) updates.status = status;
        if (notes !== undefined) updates.notes = notes;
        if (isActive !== undefined) updates.isActive = isActive;
        if (Object.keys(updates).length === 0) {
          throw new BadRequestException('No changes were supplied.');
        }
        return {
          args: { roomId: room.id, updates },
          summary: `Update room ${room.name} (${Object.keys(updates).join(', ')})`,
          diff: { room: room.name, before: null, after: updates },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        const updates = asRecord(args.updates);
        return this.rooms.update(
          ctx.organizationId,
          asString(args.roomId, 'roomId', 100),
          {
            name: asOptionalString(updates.name, 'name', 100),
            type: asOptionalString(updates.type, 'type', 60),
            baseRate: asOptionalNonNegative(updates.baseRate, 'baseRate'),
            status: asOptionalEnum(updates.status, 'status', ROOM_STATUSES),
            notes: asOptionalString(updates.notes, 'notes', 500),
            isActive:
              typeof updates.isActive === 'boolean'
                ? updates.isActive
                : undefined,
          },
        );
      },
    };
  }

  // ── write: housekeeping room status ─────────────────────────────────────
  private setRoomStatus(
    name: string,
    verb: string,
    status: RoomStatus,
  ): ToolDefinition {
    return {
      name,
      description: `Mark a room as ${verb}. Requires approval. Use list_rooms to find the room ID.`,
      kind: 'write',
      riskLevel: 'low',
      roles: MANAGER_ROLES,
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: { roomId: { type: 'string' } },
        required: ['roomId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const roomId = asString(args.roomId, 'roomId', 100);
        const room = await this.findRoom(ctx.organizationId, roomId);
        return {
          args: { roomId: room.id },
          summary: `Mark room ${room.name} as ${verb}`,
          diff: { status: { before: room.status, after: status } },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.rooms.update(
          ctx.organizationId,
          asString(args.roomId, 'roomId', 100),
          { status },
        );
      },
    };
  }

  // ── write: report a room fault ──────────────────────────────────────────
  private reportRoomIssue(): ToolDefinition {
    return {
      name: 'report_room_issue',
      description:
        'Report a broken or faulty room. The description of what broke is required and the optional cost is the repair cost; reporting takes the room out of service. Requires approval. Use list_rooms first.',
      kind: 'write',
      riskLevel: 'medium',
      roles: MANAGER_ROLES,
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: {
          roomId: { type: 'string' },
          description: { type: 'string', description: 'What broke (required).' },
          category: {
            type: 'string',
            enum: ['REPAIR', 'PLUMBING', 'ELECTRICAL', 'APPLIANCE', 'CLEANING', 'OTHER'],
          },
          cost: { type: 'number', description: 'Repair cost, if known.' },
        },
        required: ['roomId', 'description'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const roomId = asString(args.roomId, 'roomId', 100);
        const description = asString(args.description, 'description', 1000);
        const category = asOptionalString(args.category, 'category', 30);
        const cost = asOptionalNonNegative(args.cost, 'cost');
        const room = await this.findRoom(ctx.organizationId, roomId);
        return {
          args: { roomId: room.id, description, category, cost },
          summary: `Report a fault in room ${room.name} and take it out of service`,
          diff: {
            status: { before: room.status, after: RoomStatus.OUT_OF_ORDER },
            fault: { before: null, after: description },
            ...(cost !== undefined ? { cost: { before: null, after: kes(cost) } } : {}),
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.rooms.reportIssue(
          ctx.organizationId,
          asString(args.roomId, 'roomId', 100),
          {
            description: asString(args.description, 'description', 1000),
            category: asOptionalString(args.category, 'category', 30),
            cost: asOptionalNonNegative(args.cost, 'cost'),
          },
          { id: ctx.userId },
        );
      },
    };
  }

  // ── write: create a booking ─────────────────────────────────────────────
  private createBooking(): ToolDefinition {
    return {
      name: 'create_booking',
      description:
        'Create a room booking for an existing guest. Requires approval. Use search_guests and list_rooms first; if the guest does not exist, create them first.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: {
          roomId: { type: 'string' },
          guestId: { type: 'string' },
          checkInDate: { type: 'string', description: 'ISO date.' },
          checkOutDate: { type: 'string', description: 'ISO date.' },
          ratePerNight: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['roomId', 'guestId', 'checkInDate', 'checkOutDate'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const room = await this.findRoom(
          ctx.organizationId,
          asString(args.roomId, 'roomId', 100),
        );
        const guest = await this.findGuest(
          ctx.organizationId,
          asString(args.guestId, 'guestId', 100),
        );
        const checkInDate = asDate(args.checkInDate, 'checkInDate');
        const checkOutDate = asDate(args.checkOutDate, 'checkOutDate');
        if (new Date(checkOutDate) <= new Date(checkInDate)) {
          throw new BadRequestException(
            '"checkOutDate" must be after "checkInDate".',
          );
        }
        const ratePerNight =
          asOptionalNonNegative(args.ratePerNight, 'ratePerNight') ??
          Number(room.baseRate);
        const nights = nightsBetween(checkInDate, checkOutDate);
        const normalised = {
          roomId: room.id,
          guestId: guest.id,
          checkInDate,
          checkOutDate,
          ratePerNight,
          notes: asOptionalString(args.notes, 'notes', 500),
        };
        return {
          args: normalised,
          summary: `Book ${room.name} for ${guest.name} (${nights} night${
            nights > 1 ? 's' : ''
          }, ${kes(ratePerNight * nights)})`,
          diff: {
            before: null,
            after: {
              guest: guest.name,
              room: room.name,
              checkInDate: checkInDate.slice(0, 10),
              checkOutDate: checkOutDate.slice(0, 10),
              ratePerNight,
              nights,
              estimatedTotal: ratePerNight * nights,
            },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.bookings.create(ctx.organizationId, {
          roomId: asString(args.roomId, 'roomId', 100),
          guestId: asString(args.guestId, 'guestId', 100),
          checkInDate: asDate(args.checkInDate, 'checkInDate'),
          checkOutDate: asDate(args.checkOutDate, 'checkOutDate'),
          ratePerNight: asOptionalNonNegative(
            args.ratePerNight,
            'ratePerNight',
          ),
          notes: asOptionalString(args.notes, 'notes', 500),
        });
      },
    };
  }

  // ── write: check in / check out ─────────────────────────────────────────
  private checkInBooking(): ToolDefinition {
    return {
      name: 'check_in_booking',
      description:
        'Check a reserved booking in and mark its room occupied. Requires approval. Use list_bookings to find the booking ID.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: { bookingId: { type: 'string' } },
        required: ['bookingId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const booking = await this.findBooking(
          ctx.organizationId,
          asString(args.bookingId, 'bookingId', 100),
        );
        if (booking.status !== BookingStatus.RESERVED) {
          throw new BadRequestException(
            `Cannot check in. Current status: ${booking.status}.`,
          );
        }
        return {
          args: { bookingId: booking.id },
          summary: `Check in ${booking.guest.name} to ${booking.room.name}`,
          diff: {
            status: { before: booking.status, after: BookingStatus.CHECKED_IN },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.bookings.checkIn(
          ctx.organizationId,
          asString(args.bookingId, 'bookingId', 100),
        );
      },
    };
  }

  private checkOutBooking(): ToolDefinition {
    return {
      name: 'check_out_booking',
      description:
        'Check a checked-in booking out and mark its room dirty. Requires approval. Outstanding balances block check-out (force is not available to the assistant).',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: { bookingId: { type: 'string' } },
        required: ['bookingId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const booking = await this.findBooking(
          ctx.organizationId,
          asString(args.bookingId, 'bookingId', 100),
        );
        if (booking.status !== BookingStatus.CHECKED_IN) {
          throw new BadRequestException(
            `Cannot check out. Current status: ${booking.status}.`,
          );
        }
        const invoice = await this.prisma.db.invoice.findUnique({
          where: { bookingId: booking.id },
        });
        const balance = invoice ? balanceOf(invoice) : 0;
        return {
          args: { bookingId: booking.id },
          summary: `Check out ${booking.guest.name} from ${booking.room.name}${
            balance > 0 ? ` \u2014 ${kes(balance)} outstanding` : ''
          }`,
          diff: {
            status: { before: booking.status, after: BookingStatus.CHECKED_OUT },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.bookings.checkOut(
          ctx.organizationId,
          asString(args.bookingId, 'bookingId', 100),
          false,
        );
      },
    };
  }

  // ── write: add consumption ──────────────────────────────────────────────
  private addConsumption(): ToolDefinition {
    return {
      name: 'add_consumption',
      description:
        'Charge an inventory item (drinks, snacks) to a checked-in booking, deducting stock. Requires approval. Use search_inventory for the item ID and list_bookings for the booking ID.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: {
          bookingId: { type: 'string' },
          itemId: { type: 'string' },
          quantity: { type: 'number' },
        },
        required: ['bookingId', 'itemId', 'quantity'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const booking = await this.findBooking(
          ctx.organizationId,
          asString(args.bookingId, 'bookingId', 100),
        );
        if (booking.status !== BookingStatus.CHECKED_IN) {
          throw new BadRequestException(
            `Cannot add consumption. Booking status is ${booking.status}.`,
          );
        }
        const item = await this.prisma.db.inventoryItem.findFirst({
          where: {
            id: asString(args.itemId, 'itemId', 100),
            organizationId: ctx.organizationId,
          },
          select: { id: true, name: true, unit: true, quantity: true },
        });
        if (!item) {
          throw new BadRequestException(
            'No matching item in this organization.',
          );
        }
        const quantity = asPositiveNumber(args.quantity, 'quantity');
        const before = Number(item.quantity);
        if (before < quantity) {
          throw new BadRequestException(
            `Not enough stock for ${item.name}. Available: ${before}.`,
          );
        }
        return {
          args: { bookingId: booking.id, itemId: item.id, quantity },
          summary: `Add ${quantity} ${item.unit} of ${item.name} to ${booking.guest.name}\u2019s room`,
          diff: { item: item.name, quantity: { before, after: before - quantity } },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.bookings.addConsumption(
          ctx.organizationId,
          asString(args.bookingId, 'bookingId', 100),
          {
            itemId: asString(args.itemId, 'itemId', 100),
            quantity: asPositiveNumber(args.quantity, 'quantity'),
          },
          ctx.userId,
        );
      },
    };
  }

  // ── write: invoice / payment / line items ───────────────────────────────
  private generateBookingInvoice(): ToolDefinition {
    return {
      name: 'generate_booking_invoice',
      description:
        'Generate (or fetch) the draft invoice for a booking. Requires approval. Idempotent: an existing invoice is returned, never duplicated.',
      kind: 'write',
      riskLevel: 'low',
      roles: STAFF_ROLES,
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: { bookingId: { type: 'string' } },
        required: ['bookingId'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const booking = await this.findBooking(
          ctx.organizationId,
          asString(args.bookingId, 'bookingId', 100),
        );
        const checkIn = booking.actualCheckIn ?? booking.checkInDate;
        const checkOut = booking.actualCheckOut ?? booking.checkOutDate;
        const nights = nightsBetween(
          checkIn.toISOString(),
          checkOut.toISOString(),
        );
        const roomTotal = Number(booking.ratePerNight) * nights;
        return {
          args: { bookingId: booking.id },
          summary: `Generate invoice for ${booking.guest.name} (${nights} night${
            nights > 1 ? 's' : ''
          }, ${kes(roomTotal)})`,
          diff: {
            before: null,
            after: {
              guest: booking.guest.name,
              room: booking.room.name,
              nights,
              roomTotal,
            },
          },
          riskLevel: 'low',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.invoices.getDraftForBooking(
          ctx.organizationId,
          asString(args.bookingId, 'bookingId', 100),
        );
      },
    };
  }

  private recordBookingPayment(): ToolDefinition {
    return {
      name: 'record_booking_payment',
      description:
        'Record a payment against a booking\u2019s invoice (creating the draft if needed). Requires approval. Use get_booking_invoice or list_bookings to find the booking ID.',
      kind: 'write',
      riskLevel: 'medium',
      roles: STAFF_ROLES,
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: {
          bookingId: { type: 'string' },
          amount: { type: 'number' },
          method: { type: 'string', enum: [...PAYMENT_METHODS] },
          note: { type: 'string' },
        },
        required: ['bookingId', 'amount', 'method'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const booking = await this.findBooking(
          ctx.organizationId,
          asString(args.bookingId, 'bookingId', 100),
        );
        const amount = asPositiveNumber(args.amount, 'amount');
        const method = asEnum(args.method, 'method', PAYMENT_METHODS);
        const note = asOptionalString(args.note, 'note', 300);
        const invoice = await this.prisma.db.invoice.findUnique({
          where: { bookingId: booking.id },
        });
        const normalised = { bookingId: booking.id, amount, method, note };
        if (invoice) {
          const before = balanceOf(invoice);
          return {
            args: normalised,
            summary: `Record ${method} payment of ${kes(amount)} for ${
              booking.guest.name
            }`,
            diff: {
              balance: {
                before,
                after: Math.round((before - amount) * 100) / 100,
              },
            },
            riskLevel: 'medium',
          };
        }
        return {
          args: normalised,
          summary: `Record ${method} payment of ${kes(amount)} for ${
            booking.guest.name
          }`,
          diff: { before: null, after: { payment: amount, method } },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.invoices.addPayment(
          ctx.organizationId,
          asString(args.bookingId, 'bookingId', 100),
          {
            amount: asPositiveNumber(args.amount, 'amount'),
            method: asEnum(args.method, 'method', PAYMENT_METHODS),
            note: asOptionalString(args.note, 'note', 300),
          },
        );
      },
    };
  }

  private addInvoiceLineItem(): ToolDefinition {
    return {
      name: 'add_invoice_line_item',
      description:
        'Add a priced charge (extra bed, laundry, damages) to a booking\u2019s invoice. Requires approval.',
      kind: 'write',
      riskLevel: 'medium',
      roles: MANAGER_ROLES,
      verticals: GUEST_HOUSE,
      parameters: {
        type: 'object',
        properties: {
          bookingId: { type: 'string' },
          description: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
        },
        required: ['bookingId', 'description', 'quantity', 'unitPrice'],
        additionalProperties: false,
      },
      buildProposal: async (raw, ctx) => {
        const args = asRecord(raw);
        const booking = await this.findBooking(
          ctx.organizationId,
          asString(args.bookingId, 'bookingId', 100),
        );
        const description = asString(args.description, 'description', 200);
        const quantity = asPositiveNumber(args.quantity, 'quantity');
        const unitPrice = asOptionalNonNegative(args.unitPrice, 'unitPrice') ?? 0;
        const normalised = {
          bookingId: booking.id,
          description,
          quantity,
          unitPrice,
        };
        return {
          args: normalised,
          summary: `Add ${description} (${kes(quantity * unitPrice)}) to ${
            booking.guest.name
          }\u2019s invoice`,
          diff: {
            before: null,
            after: { ...normalised, total: quantity * unitPrice },
          },
          riskLevel: 'medium',
        };
      },
      commit: async (raw, ctx) => {
        const args = asRecord(raw);
        return this.invoices.addLineItem(
          ctx.organizationId,
          asString(args.bookingId, 'bookingId', 100),
          {
            description: asString(args.description, 'description', 200),
            quantity: asPositiveNumber(args.quantity, 'quantity'),
            unitPrice: asOptionalNonNegative(args.unitPrice, 'unitPrice') ?? 0,
          },
        );
      },
    };
  }
}
