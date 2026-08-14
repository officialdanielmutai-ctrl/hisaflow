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
        orgId,
      },
    });
  }

  async findAll(orgId: string, classId?: string) {
    const where: any = { orgId, isActive: true };
    if (classId) {
      where.classId = classId;
    }

    return this.prisma.db.student.findMany({
      where,
      include: { schoolClass: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, orgId: string) {
    return this.prisma.db.student.findUniqueOrThrow({
      where: { id_orgId: { id, orgId } },
      include: {
        schoolClass: true,
        feeInvoices: {
          include: { term: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async update(id: string, dto: CreateStudentDto, orgId: string) {
    return this.prisma.db.student.update({
      where: { id_orgId: { id, orgId } },
      data: dto,
    });
  }

  async deactivate(id: string, orgId: string) {
    return this.prisma.db.student.update({
      where: { id_orgId: { id, orgId } },
      data: { isActive: false },
    });
  }

  async search(orgId: string, query: string) {
    return this.prisma.db.student.findMany({
      where: {
        orgId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { admissionNumber: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: { schoolClass: true },
      take: 20,
    });
  }
}
