import { BadRequestException } from '@nestjs/common';
import { BookingStatus, RoomStatus } from '@prisma/client';
import { GuestHouseAssistantToolsService } from './guesthouse-assistant-tools.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import type { ToolContext, ToolDefinition } from '../tool.types';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: AppRole.OWNER,
  businessType: 'GUEST_HOUSE',
  tier: 'SOLO',
  isImpersonated: false,
} satisfies ToolContext;

const BOOKING = {
  id: 'bk_1',
  status: BookingStatus.RESERVED,
  checkInDate: new Date('2026-10-12T00:00:00.000Z'),
  checkOutDate: new Date('2026-10-14T00:00:00.000Z'),
  actualCheckIn: null,
  actualCheckOut: null,
  ratePerNight: 3500,
  room: { id: 'room_1', name: 'Room 3', type: 'Deluxe', status: 'VACANT_CLEAN' },
  guest: { id: 'guest_1', name: 'John Doe', phone: '0712' },
};

type MockFn = jest.Mock;

interface Harness {
  service: GuestHouseAssistantToolsService;
  db: {
    booking: { findFirst: MockFn; findMany: MockFn };
    room: { findFirst: MockFn; findMany: MockFn };
    guest: { findFirst: MockFn; findMany: MockFn };
    inventoryItem: { findFirst: MockFn };
    invoice: { findUnique: MockFn };
  };
  bookings: {
    create: MockFn;
    checkIn: MockFn;
    checkOut: MockFn;
    addConsumption: MockFn;
  };
  guests: { create: MockFn };
  rooms: { create: MockFn; update: MockFn; reportIssue: MockFn };
  invoices: {
    getDraftForBooking: MockFn;
    addPayment: MockFn;
    addLineItem: MockFn;
  };
  byName: (name: string) => ToolDefinition;
}

function build(): Harness {
  const db = {
    booking: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    room: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    guest: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    inventoryItem: { findFirst: jest.fn(async () => null as unknown) },
    invoice: { findUnique: jest.fn(async () => null as unknown) },
  };
  const bookings = {
    create: jest.fn(async () => ({ id: 'bk_new' })),
    checkIn: jest.fn(async () => ({ id: 'bk_1', status: 'CHECKED_IN' })),
    checkOut: jest.fn(async () => ({ id: 'bk_1', status: 'CHECKED_OUT' })),
    addConsumption: jest.fn(async () => ({ id: 'tx_1' })),
  };
  const guests = { create: jest.fn(async () => ({ id: 'guest_new' })) };
  const rooms = {
    create: jest.fn(async () => ({ id: 'room_new' })),
    update: jest.fn(async () => ({ id: 'room_1' })),
    reportIssue: jest.fn(async () => ({ id: 'issue_1', status: 'OPEN' })),
  };
  const invoices = {
    getDraftForBooking: jest.fn(async () => ({ id: 'inv_1' })),
    addPayment: jest.fn(async () => ({ id: 'inv_1' })),
    addLineItem: jest.fn(async () => ({ id: 'inv_1' })),
  };

  const service = new GuestHouseAssistantToolsService(
    { db } as never,
    bookings as never,
    guests as never,
    rooms as never,
    invoices as never,
  );
  const byName = (name: string): ToolDefinition => {
    const tool = service.all().find((entry) => entry.name === name);
    if (!tool) throw new Error(`missing tool ${name}`);
    return tool;
  };
  return {
    service,
    db,
    bookings,
    guests,
    rooms,
    invoices,
    byName,
  };
}

describe('GuestHouseAssistantToolsService vertical gating', () => {
  it('gates every guest-house tool to the GUEST_HOUSE vertical', () => {
    const { service } = build();
    const tools = service.all();
    expect(tools).toHaveLength(18);
    for (const tool of tools) {
      expect(tool.verticals).toEqual(['GUEST_HOUSE']);
    }
  });

  it('restricts room and invoice-line tools to owners and managers', () => {
    const { byName } = build();
    for (const name of [
      'create_room',
      'update_room',
      'mark_room_dirty',
      'mark_room_clean',
      'report_room_issue',
      'add_invoice_line_item',
    ]) {
      expect(byName(name).roles).toEqual([AppRole.OWNER, AppRole.MANAGER]);
    }
  });
});

