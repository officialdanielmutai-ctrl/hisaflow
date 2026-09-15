import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';
import { SubscriberStatus } from '@prisma/client';
import { RouterActionService } from '../routers/router-action.service';

@Injectable()
export class SubscribersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routerActionService: RouterActionService,
  ) {}

  async create(organizationId: string, createSubscriberDto: CreateSubscriberDto) {
    const data: any = { ...createSubscriberDto };
    if (!data.planId) {
      delete data.planId;
    }
    return this.prisma.db.subscriber.create({
      data: {
        organizationId,
        ...data,
      },
      include: {
        plan: true,
      },
    });
  }

  async findAll(organizationId: string, status?: SubscriberStatus, planId?: string) {
    return this.prisma.db.subscriber.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
        ...(planId ? { planId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const subscriber = await this.prisma.db.subscriber.findFirst({
      where: { id, organizationId },
      include: {
        plan: true,
        router: {
          select: {
            id: true,
            label: true,
            host: true,
            connectionStatus: true,
          },
        },
        _count: {
          select: {
            invoices: true,
            workOrders: true,
            tickets: true,
          },
        },
      },
    });

    if (!subscriber) {
      throw new NotFoundException(`Subscriber with ID ${id} not found`);
    }

    return subscriber;
  }

  async update(organizationId: string, id: string, updateSubscriberDto: UpdateSubscriberDto) {
    await this.findOne(organizationId, id); // Ensure exists

    const data: any = { ...updateSubscriberDto };
    if ('planId' in data) {
      data.planId = data.planId ? data.planId : null;
    }
    
    return this.prisma.db.subscriber.update({
      where: { id },
      data,
      include: {
        plan: true,
      },
    });
  }

  async updateStatus(organizationId: string, id: string, status: SubscriberStatus) {
    await this.findOne(organizationId, id); // Ensure exists
    
    return this.prisma.db.subscriber.update({
      where: { id },
      data: { status },
    });
  }

  // ── Phase 6b: Router-aware suspend / reconnect ────────────────────────────

  /** Link or update a subscriber's router and account reference */
  async linkRouter(
    organizationId: string,
    id: string,
    routerId: string,
    routerAccountRef: string,
  ) {
    await this.findOne(organizationId, id);
    return this.prisma.db.subscriber.update({
      where: { id },
      data: { routerId, routerAccountRef },
      include: { plan: true, router: { select: { id: true, label: true, host: true, connectionStatus: true } } },
    });
  }

  /** Suspend subscriber on the router (manual trigger from UI) */
  async routerSuspend(organizationId: string, id: string) {
    return this.routerActionService.suspend(organizationId, id, 'manual');
  }

  /** Reconnect subscriber on the router (manual trigger from UI) */
  async routerReconnect(organizationId: string, id: string) {
    return this.routerActionService.reconnect(organizationId, id, 'manual');
  }

  /** Returns recent RouterAction records for a subscriber (for the UI action log) */
  async getRouterActions(organizationId: string, subscriberId: string) {
    return this.prisma.db.routerAction.findMany({
      where: { organizationId, subscriberId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }
}

