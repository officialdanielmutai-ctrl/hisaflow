import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IspController } from './isp.controller';
import { SubscribersController } from './subscribers/subscribers.controller';
import { SubscribersService } from './subscribers/subscribers.service';
import { ServicePlansController } from './service-plans/service-plans.controller';
import { ServicePlansService } from './service-plans/service-plans.service';
import { WorkOrdersController } from './work-orders/work-orders.controller';
import { WorkOrdersService } from './work-orders/work-orders.service';
import { TicketsController } from './tickets/tickets.controller';
import { TicketsService } from './tickets/tickets.service';
import { IspInvoicesController } from './invoices/isp-invoices.controller';
import { IspInvoicesService } from './invoices/isp-invoices.service';
import { EquipmentController } from './equipment/equipment.controller';
import { EquipmentService } from './equipment/equipment.service';
// Phase 6 — MikroTik Router Integration
import { RoutersController } from './routers/routers.controller';
import { RoutersService } from './routers/routers.service';
import { RouterActionService } from './routers/router-action.service';
import { BillingSuspendJob } from './routers/billing-suspend.job';
import { ReconciliationJob } from './routers/reconciliation.job';
import { PrismaService } from '../../infrastructure/prisma.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
  ],
  controllers: [
    IspController,
    SubscribersController,
    ServicePlansController,
    WorkOrdersController,
    TicketsController,
    IspInvoicesController,
    EquipmentController,
    RoutersController,
  ],
  providers: [
    SubscribersService,
    ServicePlansService,
    WorkOrdersService,
    TicketsService,
    IspInvoicesService,
    EquipmentService,
    RoutersService,
    RouterActionService,
    BillingSuspendJob,
    ReconciliationJob,
    PrismaService,
  ],
})
export class IspModule {}
