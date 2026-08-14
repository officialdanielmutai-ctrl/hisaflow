import { Module } from '@nestjs/common';
import { SchoolFeesController } from './school-fees.controller';
import { SchoolFeesService } from './school-fees.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SchoolFeesController],
  providers: [SchoolFeesService],
  exports: [SchoolFeesService],
})
export class SchoolFeesModule {}
