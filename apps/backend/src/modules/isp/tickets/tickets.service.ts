import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateTicketDto) {
    const subscriber = await this.prisma.db.subscriber.findFirst({
      where: { id: dto.subscriberId, organizationId },
    });
    if (!subscriber) throw new NotFoundException(`Subscriber ${dto.subscriberId} not found`);

    return this.prisma.db.ticket.create({
      data: { organizationId, ...dto },
      include: { subscriber: { select: { id: true, name: true, phone: true } } },
    });
  }

  async findAll(organizationId: string, status?: TicketStatus, subscriberId?: string) {
    return this.prisma.db.ticket.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
        ...(subscriberId ? { subscriberId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { subscriber: { select: { id: true, name: true, phone: true } } },
    });
  }

  async findOne(organizationId: string, id: string) {
    const ticket = await this.prisma.db.ticket.findFirst({
      where: { id, organizationId },
      include: { subscriber: true },
    });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    return ticket;
  }

  async update(organizationId: string, id: string, dto: UpdateTicketDto) {
    await this.findOne(organizationId, id);
    return this.prisma.db.ticket.update({
      where: { id },
      data: dto,
      include: { subscriber: { select: { id: true, name: true, phone: true } } },
    });
  }

  async transition(organizationId: string, id: string, status: TicketStatus) {
    const ticket = await this.findOne(organizationId, id);

    const allowed: Record<string, TicketStatus[]> = {
      OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
      IN_PROGRESS: [TicketStatus.RESOLVED, TicketStatus.CLOSED],
      RESOLVED: [TicketStatus.CLOSED, TicketStatus.OPEN], // reopen
    };
    const valid = allowed[ticket.status];
    if (!valid || !valid.includes(status)) {
      throw new BadRequestException(`Cannot transition from ${ticket.status} to ${status}`);
    }

    return this.prisma.db.ticket.update({
      where: { id },
      data: {
        status,
        ...(status === TicketStatus.RESOLVED ? { resolvedAt: new Date() } : {}),
      },
      include: { subscriber: { select: { id: true, name: true, phone: true } } },
    });
  }
}
