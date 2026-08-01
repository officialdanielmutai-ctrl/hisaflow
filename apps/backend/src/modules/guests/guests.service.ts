import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';

@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.db.guest.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const guest = await this.prisma.db.guest.findFirst({
      where: { id, organizationId },
    });

    if (!guest) {
      throw new NotFoundException(`Guest with ID ${id} not found`);
    }

    return guest;
  }

  async create(organizationId: string, dto: CreateGuestDto) {
    return this.prisma.db.guest.create({
      data: {
        organizationId,
        name: dto.name,
        phone: dto.phone,
        idNumber: dto.idNumber,
        email: dto.email,
        notes: dto.notes,
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateGuestDto) {
    await this.findOne(organizationId, id); // Ensure it exists and belongs to org

    return this.prisma.db.guest.update({
      where: { id },
      data: dto,
    });
  }
}
