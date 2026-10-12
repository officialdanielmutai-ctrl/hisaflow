import { Module } from '@nestjs/common';
import { NotesModule } from '../notes/notes.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantContextService } from './context/assistant-context.service';
import { AssistantToolsService } from './tools/assistant-tools.service';
import { ToolRegistryService } from './registry/tool-registry.service';
import { FeatureFlagService } from './policy/feature-flag.service';
import { AssistantPolicyService } from './policy/policy.service';
import { ProposalService } from './proposal/proposal.service';
import { AssistantAuditService } from './executor/assistant-audit.service';
import { AssistantExecutorService } from './executor/executor.service';

@Module({
  imports: [NotesModule, TransactionsModule],
  controllers: [AssistantController],
  providers: [
    AssistantToolsService,
    ToolRegistryService,
    FeatureFlagService,
    AssistantPolicyService,
    ProposalService,
    AssistantAuditService,
    AssistantExecutorService,
    AssistantContextService,
    AssistantService,
  ],
  exports: [AssistantService, ToolRegistryService, ProposalService],
})
export class AssistantModule {}
