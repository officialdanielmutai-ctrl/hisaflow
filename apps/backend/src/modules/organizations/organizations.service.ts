import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationsRepository } from './organizations.repository';
import { CreateOrganizationDto, BusinessType } from './dto/create-organization.dto';
import { PrismaService } from '../../infrastructure/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateOrganizationDto, userId: string) {
    const org = await this.organizationsRepository.create({
      name: dto.name,
      businessType: dto.businessType,
      currency: dto.currency ?? 'KES',
      country: dto.country ?? 'KE',
      phone: dto.phone,
    });

    await this.prisma.db.orgMembership.create({
      data: {
        userId,
        organizationId: org.id,
        role: 'OWNER',
      },
    });

    return org;
  }

  async findById(id: string) {
    const org = await this.organizationsRepository.findById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async getOrganizationsForUser(userId: string) {
    return this.organizationsRepository.findByMemberId(userId);
  }
}
