import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { BookingStatus, RoomStatus } from '../../../generated/prisma/client';

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
