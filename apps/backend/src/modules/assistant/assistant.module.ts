import { Module } from '@nestjs/common';
import { AiIngestionModule } from '../ai-ingestion/ai-ingestion.module';
import { InventoryModule } from '../inventory/inventory.module';
import { IspModule } from '../isp/isp.module';
import { NotesModule } from '../notes/notes.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantContextService } from './context/assistant-context.service';
import { AssistantToolsService } from './tools/assistant-tools.service';
import { IspAssistantToolsService } from './tools/isp-assistant-tools.service';
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
    InventoryModule,
    IspModule,
    NotesModule,
    TransactionsModule,
  ],
  controllers: [AssistantController],
  providers: [
    AssistantToolsService,
    IspAssistantToolsService,
    {
      provide: ASSISTANT_TOOL_PROVIDERS,
      useFactory: (
        foundation: AssistantToolsService,
        isp: IspAssistantToolsService,
      ) => [foundation, isp],
      inject: [AssistantToolsService, IspAssistantToolsService],
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
