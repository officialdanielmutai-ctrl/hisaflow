import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(@OrgContext() orgId: string) {
    return this.inventoryService.findAll(orgId);
  }

  @Post()
  create(
    @Body() dto: CreateProductDto,
    @OrgContext() orgId: string,
  ) {
    return this.inventoryService.create(dto, orgId);
  }
}
