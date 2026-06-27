import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(@OrgContext() orgId: string) {
    return this.inventoryService.findAll(orgId);
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Post()
  create(
    @Body() dto: CreateProductDto,
    @OrgContext() orgId: string,
  ) {
    return this.inventoryService.create(dto, orgId);
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @OrgContext() orgId: string,
  ) {
    return this.inventoryService.update(id, dto, orgId);
  }
}
