import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SchoolFeesService } from './school-fees.service';
import { RecordFeePaymentDto } from './dto/record-fee-payment.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('school-fees')
export class SchoolFeesController {
  constructor(private readonly schoolFeesService: SchoolFeesService) {}

  @Post('generate/:termId')
  async generateForTerm(
    @Param('termId') termId: string,
    @OrgContext() orgId: string,
  ) {
    return this.schoolFeesService.generateForTerm(termId, orgId);
  }

  @Get('invoice/:invoiceId')
  async findInvoice(
    @Param('invoiceId') invoiceId: string,
    @OrgContext() orgId: string,
  ) {
    return this.schoolFeesService.findInvoice(invoiceId, orgId);
  }

  @Post('invoice/:invoiceId/issue')
  async issueInvoice(
    @Param('invoiceId') invoiceId: string,
    @OrgContext() orgId: string,
  ) {
    return this.schoolFeesService.issueInvoice(invoiceId, orgId);
  }

  @Post('invoice/:invoiceId/void')
  async voidInvoice(
    @Param('invoiceId') invoiceId: string,
    @OrgContext() orgId: string,
  ) {
    return this.schoolFeesService.voidInvoice(invoiceId, orgId);
  }

  @Post('invoice/:invoiceId/payments')
  async recordPayment(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: RecordFeePaymentDto,
    @OrgContext() orgId: string,
  ) {
    return this.schoolFeesService.recordPayment(invoiceId, dto, orgId);
  }

  @Get('student/:studentId')
  async findByStudent(
    @Param('studentId') studentId: string,
    @OrgContext() orgId: string,
  ) {
    return this.schoolFeesService.findByStudent(studentId, orgId);
  }

  @Get('term/:termId')
  async findByTerm(
    @Param('termId') termId: string,
    @Query('status') status: string,
    @OrgContext() orgId: string,
  ) {
    return this.schoolFeesService.findByTerm(termId, orgId, status);
  }

  @Get('term/:termId/summary')
  async getTermSummary(
    @Param('termId') termId: string,
    @OrgContext() orgId: string,
  ) {
    return this.schoolFeesService.getTermSummary(termId, orgId);
  }

  @Get('term/:termId/defaulters')
  async getDefaulters(
    @Param('termId') termId: string,
    @OrgContext() orgId: string,
  ) {
    return this.schoolFeesService.getDefaulters(termId, orgId);
  }
}
