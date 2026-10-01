import { Controller, Post, UseGuards } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AdminAuthGuard } from '../../admin/guards/admin-auth.guard';
import { AdminRoleGuard } from '../../admin/guards/admin-role.guard';
import { RequireAdminRoles } from '../../admin/decorators/require-admin-roles.decorator';
import { HisaflowPlansService } from './hisaflow-plans.service';

/**
 * Internal provisioning for Paystack Plans (Phase B). Admin-gated now rather
 * than waiting for the Phase F panel — creating a live billing Plan is not an
 * org-facing action.
 */
@UseGuards(AdminAuthGuard, AdminRoleGuard)
@Controller('admin/paywall/plans')
export class PaywallAdminController {
  constructor(private readonly plans: HisaflowPlansService) {}

  @Post('sync')
  @RequireAdminRoles(AdminRole.BILLING_ADMIN)
  sync() {
    return this.plans.syncPaystackPlans();
  }
}
