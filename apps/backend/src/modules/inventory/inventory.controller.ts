import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto, UpdateVariantDto } from './dto/update-product.dto';
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

  @Get('barcode/:code')
  findByBarcode(
    @Param('code') code: string,
    @OrgContext() orgId: string,
  ) {
    return this.inventoryService.findByBarcode(code, orgId);
  }

  // Best-effort external product data (name/brand/category) for a barcode
  // not found in this org's own inventory. Always returns 200 with either
  // a result or null - never 404/500 - so the frontend can treat "no match"
  // as a normal, expected outcome rather than an error to handle.
  @Get('barcode/:code/external')
  lookupExternalBarcode(@Param('code') code: string) {
    return this.inventoryService.lookupExternalProduct(code);
  }

  // Any authenticated org member can create a new stock item
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

  // Update a specific variant (InventoryItem)
  @Patch('variants/:variantId')
  updateVariant(
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
    @OrgContext() orgId: string,
  ) {
    return this.inventoryService.updateVariant(variantId, dto, orgId);
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Delete('variants/:variantId')
  deleteVariant(
    @Param('variantId') variantId: string,
    @OrgContext() orgId: string,
  ) {
    return this.inventoryService.deleteVariant(variantId, orgId);
  }
}
