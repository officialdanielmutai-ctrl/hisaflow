import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TableOrdersService } from './table-orders.service';
import { CreateTableOrderDto, AddOrderItemDto } from './dto/create-table-order.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('table-orders')
export class TableOrdersController {
  constructor(private readonly tableOrdersService: TableOrdersService) {}

  @Get()
  async findAll(
    @Query('status') status: string,
    @OrgContext() orgId: string,
  ) {
    return this.tableOrdersService.findAll(orgId, status || 'OPEN');
  }

  @Post()
  async create(
    @Body() dto: CreateTableOrderDto,
    @OrgContext() orgId: string,
  ) {
    return this.tableOrdersService.create(dto, orgId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @OrgContext() orgId: string,
  ) {
    return this.tableOrdersService.findOne(id, orgId);
  }

  @Post(':id/items')
  async addItem(
    @Param('id') id: string,
    @Body() dto: AddOrderItemDto,
    @OrgContext() orgId: string,
  ) {
    return this.tableOrdersService.addItem(id, dto, orgId);
  }

  @Delete(':id/items/:itemId')
  async removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @OrgContext() orgId: string,
  ) {
    return this.tableOrdersService.removeItem(itemId, orgId);
  }

  @Post(':id/close')
  async closeOrder(
    @Param('id') id: string,
    @OrgContext() orgId: string,
  ) {
    return this.tableOrdersService.closeOrder(id, orgId);
  }

  @Post(':id/void')
  async voidOrder(
    @Param('id') id: string,
    @OrgContext() orgId: string,
  ) {
    return this.tableOrdersService.voidOrder(id, orgId);
  }
}
