import { Module } from '@nestjs/common';
import { TableOrdersController } from './table-orders.controller';
import { TableOrdersService } from './table-orders.service';

@Module({
  controllers: [TableOrdersController],
  providers: [TableOrdersService],
  exports: [TableOrdersService],
})
export class TableOrdersModule {}
