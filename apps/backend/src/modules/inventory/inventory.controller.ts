import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(
    @OrgContext() organizationId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.inventoryService.findAll(organizationId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @OrgContext() organizationId: string,
  ) {
    return this.inventoryService.findById(id, organizationId);
  }

  @Post()
  create(
    @Body() dto: CreateInventoryItemDto,
    @OrgContext() organizationId: string,
  ) {
    return this.inventoryService.create(organizationId, dto);
  }

  @Post('adjust')
  adjustStock(
    @Body() dto: AdjustStockDto,
    @OrgContext() organizationId: string,
  ) {
    return this.inventoryService.adjustStock(organizationId, dto);
  }
}
