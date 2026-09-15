import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { WorkOrderStatus } from '@prisma/client';

@Injectable()
export class WorkOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateWorkOrderDto) {
    // Verify subscriber exists in this org
    const subscriber = await this.prisma.db.subscriber.findFirst({
      where: { id: dto.subscriberId, organizationId },
    });
    if (!subscriber) throw new NotFoundException(`Subscriber ${dto.subscriberId} not found`);

    return this.prisma.db.workOrder.create({
      data: {
        organizationId,
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      },
      include: { subscriber: true },
    });
  }

  async findAll(organizationId: string, status?: WorkOrderStatus, subscriberId?: string) {
    return this.prisma.db.workOrder.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
        ...(subscriberId ? { subscriberId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        subscriber: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            plan: { select: { id: true, name: true, speedMbps: true } },
          },
        },
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const order = await this.prisma.db.workOrder.findFirst({
      where: { id, organizationId },
      include: {
        subscriber: true,
        equipmentUsed: { include: { item: true } },
      },
    });
    if (!order) throw new NotFoundException(`Work order ${id} not found`);
    return order;
  }

  async update(organizationId: string, id: string, dto: UpdateWorkOrderDto) {
    await this.findOne(organizationId, id);
    return this.prisma.db.workOrder.update({
      where: { id },
      data: {
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
      include: { subscriber: true },
    });
  }

  async transition(organizationId: string, id: string, status: WorkOrderStatus) {
    const order = await this.findOne(organizationId, id);

    // Basic state machine validation
    const allowed: Record<string, WorkOrderStatus[]> = {
      SCHEDULED: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
      IN_PROGRESS: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED],
    };
    const valid = allowed[order.status];
    if (!valid || !valid.includes(status)) {
      throw new BadRequestException(`Cannot transition from ${order.status} to ${status}`);
    }

    return this.prisma.db.workOrder.update({
      where: { id },
      data: {
        status,
        ...(status === WorkOrderStatus.COMPLETED ? { completedAt: new Date() } : {}),
      },
      include: { subscriber: true },
    });
  }
}
