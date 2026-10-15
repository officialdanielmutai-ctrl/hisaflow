import { ConflictException, NotFoundException } from '@nestjs/common';
import { BookingStatus, RoomIssueStatus, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { RoomsService } from './rooms.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build(opts: { activeBookings?: any[]; openIssues?: number } = {}) {
  const findMany = jest.fn(async (_args?: any) => [{ id: 'r1', organizationId: ORG, isActive: true }]);
  const findFirst = jest.fn(async (args: any) =>
    args?.where?.organizationId === ORG ? { id: args.where.id, organizationId: ORG } : null,
  );
  const create = jest.fn(async ({ data }: any) => ({ id: 'r_new', ...data }));
  const update = jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data }));
  const bookingFindMany = jest.fn(async (_args?: any) => opts.activeBookings ?? []);
  const issueFindMany = jest.fn(async (_args?: any) => [{ id: 'issue_1', roomId: 'r1' }]);
  const issueFindFirst = jest.fn(async (args: any) =>
    args?.where?.organizationId === ORG
      ? { id: args.where.id, organizationId: ORG, roomId: 'r1' }
      : null,
  );
  const issueCreate = jest.fn(async ({ data }: any) => ({ id: 'issue_new', status: 'OPEN', ...data }));
  const issueUpdate = jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data }));
  const issueCount = jest.fn(async (_args?: any) => opts.openIssues ?? 0);
  const db: any = {
    room: { findMany, findFirst, create, update },
    booking: { findMany: bookingFindMany },
    roomIssue: {
      findMany: issueFindMany,
      findFirst: issueFindFirst,
      create: issueCreate,
      update: issueUpdate,
      count: issueCount,
    },
  };
  db.$transaction = jest.fn(async (cb: any) => cb(db));
  const service = new RoomsService({ db } as unknown as PrismaService);
  return {
    service,
    findMany,
    findFirst,
    create,
    update,
    bookingFindMany,
    issueFindMany,
    issueFindFirst,
    issueCreate,
    issueUpdate,
    issueCount,
  };
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

describe('RoomsService — fault reporting', () => {
  it('records the mandatory description and marks the room OUT_OF_ORDER', async () => {
    const { service, issueCreate, update } = build();

    await service.reportIssue(
      ORG,
      'r1',
      { description: 'Air conditioner stopped working', category: 'APPLIANCE', cost: 3500 },
      { id: 'u1', name: 'Jane' },
    );

    expect(issueCreate.mock.calls[0][0].data).toMatchObject({
      organizationId: ORG,
      roomId: 'r1',
      description: 'Air conditioner stopped working',
      category: 'APPLIANCE',
      cost: 3500,
      reportedById: 'u1',
      reportedByName: 'Jane',
    });
    expect(update.mock.calls[0][0]).toMatchObject({
      where: { id: 'r1' },
      data: { status: RoomStatus.OUT_OF_ORDER },
    });
  });

  it('lists issues scoped to the org and room, open first', async () => {
    const { service, issueFindMany } = build();

    await service.listIssues(ORG, 'r1');

    expect(issueFindMany.mock.calls[0][0].where).toEqual({ organizationId: ORG, roomId: 'r1' });
  });

  it('refuses to report against a foreign room', async () => {
    const { service, issueCreate } = build();

    await expect(
      service.reportIssue(OTHER_ORG, 'r1', { description: 'Broken' }),
    ).rejects.toThrow(NotFoundException);
    expect(issueCreate).not.toHaveBeenCalled();
  });

  it('returns the room to VACANT_DIRTY once the last open issue is resolved', async () => {
    const { service, update, issueUpdate } = build({ openIssues: 0 });

    await service.resolveIssue(ORG, 'issue_1', { id: 'u1', name: 'Jane' });

    expect(issueUpdate.mock.calls[0][0].data).toMatchObject({
      status: RoomIssueStatus.RESOLVED,
      resolvedById: 'u1',
    });
    expect(update.mock.calls[0][0]).toMatchObject({
      where: { id: 'r1' },
      data: { status: RoomStatus.VACANT_DIRTY },
    });
  });

  it('keeps the room OUT_OF_ORDER while other issues remain open', async () => {
    const { service, update } = build({ openIssues: 1 });

    await service.resolveIssue(ORG, 'issue_1');

    expect(update).not.toHaveBeenCalled();
  });

  it('refuses to resolve a foreign issue', async () => {
    const { service, issueUpdate } = build();

    await expect(service.resolveIssue(OTHER_ORG, 'issue_1')).rejects.toThrow(NotFoundException);
    expect(issueUpdate).not.toHaveBeenCalled();
  });
});
