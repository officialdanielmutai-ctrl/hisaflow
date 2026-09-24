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
import { MessagesService } from './messages/messages.service';
import { MessagesController } from './messages/messages.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [
    DashboardController,
    AdminAuditController,
    AccountsController,
    ProvidersController,
    MessagesController,
  ],
  providers: [
    AdminAuditService,
    AdminAuthGuard,
    AdminRoleGuard,
    AccountsService,
    ProvidersService,
    MessagesService,
  ],
  exports: [
    AdminAuditService,
    AdminAuthGuard,
    AdminRoleGuard,
    AccountsService,
    ProvidersService,
    MessagesService,
  ],
})
export class AdminModule {}


