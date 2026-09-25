import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { CreateWorkItemDto, UpdateWorkItemDto } from './dto/create-work-item.dto';
import { AdminUser, WorkItemPriority, WorkItemStatus } from '@prisma/client';

@Injectable()
export class WorkQueueService {
  private readonly logger = new Logger(WorkQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async create(
    dto: CreateWorkItemDto,
    adminUser: AdminUser,
    ipAddress?: string,
    userAgent?: string,
  ) {
    let assignedAdminName = dto.assignedToAdminName;
    if (dto.assignedToAdminId && !assignedAdminName) {
      const assigned = await this.prisma.db.adminUser.findUnique({
        where: { id: dto.assignedToAdminId },
      });
      assignedAdminName = assigned?.name;
    }

    const item = await this.prisma.db.adminWorkItem.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority || WorkItemPriority.MEDIUM,
        status: WorkItemStatus.OPEN,
        organizationId: dto.organizationId,
        organizationName: dto.organizationName,
        assignedToAdminId: dto.assignedToAdminId,
        assignedToAdminName: assignedAdminName,
        createdByAdminId: adminUser.id,
        createdByAdminName: adminUser.name,
      },
    });

    await this.auditService.write({
      adminId: adminUser.id,
      actionType: 'work_item.create',
      targetType: 'work_item',
      targetId: item.id,
      targetLabel: item.title,
      reason: `Created work item: ${item.title} (Priority: ${item.priority})`,
      metadata: { item },
      ipAddress,
      userAgent,
    });

    return item;
  }

  async findAll(params: {
    status?: WorkItemStatus;
    priority?: WorkItemPriority;
    assignedToAdminId?: string;
    organizationId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const take = Math.min(Number(params.limit || 25), 100);
    const skip = Number(params.page || 0) * take;

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    if (params.assignedToAdminId) where.assignedToAdminId = params.assignedToAdminId;
    if (params.organizationId) where.organizationId = params.organizationId;
    if (params.search?.trim()) {
      where.OR = [
        { title: { contains: params.search.trim(), mode: 'insensitive' } },
        { description: { contains: params.search.trim(), mode: 'insensitive' } },
        { organizationName: { contains: params.search.trim(), mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.db.adminWorkItem.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
      }),
      this.prisma.db.adminWorkItem.count({ where }),
    ]);

    return { items, total, page: Number(params.page || 0), limit: take };
  }

  async findOne(id: string) {
    const item = await this.prisma.db.adminWorkItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Work item ${id} not found`);
    return item;
  }

  async update(
    id: string,
    dto: UpdateWorkItemDto,
    adminUser: AdminUser,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.prisma.db.adminWorkItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Work item ${id} not found`);

    // Invariant: transitioning to RESOLVED requires mandatory resolution note
    if (dto.status === WorkItemStatus.RESOLVED && !dto.resolutionNote?.trim() && !existing.resolutionNote) {
      throw new BadRequestException('A resolution note is required when marking a work item as RESOLVED');
    }

    let assignedAdminName = dto.assignedToAdminName;
    if (dto.assignedToAdminId && !assignedAdminName) {
      const assigned = await this.prisma.db.adminUser.findUnique({
        where: { id: dto.assignedToAdminId },
      });
      assignedAdminName = assigned?.name;
    }

    const data: any = {};
    if (dto.title) data.title = dto.title;
    if (dto.description) data.description = dto.description;
    if (dto.priority) data.priority = dto.priority;
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === WorkItemStatus.RESOLVED) {
        data.resolvedAt = new Date();
      }
    }
    if (dto.assignedToAdminId !== undefined) {
      data.assignedToAdminId = dto.assignedToAdminId;
      data.assignedToAdminName = assignedAdminName || null;
    }
    if (dto.resolutionNote !== undefined) {
      data.resolutionNote = dto.resolutionNote;
    }

    const updated = await this.prisma.db.adminWorkItem.update({
      where: { id },
      data,
    });

    const isStatusChange = dto.status && dto.status !== existing.status;
    const isAssignChange =
      dto.assignedToAdminId !== undefined &&
      dto.assignedToAdminId !== existing.assignedToAdminId;

    await this.auditService.write({
      adminId: adminUser.id,
      actionType: isStatusChange
        ? 'work_item.status_change'
        : isAssignChange
        ? 'work_item.reassign'
        : 'work_item.update',
      targetType: 'work_item',
      targetId: updated.id,
      targetLabel: updated.title,
      reason: isStatusChange
        ? `Status changed from ${existing.status} to ${updated.status}${dto.resolutionNote ? ': ' + dto.resolutionNote : ''}`
        : isAssignChange
        ? `Assigned to ${updated.assignedToAdminName || 'Unassigned'}`
        : `Updated work item ${updated.title}`,
      metadata: {
        before: {
          status: existing.status,
          priority: existing.priority,
          assignedTo: existing.assignedToAdminName,
        },
        after: {
          status: updated.status,
          priority: updated.priority,
          assignedTo: updated.assignedToAdminName,
        },
      },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  async listAdmins() {
    return this.prisma.db.adminUser.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
