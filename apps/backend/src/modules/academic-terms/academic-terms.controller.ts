import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AcademicTermsService } from './academic-terms.service';
import { CreateAcademicTermDto, FeeStructureItemDto } from './dto/create-academic-term.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('academic-terms')
export class AcademicTermsController {
  constructor(private readonly academicTermsService: AcademicTermsService) {}

  @Post()
  async create(
    @Body() dto: CreateAcademicTermDto,
    @OrgContext() orgId: string,
  ) {
    return this.academicTermsService.create(dto, orgId);
  }

  @Get()
  async findAll(@OrgContext() orgId: string) {
    return this.academicTermsService.findAll(orgId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @OrgContext() orgId: string,
  ) {
    return this.academicTermsService.findOne(id, orgId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: CreateAcademicTermDto,
    @OrgContext() orgId: string,
  ) {
    return this.academicTermsService.update(id, dto, orgId);
  }

  @Post(':id/activate')
  async activate(
    @Param('id') id: string,
    @OrgContext() orgId: string,
  ) {
    return this.academicTermsService.activate(id, orgId);
  }

  @Post(':id/fee-structures')
  async addFeeStructure(
    @Param('id') id: string,
    @Body() dto: FeeStructureItemDto,
    @OrgContext() orgId: string,
  ) {
    return this.academicTermsService.addFeeStructure(id, dto, orgId);
  }

  @Delete('fee-structures/:feeStructureId')
  async removeFeeStructure(
    @Param('feeStructureId') feeStructureId: string,
    @OrgContext() orgId: string,
  ) {
    return this.academicTermsService.removeFeeStructure(feeStructureId, orgId);
  }
}
