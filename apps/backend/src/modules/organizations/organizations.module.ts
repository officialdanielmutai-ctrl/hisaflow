import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsPermissionsController } from './organizations-permissions.controller';
import { StaffAdminController } from './staff-admin.controller';
import { OrganizationsService } from './organizations.service';
import { StaffAdminService } from './staff-admin.service';
import { OrganizationsRepository } from './organizations.repository';

@Module({
  imports: [ConfigModule],
  controllers: [
    OrganizationsController,
    OrganizationsPermissionsController,
    StaffAdminController,
  ],
  providers: [OrganizationsService, StaffAdminService, OrganizationsRepository],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
