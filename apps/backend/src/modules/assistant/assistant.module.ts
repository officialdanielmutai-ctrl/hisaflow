import { Module } from '@nestjs/common';
import { AiIngestionModule } from '../ai-ingestion/ai-ingestion.module';
import { BookingsModule } from '../bookings/bookings.module';
import { FinanceModule } from '../finance/finance.module';
import { GuestsModule } from '../guests/guests.module';
import { InventoryModule } from '../inventory/inventory.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { IspModule } from '../isp/isp.module';
import { NotesModule } from '../notes/notes.module';
import { RoomsModule } from '../rooms/rooms.module';
import { SchoolClassesModule } from '../school-classes/school-classes.module';
import { SchoolFeesModule } from '../school-fees/school-fees.module';
import { StockBatchesModule } from '../stock-batches/stock-batches.module';
import { StudentsModule } from '../students/students.module';
import { TableOrdersModule } from '../table-orders/table-orders.module';
import { TieredPricingModule } from '../tiered-pricing/tiered-pricing.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantContextService } from './context/assistant-context.service';
import { AssistantToolsService } from './tools/assistant-tools.service';
import { GuestHouseAssistantToolsService } from './tools/guesthouse-assistant-tools.service';
import { IspAssistantToolsService } from './tools/isp-assistant-tools.service';
import { SchoolAssistantToolsService } from './tools/school-assistant-tools.service';
import { WholesaleAssistantToolsService } from './tools/wholesale-assistant-tools.service';
import { RestaurantAssistantToolsService } from './tools/restaurant-assistant-tools.service';
import { ChemistAssistantToolsService } from './tools/chemist-assistant-tools.service';
import { ToolRegistryService } from './registry/tool-registry.service';
import { ASSISTANT_TOOL_PROVIDERS } from './tool.types';
import { FeatureFlagService } from './policy/feature-flag.service';
import { AssistantPolicyService } from './policy/policy.service';
import { ProposalService } from './proposal/proposal.service';
import { AssistantAuditService } from './executor/assistant-audit.service';
import { AssistantExecutorService } from './executor/executor.service';
import { AssistantProviderService } from './provider/assistant-provider.service';
import { AssistantAgentService } from './agent/assistant-agent.service';
import { AssistantShadowService } from './shadow/shadow.service';
import { AssistantCommsService } from './comms/assistant-comms.service';
import { AssistantUnsupportedService } from './unsupported/assistant-unsupported.service';

@Module({
  imports: [
    AiIngestionModule,
    BookingsModule,
    FinanceModule,
    GuestsModule,
    InventoryModule,
    InvoicesModule,
    IspModule,
    NotesModule,
    RoomsModule,
    SchoolClassesModule,
    SchoolFeesModule,
    StockBatchesModule,
    StudentsModule,
    TableOrdersModule,
    TieredPricingModule,
    TransactionsModule,
  ],
  controllers: [AssistantController],
  providers: [
    AssistantToolsService,
    IspAssistantToolsService,
    GuestHouseAssistantToolsService,
    SchoolAssistantToolsService,
    WholesaleAssistantToolsService,
    RestaurantAssistantToolsService,
    ChemistAssistantToolsService,
    {
      provide: ASSISTANT_TOOL_PROVIDERS,
      useFactory: (
        foundation: AssistantToolsService,
        isp: IspAssistantToolsService,
        guestHouse: GuestHouseAssistantToolsService,
        school: SchoolAssistantToolsService,
        wholesale: WholesaleAssistantToolsService,
        restaurant: RestaurantAssistantToolsService,
        chemist: ChemistAssistantToolsService,
      ) => [
        foundation,
        isp,
        guestHouse,
        school,
        wholesale,
        restaurant,
        chemist,
      ],
      inject: [
        AssistantToolsService,
        IspAssistantToolsService,
        GuestHouseAssistantToolsService,
        SchoolAssistantToolsService,
        WholesaleAssistantToolsService,
        RestaurantAssistantToolsService,
        ChemistAssistantToolsService,
      ],
    },
    ToolRegistryService,
    FeatureFlagService,
    AssistantPolicyService,
    ProposalService,
    AssistantAuditService,
    AssistantExecutorService,
    AssistantContextService,
    AssistantProviderService,
    AssistantAgentService,
    AssistantShadowService,
    AssistantCommsService,
    AssistantUnsupportedService,
    AssistantService,
  ],
  exports: [AssistantService, ToolRegistryService, ProposalService],
})
export class AssistantModule {}
