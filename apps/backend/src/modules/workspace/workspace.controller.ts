import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { AppRole, Roles } from '../../core/decorators/roles.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

interface WorkspaceUser {
  id: string;
}

/**
 * Personal Home customisation. Every route is org-scoped by the Clerk/Org
 * guards and user-scoped by the service; STAFF can customise their own Home
 * (personal comfort is a floor feature), but never another user's.
 */
@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Get()
  async get(@OrgContext() orgId: string, @CurrentUser() user: WorkspaceUser) {
    return { workspace: await this.workspace.get(orgId, user.id) };
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Put()
  async put(
    @OrgContext() orgId: string,
    @CurrentUser() user: WorkspaceUser,
    @Body() body: unknown,
  ) {
    const input =
      body && typeof body === 'object' && 'workspace' in body
        ? (body as { workspace: unknown }).workspace
        : body;
    return { workspace: await this.workspace.put(orgId, user.id, input) };
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async reset(
    @OrgContext() orgId: string,
    @CurrentUser() user: WorkspaceUser,
    @Body() body: { scope?: unknown } | undefined,
  ) {
    const scope = body?.scope;
    if (scope !== undefined && scope !== 'layout' && scope !== 'all') {
      throw new BadRequestException("scope must be 'layout' or 'all'.");
    }
    return {
      workspace: await this.workspace.reset(orgId, user.id, scope ?? 'layout'),
    };
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Post('layouts')
  async createLayout(
    @OrgContext() orgId: string,
    @CurrentUser() user: WorkspaceUser,
    @Body() body: unknown,
  ) {
    return { workspace: await this.workspace.createLayout(orgId, user.id, body) };
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Patch('layouts/:id')
  async updateLayout(
    @Param('id') id: string,
    @OrgContext() orgId: string,
    @CurrentUser() user: WorkspaceUser,
    @Body() body: unknown,
  ) {
    return {
      workspace: await this.workspace.updateLayout(orgId, user.id, id, body),
    };
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Delete('layouts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLayout(
    @Param('id') id: string,
    @OrgContext() orgId: string,
    @CurrentUser() user: WorkspaceUser,
  ) {
    await this.workspace.deleteLayout(orgId, user.id, id);
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Post('layouts/:id/duplicate')
  async duplicateLayout(
    @Param('id') id: string,
    @OrgContext() orgId: string,
    @CurrentUser() user: WorkspaceUser,
  ) {
    return {
      workspace: await this.workspace.duplicateLayout(orgId, user.id, id),
    };
  }
}
