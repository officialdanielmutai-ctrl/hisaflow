import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@UseGuards(ClerkAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // ── Create a new organisation (caller becomes OWNER) ──────────────────────
  @Post()
  async createOrganization(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: { id: string; clerkId: string },
  ) {
    try {
      return await this.organizationsService.create(dto, user.id);
    } catch (error) {
      console.error('CRITICAL 500 ERROR CAUSE:', error);
      throw error;
    }
  }

  // ── Join an existing org via invite code (caller becomes STAFF) ───────────
  // No x-organization-id header required — the user has no org yet.
  @Post('join')
  async joinOrganization(
    @Body('inviteCode') inviteCode: string,
    @CurrentUser() user: { id: string; clerkId: string },
  ) {
    try {
      return await this.organizationsService.joinOrganization(inviteCode, user.id);
    } catch (error) {
      console.error('CRITICAL 500 ERROR CAUSE:', error);
      throw error;
    }
  }

  // ── List the caller's memberships ─────────────────────────────────────────
  @Get('me')
  async getMyOrganizations(
    @CurrentUser() user: { id: string; clerkId: string },
  ) {
    return this.organizationsService.getOrganizationsForUser(user.id);
  }

  // ── Get invite code for current user's org (owner/manager only) ───────────
  @Get('my/invite-code')
  async getMyInviteCode(
    @CurrentUser() user: { id: string; clerkId: string },
  ) {
    return this.organizationsService.getMyInviteCode(user.id);
  }

  // ── Find org by ID ────────────────────────────────────────────────────────
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.organizationsService.findById(id);
  }
}

