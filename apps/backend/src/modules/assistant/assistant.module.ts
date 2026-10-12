import { Module } from '@nestjs/common';
import { AiIngestionModule } from '../ai-ingestion/ai-ingestion.module';
import { BookingsModule } from '../bookings/bookings.module';
import { GuestsModule } from '../guests/guests.module';
import { InventoryModule } from '../inventory/inventory.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { IspModule } from '../isp/isp.module';
import { NotesModule } from '../notes/notes.module';
import { RoomsModule } from '../rooms/rooms.module';
import { SchoolClassesModule } from '../school-classes/school-classes.module';
import { SchoolFeesModule } from '../school-fees/school-fees.module';
import { StudentsModule } from '../students/students.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantContextService } from './context/assistant-context.service';
import { AssistantToolsService } from './tools/assistant-tools.service';
import { GuestHouseAssistantToolsService } from './tools/guesthouse-assistant-tools.service';
import { IspAssistantToolsService } from './tools/isp-assistant-tools.service';
import { SchoolAssistantToolsService } from './tools/school-assistant-tools.service';
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
    GuestsModule,
    InventoryModule,
    InvoicesModule,
    IspModule,
    NotesModule,
    RoomsModule,
    SchoolClassesModule,
    SchoolFeesModule,
    StudentsModule,
    TransactionsModule,
  ],
  controllers: [AssistantController],
  providers: [
    AssistantToolsService,
    IspAssistantToolsService,
    GuestHouseAssistantToolsService,
    SchoolAssistantToolsService,
    {
      provide: ASSISTANT_TOOL_PROVIDERS,
      useFactory: (
        foundation: AssistantToolsService,
        isp: IspAssistantToolsService,
        guestHouse: GuestHouseAssistantToolsService,
        school: SchoolAssistantToolsService,
      ) => [foundation, isp, guestHouse, school],
      inject: [
        AssistantToolsService,
        IspAssistantToolsService,
        GuestHouseAssistantToolsService,
        SchoolAssistantToolsService,
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
