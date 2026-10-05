import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TicketsService } from './tickets.service';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build(opts: { subscriberFound?: boolean; ticketStatus?: TicketStatus } = {}) {
  const subscriber = {
    findFirst: jest.fn(async (args: any) =>
      (opts.subscriberFound ?? true) && args?.where?.organizationId === ORG
        ? { id: 'sub_1', organizationId: ORG, name: 'Jane' }
        : null,
    ),
  };
  const ticket = {
    create: jest.fn(async ({ data }: any) => ({ id: 'tkt_1', ...data })),
    findMany: jest.fn(async () => []),
    findFirst: jest.fn(async (args: any) =>
      args?.where?.organizationId === ORG
        ? { id: 'tkt_1', organizationId: ORG, status: opts.ticketStatus ?? TicketStatus.OPEN }
        : null,
    ),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const db: any = { subscriber, ticket };
  return { service: new TicketsService({ db } as unknown as PrismaService), subscriber, ticket };
}

describe('ISP TicketsService', () => {
  it('creates a ticket scoped to the org after confirming the subscriber', async () => {
    const { service, subscriber, ticket } = build();

    await service.create(ORG, { subscriberId: 'sub_1', subject: 'No internet' } as any);

    expect(subscriber.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub_1', organizationId: ORG } }),
    );
    expect(ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: ORG, subscriberId: 'sub_1' }) }),
    );
  });

  it('rejects ticket creation for a subscriber outside the org', async () => {
    const { service, ticket } = build({ subscriberFound: false });

    await expect(service.create(ORG, { subscriberId: 'foreign' } as any)).rejects.toThrow(
      NotFoundException,
    );
    expect(ticket.create).not.toHaveBeenCalled();
  });

  it('lists tickets scoped to the org with optional filters', async () => {
    const { service, ticket } = build();

    await service.findAll(ORG, TicketStatus.OPEN, 'sub_1');

    expect(ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, status: TicketStatus.OPEN, subscriberId: 'sub_1' },
      }),
    );
  });

  it('throws NotFound reading a ticket from another org', async () => {
    const { service } = build();

    await expect(service.findOne(OTHER_ORG, 'tkt_1')).rejects.toThrow(NotFoundException);
  });

  it('transitions OPEN -> IN_PROGRESS', async () => {
    const { service, ticket } = build({ ticketStatus: TicketStatus.OPEN });

    await service.transition(ORG, 'tkt_1', TicketStatus.IN_PROGRESS);

    expect(ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tkt_1' }, data: { status: TicketStatus.IN_PROGRESS } }),
    );
  });

  it('stamps resolvedAt when transitioning to RESOLVED', async () => {
    const { service, ticket } = build({ ticketStatus: TicketStatus.IN_PROGRESS });

    await service.transition(ORG, 'tkt_1', TicketStatus.RESOLVED);

    const data = ticket.update.mock.calls[0][0].data;
    expect(data.status).toBe(TicketStatus.RESOLVED);
    expect(data.resolvedAt).toBeInstanceOf(Date);
  });

  it('rejects an invalid transition (OPEN -> RESOLVED)', async () => {
    const { service, ticket } = build({ ticketStatus: TicketStatus.OPEN });

    await expect(service.transition(ORG, 'tkt_1', TicketStatus.RESOLVED)).rejects.toThrow(
      BadRequestException,
    );
    expect(ticket.update).not.toHaveBeenCalled();
  });
});
