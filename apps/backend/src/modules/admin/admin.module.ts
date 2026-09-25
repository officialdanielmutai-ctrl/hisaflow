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
import { DirectoryService } from './directory/directory.service';
import { DirectoryController } from './directory/directory.controller';
import { CommsService } from './comms/comms.service';
import { CommsController } from './comms/comms.controller';
import { CampaignsService } from './campaigns/campaigns.service';
import { CampaignsController } from './campaigns/campaigns.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [
    DashboardController,
    AdminAuditController,
    AccountsController,
    ProvidersController,
    MessagesController,
    DirectoryController,
    CommsController,
    CampaignsController,
  ],
  providers: [
    AdminAuditService,
    AdminAuthGuard,
    AdminRoleGuard,
    AccountsService,
    ProvidersService,
    MessagesService,
    DirectoryService,
    CommsService,
    CampaignsService,
  ],
  exports: [
    AdminAuditService,
    AdminAuthGuard,
    AdminRoleGuard,
    AccountsService,
    ProvidersService,
    MessagesService,
    DirectoryService,
    CommsService,
    CampaignsService,
  ],
})
export class AdminModule {}


