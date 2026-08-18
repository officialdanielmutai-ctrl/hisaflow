import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateSchoolClassDto } from './dto/create-school-class.dto';

@Injectable()
export class SchoolClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSchoolClassDto, orgId: string) {
    return this.prisma.db.schoolClass.create({
      data: {
        ...dto,
        organizationId: orgId,
      },
    });
  }

  async findAll(orgId: string) {
    return this.prisma.db.schoolClass.findMany({
      where: { organizationId: orgId, isActive: true },
      include: {
        _count: {
          select: { students: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, orgId: string) {
    return this.prisma.db.schoolClass.findFirstOrThrow({
      where: { id, organizationId: orgId },
    });
  }

  async update(id: string, dto: CreateSchoolClassDto, orgId: string) {
    await this.prisma.db.schoolClass.findFirstOrThrow({ where: { id, organizationId: orgId } });
    return this.prisma.db.schoolClass.update({
      where: { id },
      data: dto,
    });
  }

  async deactivate(id: string, orgId: string) {
    await this.prisma.db.schoolClass.findFirstOrThrow({ where: { id, organizationId: orgId } });
    return this.prisma.db.schoolClass.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
