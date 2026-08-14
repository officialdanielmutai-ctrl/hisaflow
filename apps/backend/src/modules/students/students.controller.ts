import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('search')
  async search(
    @Query('q') query: string,
    @OrgContext() orgId: string,
  ) {
    return this.studentsService.search(orgId, query || '');
  }

  @Post()
  async create(
    @Body() dto: CreateStudentDto,
    @OrgContext() orgId: string,
  ) {
    return this.studentsService.create(dto, orgId);
  }

  @Get()
  async findAll(
    @Query('classId') classId: string,
    @OrgContext() orgId: string,
  ) {
    return this.studentsService.findAll(orgId, classId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @OrgContext() orgId: string,
  ) {
    return this.studentsService.findOne(id, orgId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: CreateStudentDto,
    @OrgContext() orgId: string,
  ) {
    return this.studentsService.update(id, dto, orgId);
  }

  @Delete(':id')
  async deactivate(
    @Param('id') id: string,
    @OrgContext() orgId: string,
  ) {
    return this.studentsService.deactivate(id, orgId);
  }
}
