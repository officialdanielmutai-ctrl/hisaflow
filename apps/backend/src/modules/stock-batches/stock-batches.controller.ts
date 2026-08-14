import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StockBatchesService } from './stock-batches.service';
import { CreateStockBatchDto } from './dto/create-stock-batch.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('stock-batches')
export class StockBatchesController {
  constructor(private readonly stockBatchesService: StockBatchesService) {}

  @Post()
  async create(
    @Body() dto: CreateStockBatchDto,
    @OrgContext() orgId: string,
  ) {
    return this.stockBatchesService.create(dto, orgId);
  }

  @Get('item/:itemId')
  async getByItem(
    @Param('itemId') itemId: string,
    @OrgContext() orgId: string,
  ) {
    return this.stockBatchesService.findByItem(itemId, orgId);
  }

  @Get('expiring')
  async getExpiring(
    @Query('days') days: string,
    @OrgContext() orgId: string,
  ) {
    const daysAhead = parseInt(days, 10) || 30;
    return this.stockBatchesService.findExpiring(orgId, daysAhead);
  }

  @Delete(':id')
  async retire(
    @Param('id') id: string,
    @OrgContext() orgId: string,
  ) {
    return this.stockBatchesService.retire(id, orgId);
  }
}
