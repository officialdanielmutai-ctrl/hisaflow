import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CreateServicePlanDto } from './dto/create-service-plan.dto';
import { UpdateServicePlanDto } from './dto/update-service-plan.dto';

@Injectable()
export class ServicePlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateServicePlanDto) {
    return this.prisma.db.servicePlan.create({
      data: { organizationId, ...dto },
    });
  }

  async findAll(organizationId: string, activeOnly?: boolean) {
    return this.prisma.db.servicePlan.findMany({
      where: {
        organizationId,
        ...(activeOnly !== undefined ? { isActive: activeOnly } : {}),
      },
      orderBy: { price: 'asc' },
      include: { _count: { select: { subscribers: true } } },
    });
  }

  async findOne(organizationId: string, id: string) {
    const plan = await this.prisma.db.servicePlan.findFirst({
      where: { id, organizationId },
      include: {
        subscribers: { take: 20, orderBy: { createdAt: 'desc' } },
        _count: { select: { subscribers: true, invoices: true } },
      },
    });
    if (!plan) throw new NotFoundException(`Service plan ${id} not found`);
    return plan;
  }

  async update(organizationId: string, id: string, dto: UpdateServicePlanDto) {
    await this.findOne(organizationId, id);
    return this.prisma.db.servicePlan.update({
      where: { id },
      data: dto,
    });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    // Soft-delete: just deactivate
    return this.prisma.db.servicePlan.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