describe('GuestHouseAssistantToolsService.search_guests', () => {
  it('scopes to the organization and searches name or phone', async () => {
    const h = build();
    h.db.guest.findMany.mockResolvedValue([{ id: 'guest_1', name: 'John' }]);

    const result = await h.byName('search_guests').execute?.(
      { query: 'John', limit: 5 },
      CTX,
    );

    expect(h.db.guest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org_1' }),
        take: 5,
      }),
    );
    expect(result).toEqual([{ id: 'guest_1', name: 'John' }]);
  });
});

describe('GuestHouseAssistantToolsService.list_rooms', () => {
  it('returns active rooms with a numeric night rate', async () => {
    const h = build();
    h.db.room.findMany.mockResolvedValue([
      { id: 'room_1', name: 'Room 3', baseRate: 3500, status: 'VACANT_CLEAN' },
    ]);

    const result = await h.byName('list_rooms').execute?.({}, CTX);

    expect(h.db.room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org_1', isActive: true },
      }),
    );
    expect(result).toEqual([
      { id: 'room_1', name: 'Room 3', baseRate: 3500, status: 'VACANT_CLEAN' },
    ]);
  });
});

describe('GuestHouseAssistantToolsService.list_bookings', () => {
  it('filters by status when supplied', async () => {
    const h = build();
    await h.byName('list_bookings').execute?.({ status: 'checked_in' }, CTX);
    expect(h.db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org_1', status: BookingStatus.CHECKED_IN },
      }),
    );
  });
});

describe('GuestHouseAssistantToolsService.get_arrivals_departures', () => {
  it('queries the requested day for arrivals and departures', async () => {
    const h = build();
    const result = (await h
      .byName('get_arrivals_departures')
      .execute?.({ date: '2026-10-12' }, CTX)) as { date: string };

    expect(result.date).toBe('2026-10-12');
    const arrivalWhere = h.db.booking.findMany.mock.calls[0][0].where;
    expect(arrivalWhere.checkInDate.gte).toEqual(
      new Date('2026-10-12T00:00:00.000Z'),
    );
    expect(arrivalWhere.checkInDate.lt).toEqual(
      new Date('2026-10-13T00:00:00.000Z'),
    );
    const departureWhere = h.db.booking.findMany.mock.calls[1][0].where;
    expect(departureWhere.organizationId).toBe('org_1');
    expect(departureWhere.checkOutDate.gte).toEqual(
      new Date('2026-10-12T00:00:00.000Z'),
    );
  });
});

describe('GuestHouseAssistantToolsService.get_booking_invoice', () => {
  it('returns a null invoice when none exists (never creates one)', async () => {
    const h = build();
    h.db.booking.findFirst.mockResolvedValue(BOOKING);
    h.db.invoice.findUnique.mockResolvedValue(null);

    const result = await h
      .byName('get_booking_invoice')
      .execute?.({ bookingId: 'bk_1' }, CTX);

    expect(h.db.invoice.findUnique).toHaveBeenCalledWith({
      where: { bookingId: 'bk_1' },
      include: { lineItems: true, payments: true },
    });
    expect(result).toEqual({ bookingId: 'bk_1', invoice: null });
  });

  it('computes the balance for an existing invoice', async () => {
    const h = build();
    h.db.booking.findFirst.mockResolvedValue(BOOKING);
    h.db.invoice.findUnique.mockResolvedValue({
      id: 'inv_1',
      status: 'ISSUED',
      roomTotal: 7000,
      consumptionTotal: 0,
      adjustmentsTotal: 0,
      amountPaid: 2000,
      dueDate: null,
      lineItems: [],
      payments: [],
    });

    const result = (await h
      .byName('get_booking_invoice')
      .execute?.({ bookingId: 'bk_1' }, CTX)) as { balance: number };

    expect(result.balance).toBe(5000);
  });
});

describe('GuestHouseAssistantToolsService.create_guest', () => {
  it('validates, drafts and commits with the server organization', async () => {
    const h = build();
    const tool = h.byName('create_guest');

    const draft = await tool.buildProposal?.(
      { name: '  Jane ', email: 'jane@example.com' },
      CTX,
    );
    expect(draft?.args).toMatchObject({ name: 'Jane', email: 'jane@example.com' });
    expect(h.guests.create).not.toHaveBeenCalled();

    await tool.commit?.(draft?.args ?? {}, CTX);
    expect(h.guests.create).toHaveBeenCalledWith(
      'org_1',
      expect.objectContaining({ name: 'Jane' }),
    );
  });

  it('rejects an invalid email', () => {
    const h = build();
    expect(() =>
      h
        .byName('create_guest')
        .buildProposal?.({ name: 'Jane', email: 'nope' }, CTX),
    ).toThrow(BadRequestException);
  });
});

