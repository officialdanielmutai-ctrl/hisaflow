import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { TaxSyncService } from './tax-sync.service';

/**
 * Phase C — the visible sync-status indicator (read-only). The Tax tab (Phase
 * D) renders this; it exists now so "did my offline sale actually file?" has an
 * answer without touching the database.
 */
@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('tax')
export class TaxSyncController {
  constructor(private readonly sync: TaxSyncService) {}

  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Get('sync-status')
  getStatus(@OrgContext() organizationId: string) {
    return this.sync.getStatus(organizationId);
  }
}
