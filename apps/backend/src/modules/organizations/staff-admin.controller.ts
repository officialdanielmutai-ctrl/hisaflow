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
import { RequiresFeatures } from '../../core/decorators/requires-features.decorator';
import { TierFeature } from '../../core/entitlements/entitlements.constant';

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
  // Role-based permissions are a Team-depth feature (Section 1A).
  @Roles(AppRole.OWNER)
  @RequiresFeatures(TierFeature.RolePermissions)
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
