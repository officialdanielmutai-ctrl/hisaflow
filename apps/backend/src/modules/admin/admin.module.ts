import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { AdminAuditService } from './audit/admin-audit.service';
import { AdminAuditController } from './audit/admin-audit.controller';
import { DashboardController } from './dashboard/dashboard.controller';
import { AccountsService } from './accounts/accounts.service';
import { AccountsController } from './accounts/accounts.controller';
import { ProvidersService } from './providers/providers.service';
import { ProvidersController } from './providers/providers.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [
    DashboardController,
    AdminAuditController,
    AccountsController,
    ProvidersController,
  ],
  providers: [
    AdminAuditService,
    AdminAuthGuard,
    AdminRoleGuard,
    AccountsService,
    ProvidersService,
  ],
  exports: [
    AdminAuditService,
    AdminAuthGuard,
    AdminRoleGuard,
    AccountsService,
    ProvidersService,
  ],
})
export class AdminModule {}

