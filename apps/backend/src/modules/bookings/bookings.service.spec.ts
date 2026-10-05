import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { BookingsService } from './bookings.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';
const decimal = (value: number | string) => new Prisma.Decimal(value);

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bk1',
    organizationId: ORG,
    roomId: 'room1',
    guestId: 'g1',
    status: BookingStatus.RESERVED,
    ratePerNight: decimal('5000'),
    checkInDate: new Date('2026-02-01'),
    checkOutDate: new Date('2026-02-03'),
    ...overrides,
  };
}

function build(opts: { existing?: any; room?: any; item?: any } = {}) {
  const booking = {
    findMany: jest.fn(async (args: any) => [makeBooking()].filter((b) => b.organizationId === args?.where?.organizationId)),
    findFirst: jest.fn(async (args: any) => {
      if (args?.where && args.where.id) {
        return [makeBooking()].find((b) => b.id === args.where.id && b.organizationId === args.where.organizationId) ?? null;
      }
      return opts.existing ?? null;
    }),
    create: jest.fn(async ({ data }: any) => ({ id: 'bk_new', ...data })),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const room = {
    findUnique: jest.fn(async (_args?: any) => opts.room ?? { id: 'room1', baseRate: decimal('5000') }),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const guest = { findFirst: jest.fn() };
  const inventoryItem = {
    findFirst: jest.fn(async (args: any) =>
      args?.where?.organizationId === ORG ? opts.item ?? { id: 'item1', quantity: decimal(10) } : null,
    ),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, quantity: decimal(7), ...data })),
  };
  const inventoryTransaction = { create: jest.fn(async ({ data }: any) => ({ id: 'tx_1', ...data })) };
  const invoice = { findUnique: jest.fn(async () => null) };
  const tx = { booking, room, inventoryItem, inventoryTransaction };
  const $transaction = jest.fn(async (cb: any) => cb(tx));
  const db: any = { booking, room, guest, inventoryItem, inventoryTransaction, invoice, $transaction };
  const service = new BookingsService({ db } as unknown as PrismaService);
  return { service, booking, room, inventoryItem, inventoryTransaction, $transaction };
}

const createDto = {
  roomId: 'room1',
  guestId: 'g1',
  checkInDate: '2026-03-01',
  checkOutDate: '2026-03-03',
};

describe('BookingsService — multi-tenant isolation', () => {
  it('lists only the calling org\u2019s bookings', async () => {
    const { service, booking } = build();

    const rows = (await service.findAll(ORG)) as Array<{ organizationId: string }>;

    expect(rows).toHaveLength(1);
    expectEveryCallScopedToOrg(booking.findMany, ORG);
  });

  it('throws NotFound for a booking in another org', async () => {
    const { service, booking } = build();

    await expect(service.findOne(ORG, 'bk1')).resolves.toMatchObject({ id: 'bk1' });
    expectEveryCallScopedToOrg(booking.findFirst, ORG);

    await expect(service.findOne(OTHER_ORG, 'bk1')).rejects.toThrow(NotFoundException);
  });
});

describe('BookingsService — create and overlap guard', () => {
  it('creates a RESERVED booking stamped with the org and the supplied rate', async () => {
    const { service, booking } = build();

    await service.create(ORG, { ...createDto, ratePerNight: 4500 });

    expect(booking.create.mock.calls[0][0].data).toMatchObject({
      organizationId: ORG,
      roomId: 'room1',
      guestId: 'g1',
      ratePerNight: 4500,
      status: BookingStatus.RESERVED,
    });
  });

  it('falls back to the room base rate when none is supplied', async () => {
    const { service, room, booking } = build({ room: { id: 'room1', baseRate: decimal('5200') } });

    await service.create(ORG, createDto);

    expect(room.findUnique).toHaveBeenCalled();
    expect(booking.create.mock.calls[0][0].data.ratePerNight).toBe(5200);
  });

  it('refuses an overlapping booking in the same org', async () => {
    const { service, booking: bookingMock } = build({ existing: makeBooking() });

    await expect(service.create(ORG, createDto)).rejects.toThrow(ConflictException);
    expect(bookingMock.create).not.toHaveBeenCalled();
  });

  it('scopes the overlap lookup to the org', async () => {
    const { service, booking } = build();

    await service.create(ORG, createDto);

    const where = booking.findFirst.mock.calls[0][0].where;
    expect(where.organizationId).toBe(ORG);
    expect(where.roomId).toBe('room1');
  });

  it('BUG (reported, not fixed): room base-rate lookup ignores the organisation', async () => {
    // bookings.service.ts create() uses room.findUnique({ where: { id } }) with
    // no organizationId, so a booking in org A can read org B's room rate. The
    // test pins the current call shape so the gap is visible and tracked.
    const { service, room } = build();

    await service.create(ORG, createDto);

    expect(room.findUnique).toHaveBeenCalledWith({ where: { id: 'room1' } });
    expect(room.findUnique.mock.calls[0][0].where.organizationId).toBeUndefined();
  });
});

