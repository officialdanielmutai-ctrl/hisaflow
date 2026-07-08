import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { CreditService } from './credit.service';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateCreditDto } from './dto/create-credit.dto';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('finance/credits')
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  // ── Create manual credit record ───────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Post()
  create(
    @OrgContext() orgId: string,
    @Body() dto: CreateCreditDto,
  ) {
    return this.creditService.createManualCredit(orgId, dto);
  }

  // ── List all credit records ──────────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Get()
  findAll(
    @OrgContext() orgId: string,
    @Query('status') status?: 'UNPAID' | 'PARTIAL' | 'PAID',
  ) {
    return this.creditService.findAll(orgId, status);
  }

  // ── Get a single credit record ────────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Get(':id')
  findOne(@Param('id') id: string, @OrgContext() orgId: string) {
    return this.creditService.findOne(id, orgId);
  }

  // ── Record a payment against a credit ────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Post(':id/payments')
  @HttpCode(HttpStatus.OK)
  recordPayment(
    @Param('id') id: string,
    @OrgContext() orgId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.creditService.recordPayment(id, orgId, dto);
  }

  // ── Update credit notes / due date ────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @OrgContext() orgId: string,
    @Body() body: { notes?: string; dueDate?: string },
  ) {
    return this.creditService.updateCredit(id, orgId, body);
  }
}
