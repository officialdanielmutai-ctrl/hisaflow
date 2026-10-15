import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CreateRoomIssueDto } from './dto/create-room-issue.dto';
import { BookingStatus, RoomIssueStatus, RoomStatus } from '@prisma/client';

export interface RoomIssueActor {
  id?: string;
  name?: string;
}

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.db.room.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const room = await this.prisma.db.room.findFirst({
      where: { id, organizationId },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    return room;
  }

  async create(organizationId: string, dto: CreateRoomDto) {
    return this.prisma.db.room.create({
      data: {
        organizationId,
        name: dto.name,
        type: dto.type,
        baseRate: dto.baseRate,
        notes: dto.notes,
        status: RoomStatus.VACANT_CLEAN,
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateRoomDto) {
    await this.findOne(organizationId, id); // Ensure it exists and belongs to org

    return this.prisma.db.room.update({
      where: { id },
      data: dto,
    });
  }

  /** All fault reports for a room, open ones first. */
  async listIssues(organizationId: string, roomId: string) {
    await this.findOne(organizationId, roomId);
    return this.prisma.db.roomIssue.findMany({
      where: { organizationId, roomId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Report a fault: records the mandatory description and optional cost, and
   * marks the room OUT_OF_ORDER so it cannot be sold until resolved.
   */
  async reportIssue(
    organizationId: string,
    roomId: string,
    dto: CreateRoomIssueDto,
    reporter?: RoomIssueActor,
  ) {
    await this.findOne(organizationId, roomId);

    return this.prisma.db.$transaction(async (tx) => {
      const issue = await tx.roomIssue.create({
        data: {
          organizationId,
          roomId,
          description: dto.description,
          category: dto.category ?? 'REPAIR',
          cost: dto.cost ?? null,
          reportedById: reporter?.id ?? null,
          reportedByName: reporter?.name ?? null,
        },
      });

      await tx.room.update({
        where: { id: roomId },
        data: { status: RoomStatus.OUT_OF_ORDER },
      });

      return issue;
    });
  }

  /**
   * Resolve a fault. When it was the room's last open issue the room returns to
   * VACANT_DIRTY (needs cleaning) rather than being sold as ready.
   */
  async resolveIssue(
    organizationId: string,
    issueId: string,
    resolver?: RoomIssueActor,
  ) {
    const issue = await this.prisma.db.roomIssue.findFirst({
      where: { id: issueId, organizationId },
    });
    if (!issue) {
      throw new NotFoundException(`Room issue with ID ${issueId} not found`);
    }

    return this.prisma.db.$transaction(async (tx) => {
      const resolved = await tx.roomIssue.update({
        where: { id: issueId },
        data: {
          status: RoomIssueStatus.RESOLVED,
          resolvedById: resolver?.id ?? null,
          resolvedAt: new Date(),
        },
      });

      const openIssues = await tx.roomIssue.count({
        where: { organizationId, roomId: issue.roomId, status: RoomIssueStatus.OPEN },
      });
      if (openIssues === 0) {
        await tx.room.update({
          where: { id: issue.roomId },
          data: { status: RoomStatus.VACANT_DIRTY },
        });
      }

      return resolved;
    });
  }

  async deactivate(organizationId: string, id: string) {
    await this.findOne(organizationId, id);

    // Check for active bookings (Gap 5)
    const activeBookings = await this.prisma.db.booking.findMany({
      where: {
        roomId: id,
        organizationId,
        status: {
          in: [BookingStatus.CHECKED_IN, BookingStatus.RESERVED],
        },
      },
      include: { guest: true },
    });

    if (activeBookings.length > 0) {
      const details = activeBookings.map(b => `${b.guest.name} (${b.status})`).join(', ');
      throw new ConflictException(
        `Cannot deactivate room. Active/reserved bookings found: ${details}`
      );
    }

    return this.prisma.db.room.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
