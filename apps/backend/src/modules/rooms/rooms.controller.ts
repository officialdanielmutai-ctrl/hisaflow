import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { Organization } from '../../../generated/prisma/client';

@Controller('rooms')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  create(
    @OrgContext() orgId: string,
    @Body() createRoomDto: CreateRoomDto
  ) {
    return this.roomsService.create(orgId, createRoomDto);
  }

  @Get()
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  findAll(@OrgContext() orgId: string) {
    return this.roomsService.findAll(orgId);
  }

  @Get(':id')
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  findOne(
    @OrgContext() orgId: string,
    @Param('id') id: string
  ) {
    return this.roomsService.findOne(orgId, id);
  }

  @Patch(':id')
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  update(
    @OrgContext() orgId: string,
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto
  ) {
    return this.roomsService.update(orgId, id, updateRoomDto);
  }

  @Delete(':id')
  @Roles(AppRole.OWNER)
  remove(
    @OrgContext() orgId: string,
    @Param('id') id: string
  ) {
    return this.roomsService.deactivate(orgId, id);
  }
}
