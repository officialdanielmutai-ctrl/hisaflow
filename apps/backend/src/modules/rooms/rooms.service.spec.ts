import { ConflictException, NotFoundException } from '@nestjs/common';
import { BookingStatus, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { RoomsService } from './rooms.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build(opts: { activeBookings?: any[] } = {}) {
  const findMany = jest.fn(async (_args?: any) => [{ id: 'r1', organizationId: ORG, isActive: true }]);
  const findFirst = jest.fn(async (args: any) =>
    args?.where?.organizationId === ORG ? { id: args.where.id, organizationId: ORG } : null,
  );
  const create = jest.fn(async ({ data }: any) => ({ id: 'r_new', ...data }));
  const update = jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data }));
  const bookingFindMany = jest.fn(async (_args?: any) => opts.activeBookings ?? []);
  const db: any = { room: { findMany, findFirst, create, update }, booking: { findMany: bookingFindMany } };
  const service = new RoomsService({ db } as unknown as PrismaService);
  return { service, findMany, findFirst, create, update, bookingFindMany };
}

describe('RoomsService', () => {
  it('creates a room as VACANT_CLEAN under the org', async () => {
    const { service, create } = build();

    await service.create(ORG, { name: 'Room 1', type: 'DOUBLE', baseRate: 4500 });

    expect(create.mock.calls[0][0].data).toMatchObject({
      organizationId: ORG,
      name: 'Room 1',
      status: RoomStatus.VACANT_CLEAN,
    });
  });

  it('lists only active rooms for the org', async () => {
    const { service, findMany } = build();

    await service.findAll(ORG);

    expect(findMany.mock.calls[0][0].where).toEqual({ organizationId: ORG, isActive: true });
    expectEveryCallScopedToOrg(findMany, ORG);
  });

  it('throws NotFound for a foreign room', async () => {
    const { service } = build();

    await expect(service.findOne(OTHER_ORG, 'r1')).rejects.toThrow(NotFoundException);
  });

  it('blocks deactivation when the room has active bookings', async () => {
    const { service } = build({
      activeBookings: [{ guest: { name: 'Alice' }, status: BookingStatus.CHECKED_IN }],
    });

    await expect(service.deactivate(ORG, 'r1')).rejects.toThrow(ConflictException);
  });

  it('deactivates a free room', async () => {
    const { service, update, bookingFindMany } = build();

    await service.deactivate(ORG, 'r1');

    expect(bookingFindMany.mock.calls[0][0].where).toMatchObject({
      roomId: 'r1',
      organizationId: ORG,
      status: { in: [BookingStatus.CHECKED_IN, BookingStatus.RESERVED] },
    });
    expect(update.mock.calls[0][0].data).toEqual({ isActive: false });
  });

  it('refuses to update a foreign room', async () => {
    const { service, update } = build();

    await expect(service.update(OTHER_ORG, 'r1', { name: 'X' })).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });
});
