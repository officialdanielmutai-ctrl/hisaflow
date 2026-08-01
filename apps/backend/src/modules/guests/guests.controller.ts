import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { GuestsService } from './guests.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { Organization } from '../../../generated/prisma/client';

@Controller('guests')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Post()
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  create(
    @OrgContext() orgId: string,
    @Body() createGuestDto: CreateGuestDto
  ) {
    return this.guestsService.create(orgId, createGuestDto);
  }

  @Get()
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  findAll(@OrgContext() orgId: string) {
    return this.guestsService.findAll(orgId);
  }

  @Get(':id')
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  findOne(
    @OrgContext() orgId: string,
    @Param('id') id: string
  ) {
    return this.guestsService.findOne(orgId, id);
  }

  @Patch(':id')
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  update(
    @OrgContext() orgId: string,
    @Param('id') id: string,
    @Body() updateGuestDto: UpdateGuestDto
  ) {
    return this.guestsService.update(orgId, id, updateGuestDto);
  }
}
