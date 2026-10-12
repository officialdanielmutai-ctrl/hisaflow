import { Injectable } from '@nestjs/common';
import {
  AiIngestionService,
  type ParsedAction,
} from '../../ai-ingestion/ai-ingestion.service';
import { AssistantAgentService } from '../agent/assistant-agent.service';
import { AssistantAuditService } from '../executor/assistant-audit.service';
import {
  ASSISTANT_FLAGS,
  FeatureFlagService,
} from '../policy/feature-flag.service';
import type { ToolContext } from '../tool.types';
import {
  compareCalls,
  isShadowComparable,
  legacyActionsToCalls,
  type MappedCall,
  type ShadowReport,
} from './shadow-comparison';

interface NextToolCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Shadow mode (overhaul Duty 2, Phase C): run the new registry pipeline
 * alongside the legacy prompt path and compare tool selection + arguments,
 * without letting the new path touch data. Flag-gated (`assistant.shadow`,
 * default off) and audit-logged.
 */
@Injectable()
export class AssistantShadowService {
  constructor(
    private readonly flags: FeatureFlagService,
    private readonly aiIngestion: AiIngestionService,
    private readonly agent: AssistantAgentService,
    private readonly audit: AssistantAuditService,
  ) {}

  /** Pure comparison, usable in tests and offline evals. */
  compare(
    legacyActions: ParsedAction[],
    nextToolCalls: NextToolCall[],
  ): ShadowReport {
    const legacy = legacyActionsToCalls(legacyActions);
    const next: MappedCall[] = nextToolCalls
      .filter((call) => isShadowComparable(call.name))
      .map((call) => ({ tool: call.name, args: call.args }));
    return compareCalls(legacy, next);
  }

  async run(ctx: ToolContext, message: string): Promise<ShadowReport> {
    await this.flags.assertEnabled(ASSISTANT_FLAGS.shadow, {
      organizationId: ctx.organizationId,
      businessType: ctx.businessType,
    });

    const [legacyActions, next] = await Promise.all([
      this.aiIngestion.parseInventoryText(message, ctx.organizationId),
      this.agent.run(ctx.organizationId, ctx.userId, ctx.isImpersonated, message),
    ]);

    const report = this.compare(legacyActions, next.toolCalls);
    await this.audit.record({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'shadow_compare',
      detail: {
        score: report.score,
        legacyCount: report.legacyCount,
        nextCount: report.nextCount,
        exact: report.exact,
        partial: report.partial,
        missing: report.missing,
        extra: report.extra,
      },
    });
    return report;
  }
}
