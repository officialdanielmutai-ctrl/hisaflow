import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { Prisma } from '../../../generated/prisma/client';

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.OrganizationCreateInput) {
    return this.prisma.db.organization.create({ data });
  }

  async findById(id: string) {
    return this.prisma.db.organization.findUnique({
      where: { id },
      include: { users: true },
    });
  }

  async findByMemberId(userId: string) {
    return this.prisma.db.orgMembership.findMany({
      where: { userId },
      include: { organization: true },
    });
  }
}
