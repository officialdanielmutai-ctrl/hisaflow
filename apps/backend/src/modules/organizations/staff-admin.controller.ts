import {
  Controller,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StaffAdminService } from './staff-admin.service';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('organizations')
export class StaffAdminController {
  constructor(private readonly staffAdminService: StaffAdminService) {}

  // ── GET /organizations/my/staff ───────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get('my/staff')
  getStaffMembers(
    @CurrentUser() user: { id: string },
    @OrgContext() orgId: string,
  ) {
    return this.staffAdminService.getStaffMembers(user.id, orgId);
  }

  // ── DELETE /organizations/staff/:userId ───────────────────────────────────
  @Roles(AppRole.OWNER)
  @Delete('staff/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeStaff(
    @CurrentUser() user: { id: string },
    @OrgContext() orgId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.staffAdminService.removeStaff(user.id, targetUserId, orgId);
  }

  // ── PATCH /organizations/staff/:userId/permissions ────────────────────────
  @Roles(AppRole.OWNER)
  @Patch('staff/:userId/permissions')
  updatePermissions(
    @CurrentUser() user: { id: string },
    @OrgContext() orgId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { grantedPermissions: string[]; revokedPermissions: string[] },
  ) {
    return this.staffAdminService.updatePermissions(
      user.id,
      targetUserId,
      orgId,
      body.grantedPermissions ?? [],
      body.revokedPermissions ?? [],
    );
  }
}
