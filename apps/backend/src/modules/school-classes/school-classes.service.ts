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
        orgId,
      },
    });
  }

  async findAll(orgId: string) {
    return this.prisma.db.schoolClass.findMany({
      where: { orgId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, orgId: string) {
    return this.prisma.db.schoolClass.findUniqueOrThrow({
      where: { id_orgId: { id, orgId } },
    });
  }

  async update(id: string, dto: CreateSchoolClassDto, orgId: string) {
    return this.prisma.db.schoolClass.update({
      where: { id_orgId: { id, orgId } },
      data: dto,
    });
  }

  async deactivate(id: string, orgId: string) {
    return this.prisma.db.schoolClass.update({
      where: { id_orgId: { id, orgId } },
      data: { isActive: false },
    });
  }
}
