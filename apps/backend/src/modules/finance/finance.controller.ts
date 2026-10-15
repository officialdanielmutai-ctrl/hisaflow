import { Controller, Get, Post, Delete, Patch, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceSearchService } from './finance-search.service';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { CreateBusinessTransactionDto } from './dto/create-business-transaction.dto';
import { UpdateBusinessTransactionDto } from './dto/update-business-transaction.dto';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly financeSearch: FinanceSearchService,
  ) {}

  // ── Inventory-only overview (legacy, kept for backward compat) ───────────
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get('overview')
  getOverview(@OrgContext() orgId: string) {
    return this.financeService.getOverview(orgId);
  }

  // ── Full business P&L overview ──────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get('business-overview')
  getBusinessOverview(
    @OrgContext() orgId: string,
    @Query('mode') mode: 'rolling30' | 'calendar' = 'rolling30',
  ) {
    return this.financeService.getBusinessOverview(orgId, mode);
  }

  // ── Vertical-aware breakdown (revenue sources, expenses, leaks) ───────────
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get('breakdown')
  getBreakdown(
    @OrgContext() orgId: string,
    @Query('mode') mode: 'rolling30' | 'calendar' = 'rolling30',
  ) {
    return this.financeService.getBreakdown(orgId, mode);
  }

  // ── Searchable financial attributes (Ledger explorer) ─────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get('search')
  search(
    @OrgContext() orgId: string,
    @Query('q') q = '',
    @Query('mode') mode: 'rolling30' | 'calendar' = 'rolling30',
  ) {
    return this.financeSearch.search(orgId, q, mode);
  }

  // ── AI forecast (now opex-aware) ─────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get('forecast')
  getForecast(@OrgContext() orgId: string) {
    return this.financeService.getForecast(orgId);
  }

  // ── AI price suggestions ─────────────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get('price-suggestions')
  getPriceSuggestions(@OrgContext() orgId: string) {
    return this.financeService.getPriceSuggestions(orgId);
  }

  // ── Item drill-down ──────────────────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get('item/:id')
  getItemProfile(@Param('id') itemId: string, @OrgContext() orgId: string) {
    return this.financeService.getItemProfile(itemId, orgId);
  }

  // ── Business transactions CRUD ───────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Post('business-transactions')
  createBusinessTransaction(
    @OrgContext() orgId: string,
    @Body() dto: CreateBusinessTransactionDto,
  ) {
    return this.financeService.createBusinessTransaction(orgId, dto);
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Get('business-transactions')
  getBusinessTransactions(
    @OrgContext() orgId: string,
    @Query('type') type?: 'INCOME' | 'EXPENSE',
    @Query('category') category?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.financeService.getBusinessTransactions(orgId, { type, category, from, to });
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Delete('business-transactions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBusinessTransaction(
    @Param('id') id: string,
    @OrgContext() orgId: string,
  ) {
    return this.financeService.deleteBusinessTransaction(id, orgId);
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Patch('business-transactions/:id')
  updateBusinessTransaction(
    @Param('id') id: string,
    @OrgContext() orgId: string,
    @Body() dto: UpdateBusinessTransactionDto,
  ) {
    return this.financeService.updateBusinessTransaction(id, orgId, dto);
  }
}