describe('GuestHouseAssistantToolsService.create_room', () => {
  it('drafts and commits a room with a positive rate', async () => {
    const h = build();
    const tool = h.byName('create_room');

    const draft = await tool.buildProposal?.(
      { name: 'Room 9', type: 'Suite', baseRate: 5000 },
      CTX,
    );
    expect(draft?.summary).toContain('KES 5,000');
    expect(draft?.args).toMatchObject({
      name: 'Room 9',
      type: 'Suite',
      baseRate: 5000,
    });

    await tool.commit?.(draft?.args ?? {}, CTX);
    expect(h.rooms.create).toHaveBeenCalledWith(
      'org_1',
      expect.objectContaining({ name: 'Room 9', baseRate: 5000 }),
    );
  });

  it('rejects a non-positive rate', () => {
    const h = build();
    expect(() =>
      h.byName('create_room').buildProposal?.(
        { name: 'Room 9', type: 'Suite', baseRate: 0 },
        CTX,
      ),
    ).toThrow(BadRequestException);
  });
});

describe('GuestHouseAssistantToolsService.update_room', () => {
  it('rejects when no changes are supplied', async () => {
    const h = build();
    h.db.room.findFirst.mockResolvedValue({
      id: 'room_1',
      name: 'Room 3',
      baseRate: 3500,
      status: 'VACANT_CLEAN',
    });
    await expect(
      h.byName('update_room').buildProposal?.({ roomId: 'room_1' }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('commits the changed fields through RoomsService', async () => {
    const h = build();
    h.db.room.findFirst.mockResolvedValue({
      id: 'room_1',
      name: 'Room 3',
      baseRate: 3500,
      status: 'VACANT_CLEAN',
    });
    const draft = await h
      .byName('update_room')
      .buildProposal?.({ roomId: 'room_1', baseRate: 4000 }, CTX);

    expect(draft?.args).toEqual({
      roomId: 'room_1',
      updates: { baseRate: 4000 },
    });

    await h.byName('update_room').commit?.(draft?.args ?? {}, CTX);
    expect(h.rooms.update).toHaveBeenCalledWith('org_1', 'room_1', {
      baseRate: 4000,
    });
  });
});

describe('GuestHouseAssistantToolsService.mark_room_dirty', () => {
  it('projects the status change and commits it', async () => {
    const h = build();
    h.db.room.findFirst.mockResolvedValue({
      id: 'room_1',
      name: 'Room 3',
      status: 'VACANT_CLEAN',
    });

    const draft = await h
      .byName('mark_room_dirty')
      .buildProposal?.({ roomId: 'room_1' }, CTX);

    expect(draft?.diff).toEqual({
      status: { before: 'VACANT_CLEAN', after: 'VACANT_DIRTY' },
    });

    await h.byName('mark_room_dirty').commit?.({ roomId: 'room_1' }, CTX);
    expect(h.rooms.update).toHaveBeenCalledWith('org_1', 'room_1', {
      status: RoomStatus.VACANT_DIRTY,
    });
  });
});

describe('GuestHouseAssistantToolsService.create_booking', () => {
  it('computes nights and estimated total, then commits', async () => {
    const h = build();
    h.db.room.findFirst.mockResolvedValue({
      id: 'room_1',
      name: 'Room 3',
      baseRate: 3500,
    });
    h.db.guest.findFirst.mockResolvedValue({ id: 'guest_1', name: 'John Doe' });

    const draft = await h.byName('create_booking').buildProposal?.(
      {
        roomId: 'room_1',
        guestId: 'guest_1',
        checkInDate: '2026-10-12',
        checkOutDate: '2026-10-14',
      },
      CTX,
    );

    expect(draft?.summary).toContain('2 nights');
    expect(draft?.diff).toMatchObject({
      after: { nights: 2, estimatedTotal: 7000 },
    });

    await h.byName('create_booking').commit?.(draft?.args ?? {}, CTX);
    expect(h.bookings.create).toHaveBeenCalledWith(
      'org_1',
      expect.objectContaining({
        roomId: 'room_1',
        guestId: 'guest_1',
        ratePerNight: 3500,
      }),
    );
  });

  it('rejects a check-out that is not after check-in', async () => {
    const h = build();
    h.db.room.findFirst.mockResolvedValue({ id: 'room_1', name: 'Room 3', baseRate: 3500 });
    h.db.guest.findFirst.mockResolvedValue({ id: 'guest_1', name: 'John' });
    await expect(
      h.byName('create_booking').buildProposal?.(
        {
          roomId: 'room_1',
          guestId: 'guest_1',
          checkInDate: '2026-10-14',
          checkOutDate: '2026-10-12',
        },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('GuestHouseAssistantToolsService.check_in_booking', () => {
  it('refuses a booking that is not reserved', async () => {
    const h = build();
    h.db.booking.findFirst.mockResolvedValue({
      ...BOOKING,
      status: BookingStatus.CHECKED_IN,
    });
    await expect(
      h.byName('check_in_booking').buildProposal?.({ bookingId: 'bk_1' }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('projects and commits the check-in', async () => {
    const h = build();
    h.db.booking.findFirst.mockResolvedValue(BOOKING);

    const draft = await h
      .byName('check_in_booking')
      .buildProposal?.({ bookingId: 'bk_1' }, CTX);
    expect(draft?.diff).toEqual({
      status: { before: 'RESERVED', after: 'CHECKED_IN' },
    });

    await h.byName('check_in_booking').commit?.({ bookingId: 'bk_1' }, CTX);
    expect(h.bookings.checkIn).toHaveBeenCalledWith('org_1', 'bk_1');
  });
});

describe('GuestHouseAssistantToolsService.check_out_booking', () => {
  it('refuses a booking that is not checked in', async () => {
    const h = build();
    h.db.booking.findFirst.mockResolvedValue(BOOKING);
    await expect(
      h.byName('check_out_booking').buildProposal?.({ bookingId: 'bk_1' }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('warns about an outstanding balance and never forces', async () => {
    const h = build();
    h.db.booking.findFirst.mockResolvedValue({
      ...BOOKING,
      status: BookingStatus.CHECKED_IN,
    });
    h.db.invoice.findUnique.mockResolvedValue({
      roomTotal: 7000,
      consumptionTotal: 0,
      adjustmentsTotal: 0,
      amountPaid: 2000,
    });

    const draft = await h
      .byName('check_out_booking')
      .buildProposal?.({ bookingId: 'bk_1' }, CTX);
    expect(draft?.summary).toContain('KES 5,000 outstanding');

    await h.byName('check_out_booking').commit?.({ bookingId: 'bk_1' }, CTX);
    expect(h.bookings.checkOut).toHaveBeenCalledWith('org_1', 'bk_1', false);
  });
});

describe('GuestHouseAssistantToolsService.add_consumption', () => {
  it('refuses consumption on a booking that is not checked in', async () => {
    const h = build();
    h.db.booking.findFirst.mockResolvedValue(BOOKING);
    await expect(
      h.byName('add_consumption').buildProposal?.(
        { bookingId: 'bk_1', itemId: 'item_1', quantity: 1 },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('checks stock and commits with the actor id', async () => {
    const h = build();
    h.db.booking.findFirst.mockResolvedValue({
      ...BOOKING,
      status: BookingStatus.CHECKED_IN,
    });
    h.db.inventoryItem.findFirst.mockResolvedValue({
      id: 'item_1',
      name: 'Soda',
      unit: 'bottles',
      quantity: 10,
    });

    const draft = await h.byName('add_consumption').buildProposal?.(
      { bookingId: 'bk_1', itemId: 'item_1', quantity: 2 },
      CTX,
    );
    expect(draft?.diff).toEqual({
      item: 'Soda',
      quantity: { before: 10, after: 8 },
    });

    await h.byName('add_consumption').commit?.(draft?.args ?? {}, CTX);
    expect(h.bookings.addConsumption).toHaveBeenCalledWith(
      'org_1',
      'bk_1',
      { itemId: 'item_1', quantity: 2 },
      'user_1',
    );
  });

  it('refuses to charge more than is in stock', async () => {
    const h = build();
    h.db.booking.findFirst.mockResolvedValue({
      ...BOOKING,
      status: BookingStatus.CHECKED_IN,
    });
    h.db.inventoryItem.findFirst.mockResolvedValue({
      id: 'item_1',
      name: 'Soda',
      unit: 'bottles',
      quantity: 1,
    });
    await expect(
      h.byName('add_consumption').buildProposal?.(
        { bookingId: 'bk_1', itemId: 'item_1', quantity: 5 },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('GuestHouseAssistantToolsService.generate_booking_invoice', () => {
  it('estimates the room total and commits through InvoicesService', async () => {
    const h = build();
    h.db.booking.findFirst.mockResolvedValue(BOOKING);

    const draft = await h
      .byName('generate_booking_invoice')
      .buildProposal?.({ bookingId: 'bk_1' }, CTX);
    expect(draft?.diff).toMatchObject({
      after: { nights: 2, roomTotal: 7000 },
    });

    await h
      .byName('generate_booking_invoice')
      .commit?.({ bookingId: 'bk_1' }, CTX);
    expect(h.invoices.getDraftForBooking).toHaveBeenCalledWith('org_1', 'bk_1');
  });
});

describe('GuestHouseAssistantToolsService.record_booking_payment', () => {
  it('shows the balance change and commits the payment', async () => {
    const h = build();
    h.db.booking.findFirst.mockResolvedValue(BOOKING);
    h.db.invoice.findUnique.mockResolvedValue({
      roomTotal: 7000,
      consumptionTotal: 0,
      adjustmentsTotal: 0,
      amountPaid: 2000,
    });

    const draft = await h.byName('record_booking_payment').buildProposal?.(
      { bookingId: 'bk_1', amount: 3000, method: 'mpesa' },
      CTX,
    );
    expect(draft?.diff).toEqual({ balance: { before: 5000, after: 2000 } });
    expect(draft?.args).toMatchObject({ method: 'MPESA' });

    await h.byName('record_booking_payment').commit?.(draft?.args ?? {}, CTX);
    expect(h.invoices.addPayment).toHaveBeenCalledWith(
      'org_1',
      'bk_1',
      expect.objectContaining({ amount: 3000, method: 'MPESA' }),
    );
  });

  it('rejects an unknown payment method', async () => {
    const h = build();
    h.db.booking.findFirst.mockResolvedValue(BOOKING);
    await expect(
      h.byName('record_booking_payment').buildProposal?.(
        { bookingId: 'bk_1', amount: 3000, method: 'crypto' },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('GuestHouseAssistantToolsService.add_invoice_line_item', () => {
  it('computes the line total and commits it', async () => {
    const h = build();
    h.db.booking.findFirst.mockResolvedValue(BOOKING);

    const draft = await h.byName('add_invoice_line_item').buildProposal?.(
      {
        bookingId: 'bk_1',
        description: 'Laundry',
        quantity: 2,
        unitPrice: 500,
      },
      CTX,
    );
    expect(draft?.diff).toMatchObject({ after: { total: 1000 } });

    await h.byName('add_invoice_line_item').commit?.(draft?.args ?? {}, CTX);
    expect(h.invoices.addLineItem).toHaveBeenCalledWith(
      'org_1',
      'bk_1',
      expect.objectContaining({
        description: 'Laundry',
        quantity: 2,
        unitPrice: 500,
      }),
    );
  });
});

describe('GuestHouseAssistantToolsService.report_room_issue', () => {
  it('requires a description, takes the room out of service and commits through RoomsService', async () => {
    const h = build();

    await expect(
      h.byName('report_room_issue').buildProposal?.({ roomId: 'room_1' }, CTX),
    ).rejects.toThrow(BadRequestException);

    h.db.room.findFirst.mockResolvedValue({
      id: 'room_1',
      name: 'Room 3',
      type: 'Deluxe',
      baseRate: 3500,
      status: RoomStatus.VACANT_CLEAN,
      isActive: true,
      notes: null,
    });

    const draft = await h.byName('report_room_issue').buildProposal?.(
      { roomId: 'room_1', description: 'Shower is leaking', cost: 2500 },
      CTX,
    );
    expect(draft?.diff).toMatchObject({
      status: { before: RoomStatus.VACANT_CLEAN, after: RoomStatus.OUT_OF_ORDER },
    });

    await h.byName('report_room_issue').commit?.(draft?.args ?? {}, CTX);
    expect(h.rooms.reportIssue).toHaveBeenCalledWith(
      'org_1',
      'room_1',
      expect.objectContaining({ description: 'Shower is leaking', cost: 2500 }),
      { id: 'user_1' },
    );
  });
});