describe('BookingsService — check-in / check-out state machine', () => {
  it('checks in a RESERVED booking and marks the room occupied', async () => {
    const { service, room } = build();

    await service.checkIn(ORG, 'bk1');

    expect(room.update).toHaveBeenCalledWith({
      where: { id: 'room1' },
      data: { status: 'OCCUPIED' },
    });
  });

  it('rejects a check-in when the booking is not RESERVED', async () => {
    const { service, booking } = build();
    booking.findFirst.mockResolvedValueOnce(makeBooking({ status: BookingStatus.CHECKED_OUT }));

    await expect(service.checkIn(ORG, 'bk1')).rejects.toThrow(BadRequestException);
  });

  it('blocks check-out while there is an outstanding balance', async () => {
    const { service, booking } = build();
    booking.findFirst.mockResolvedValueOnce(makeBooking({ status: BookingStatus.CHECKED_IN }));
    (service as any).prisma.db.invoice.findUnique = jest.fn(async () => ({
      roomTotal: decimal('1000'),
      consumptionTotal: decimal('0'),
      adjustmentsTotal: decimal('0'),
      amountPaid: decimal('0'),
    }));

    await expect(service.checkOut(ORG, 'bk1', false)).rejects.toThrow(ConflictException);
  });

  it('permits a forced check-out despite an outstanding balance', async () => {
    const { service, booking, room } = build();
    booking.findFirst.mockResolvedValueOnce(makeBooking({ status: BookingStatus.CHECKED_IN }));

    await service.checkOut(ORG, 'bk1', true);

    expect(room.update).toHaveBeenCalledWith({
      where: { id: 'room1' },
      data: { status: 'VACANT_DIRTY' },
    });
  });

  it('cannot cancel a booking that is already checked in', async () => {
    const { service, booking } = build();
    booking.findFirst.mockResolvedValueOnce(makeBooking({ status: BookingStatus.CHECKED_IN }));

    await expect(service.cancel(ORG, 'bk1')).rejects.toThrow(BadRequestException);
  });
});

describe('BookingsService — consumption', () => {
  it('requires the booking to be checked in', async () => {
    const { service } = build();

    await expect(
      service.addConsumption(ORG, 'bk1', { itemId: 'item1', quantity: 1 }),
    ).rejects.toThrow('Cannot add consumption');
  });

  it('rejects an item that is not in the calling org', async () => {
    const { service, booking, inventoryItem } = build();
    booking.findFirst.mockResolvedValueOnce(makeBooking({ status: BookingStatus.CHECKED_IN }));
    inventoryItem.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.addConsumption(ORG, 'bk1', { itemId: 'foreign', quantity: 1 }),
    ).rejects.toThrow(NotFoundException);
    expect(inventoryItem.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign', organizationId: ORG },
    });
  });

  it('rejects consumption beyond available stock', async () => {
    const { service, booking, inventoryItem } = build({ item: { id: 'item1', quantity: decimal(1) } });
    booking.findFirst.mockResolvedValueOnce(makeBooking({ status: BookingStatus.CHECKED_IN }));
    inventoryItem.findFirst.mockResolvedValueOnce({ id: 'item1', quantity: decimal(1) });

    await expect(
      service.addConsumption(ORG, 'bk1', { itemId: 'item1', quantity: 5 }),
    ).rejects.toThrow(ConflictException);
  });

  it('decrements stock and writes the ledger row in one transaction', async () => {
    const { service, booking, inventoryItem, inventoryTransaction, $transaction } = build();
    booking.findFirst.mockResolvedValueOnce(makeBooking({ status: BookingStatus.CHECKED_IN }));

    await service.addConsumption(ORG, 'bk1', { itemId: 'item1', quantity: 3 }, 'user_1');

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(inventoryItem.update).toHaveBeenCalledWith({
      where: { id: 'item1' },
      data: { quantity: { decrement: expect.any(Prisma.Decimal) } },
    });
    expect(inventoryTransaction.create.mock.calls[0][0].data).toMatchObject({
      organizationId: ORG,
      itemId: 'item1',
      bookingId: 'bk1',
      actorId: 'user_1',
    });
  });
});
