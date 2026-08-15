import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStudentDto, orgId: string) {
    return this.prisma.db.student.create({
      data: {
        ...dto,
        organizationId: orgId,
      },
    });
  }

  async findAll(orgId: string, classId?: string) {
    const where: any = { organizationId: orgId, isActive: true };
    if (classId) {
      where.classId = classId;
    }

    return this.prisma.db.student.findMany({
      where,
      include: { class: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, orgId: string) {
    return this.prisma.db.student.findFirstOrThrow({
      where: { id, organizationId: orgId },
      include: {
        class: true,
        feeInvoices: {
          include: { term: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async update(id: string, dto: CreateStudentDto, orgId: string) {
    await this.prisma.db.student.findFirstOrThrow({ where: { id, organizationId: orgId } });
    return this.prisma.db.student.update({
      where: { id },
      data: dto,
    });
  }

  async deactivate(id: string, orgId: string) {
    await this.prisma.db.student.findFirstOrThrow({ where: { id, organizationId: orgId } });
    return this.prisma.db.student.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async search(orgId: string, query: string) {
    return this.prisma.db.student.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { admissionNumber: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: { class: true },
      take: 20,
    });
  }
}
