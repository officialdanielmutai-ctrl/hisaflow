import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { AdminAuditService } from './audit/admin-audit.service';
import { AdminAuditController } from './audit/admin-audit.controller';
import { DashboardController } from './dashboard/dashboard.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardController, AdminAuditController],
  providers: [AdminAuditService, AdminAuthGuard, AdminRoleGuard],
  exports: [AdminAuditService, AdminAuthGuard, AdminRoleGuard],
})
export class AdminModule {}
