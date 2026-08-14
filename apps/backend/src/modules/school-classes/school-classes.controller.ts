import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SchoolClassesService } from './school-classes.service';
import { CreateSchoolClassDto } from './dto/create-school-class.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('school-classes')
export class SchoolClassesController {
  constructor(private readonly schoolClassesService: SchoolClassesService) {}

  @Post()
  async create(
    @Body() dto: CreateSchoolClassDto,
    @OrgContext() orgId: string,
  ) {
    return this.schoolClassesService.create(dto, orgId);
  }

  @Get()
  async findAll(@OrgContext() orgId: string) {
    return this.schoolClassesService.findAll(orgId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @OrgContext() orgId: string,
  ) {
    return this.schoolClassesService.findOne(id, orgId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: CreateSchoolClassDto,
    @OrgContext() orgId: string,
  ) {
    return this.schoolClassesService.update(id, dto, orgId);
  }

  @Delete(':id')
  async deactivate(
    @Param('id') id: string,
    @OrgContext() orgId: string,
  ) {
    return this.schoolClassesService.deactivate(id, orgId);
  }
}
