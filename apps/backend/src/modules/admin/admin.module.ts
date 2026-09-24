import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { AdminAuditService } from './audit/admin-audit.service';
import { AdminAuditController } from './audit/admin-audit.controller';
import { DashboardController } from './dashboard/dashboard.controller';
import { AccountsService } from './accounts/accounts.service';
import { AccountsController } from './accounts/accounts.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardController, AdminAuditController, AccountsController],
  providers: [AdminAuditService, AdminAuthGuard, AdminRoleGuard, AccountsService],
  exports: [AdminAuditService, AdminAuthGuard, AdminRoleGuard, AccountsService],
})
export class AdminModule {}
