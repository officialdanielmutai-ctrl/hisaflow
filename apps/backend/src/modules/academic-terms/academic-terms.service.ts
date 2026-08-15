import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateAcademicTermDto, FeeStructureItemDto } from './dto/create-academic-term.dto';

@Injectable()
export class AcademicTermsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAcademicTermDto, orgId: string) {
    return this.prisma.db.$transaction(async (tx) => {
      if (dto.isActive) {
        await tx.academicTerm.updateMany({
          where: { organizationId: orgId, isActive: true },
          data: { isActive: false },
        });
      }

      const term = await tx.academicTerm.create({
        data: {
          organizationId: orgId,
          name: dto.name,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          isActive: dto.isActive ?? false,
          feeStructures: {
            create: dto.feeStructures?.map(fs => ({
              organizationId: orgId,
              classId: fs.classId,
              name: fs.name,
              amount: fs.amount,
              isOptional: fs.isOptional ?? false,
            })) || [],
          },
        },
        include: { feeStructures: true },
      });

      return term;
    });
  }

  async findAll(orgId: string) {
    return this.prisma.db.academicTerm.findMany({
      where: { organizationId: orgId },
      include: {
        _count: {
          select: { feeStructures: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: string, orgId: string) {
    return this.prisma.db.academicTerm.findFirstOrThrow({
      where: { id, organizationId: orgId },
      include: { feeStructures: true },
    });
  }

  async update(id: string, dto: CreateAcademicTermDto, orgId: string) {
    const dataToUpdate: any = {
      name: dto.name,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    };
    if (dto.dueDate) dataToUpdate.dueDate = new Date(dto.dueDate);

    await this.prisma.db.academicTerm.findFirstOrThrow({ where: { id, organizationId: orgId } });
    return this.prisma.db.academicTerm.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  async activate(id: string, orgId: string) {
    return this.prisma.db.$transaction(async (tx) => {
      await tx.academicTerm.updateMany({
        where: { organizationId: orgId, isActive: true },
        data: { isActive: false },
      });

      await tx.academicTerm.findFirstOrThrow({ where: { id, organizationId: orgId } });
      return tx.academicTerm.update({
        where: { id },
        data: { isActive: true },
      });
    });
  }

  async addFeeStructure(termId: string, dto: FeeStructureItemDto, orgId: string) {
    const term = await this.prisma.db.academicTerm.findFirstOrThrow({
      where: { id: termId, organizationId: orgId },
    });

    return this.prisma.db.feeStructure.create({
      data: {
        organizationId: orgId,
        termId: term.id,
        classId: dto.classId,
        name: dto.name,
        amount: dto.amount,
        isOptional: dto.isOptional ?? false,
      },
    });
  }

  async removeFeeStructure(feeStructureId: string, orgId: string) {
    const fs = await this.prisma.db.feeStructure.findUniqueOrThrow({
      where: { id: feeStructureId },
      include: { term: true },
    });

    if (fs.term.organizationId !== orgId) {
      throw new Error('Unauthorized');
    }

    return this.prisma.db.feeStructure.delete({
      where: { id: feeStructureId },
    });
  }
}
