import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CreateRoomIssueDto } from './dto/create-room-issue.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Organization } from '@prisma/client';

interface ActorUser {
  id?: string;
  name?: string;
}

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

  // ── Room faults / maintenance ─────────────────────────────────────────────

  @Get(':id/issues')
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  listIssues(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.roomsService.listIssues(orgId, id);
  }

  @Post(':id/issues')
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  reportIssue(
    @OrgContext() orgId: string,
    @Param('id') id: string,
    @Body() dto: CreateRoomIssueDto,
    @CurrentUser() user: ActorUser,
  ) {
    return this.roomsService.reportIssue(orgId, id, dto, {
      id: user?.id,
      name: user?.name,
    });
  }

  @Patch('issues/:issueId/resolve')
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  resolveIssue(
    @OrgContext() orgId: string,
    @Param('issueId') issueId: string,
    @CurrentUser() user: ActorUser,
  ) {
    return this.roomsService.resolveIssue(orgId, issueId, {
      id: user?.id,
      name: user?.name,
    });
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
