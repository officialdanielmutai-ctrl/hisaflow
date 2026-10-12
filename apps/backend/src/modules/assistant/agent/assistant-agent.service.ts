import { Injectable } from '@nestjs/common';
import { AssistantContextService } from '../context/assistant-context.service';
import { ToolRegistryService } from '../registry/tool-registry.service';
import { AssistantPolicyService } from '../policy/policy.service';
import { ProposalService } from '../proposal/proposal.service';
import { toPublicProposal } from '../proposal/public-proposal';
import type { PublicProposal } from '../proposal/public-proposal';
import { AssistantProviderService } from '../provider/assistant-provider.service';
import type { ToolContext } from '../tool.types';
import type {
  AgentMessage,
  AgentResult,
  AgentToolCall,
} from './agent.types';

export const MAX_TOOL_CALLS_PER_TURN = 6;

/**
 * The tool-calling agent loop (overhaul Duty 2, Section 3.3).
 *
 * Read/utility tools auto-run. Write/communicate tools only create proposals —
 * this loop never commits, so there is no second write path. The model is
 * offered only tools the policy gate allows.
 */
@Injectable()
export class AssistantAgentService {
  constructor(
    private readonly context: AssistantContextService,
    private readonly registry: ToolRegistryService,
    private readonly policy: AssistantPolicyService,
    private readonly proposals: ProposalService,
    private readonly provider: AssistantProviderService,
  ) {}

  async run(
    organizationId: string,
    userId: string,
    isImpersonated: boolean,
    message: string,
  ): Promise<AgentResult> {
    const ctx = await this.context.build(
      organizationId,
      userId,
      isImpersonated,
    );
    const available = await this.policy.filterTools(
      this.registry.listFor(ctx),
      ctx,
    );
    const schemas = this.registry.toSchemas(available);

    const messages: AgentMessage[] = [
      { role: 'system', content: this.systemPrompt(ctx) },
      { role: 'user', content: message },
    ];

    const collected: AgentToolCall[] = [];
    const proposed: PublicProposal[] = [];
    let capped = false;
    let finalContent: string | null = null;

    for (;;) {
      if (collected.length >= MAX_TOOL_CALLS_PER_TURN) {
        capped = true;
        break;
      }

      const completion = await this.provider.complete(messages, schemas);
      if (completion.toolCalls.length === 0) {
        finalContent = completion.content;
        break;
      }

      messages.push({
        role: 'assistant',
        content: completion.content,
        toolCalls: completion.toolCalls,
      });

      for (const call of completion.toolCalls) {
        if (collected.length >= MAX_TOOL_CALLS_PER_TURN) {
          capped = true;
          break;
        }
        collected.push(call);

        const tool = available.find((entry) => entry.name === call.name);
        if (!tool) {
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            content: JSON.stringify({
              error: `Unknown or unavailable tool "${call.name}".`,
            }),
          });
          continue;
        }

        try {
          if (tool.kind === 'read' || tool.kind === 'utility') {
            if (!tool.execute) throw new Error('Tool cannot run.');
            const result = await tool.execute(call.args, ctx);
            messages.push({
              role: 'tool',
              toolCallId: call.id,
              content: JSON.stringify({ result }),
            });
          } else {
            if (!tool.buildProposal) throw new Error('Tool cannot be proposed.');
            const draft = await tool.buildProposal(call.args, ctx);
            const proposal = await this.proposals.create(ctx, tool, draft);
            proposed.push(toPublicProposal(proposal));
            messages.push({
              role: 'tool',
              toolCallId: call.id,
              content: JSON.stringify({
                status: 'proposed',
                proposalId: proposal.id,
                summary: draft.summary,
              }),
            });
          }
        } catch (error) {
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            content: JSON.stringify({
              error:
                error instanceof Error ? error.message : 'Tool execution failed.',
            }),
          });
        }
      }

      if (capped) break;
    }

    const reply =
      finalContent ??
      (proposed.length > 0
        ? `I've prepared ${proposed.length} proposal${proposed.length > 1 ? 's' : ''} for your review.`
        : capped
          ? 'I reached the tool-call limit for this turn. Please refine your request.'
          : null);

    return { reply, toolCalls: collected, proposals: proposed, capped };
  }

  private systemPrompt(ctx: ToolContext): string {
    return [
      `You are HisaFlow's assistant for a Kenyan small business (business type: ${ctx.businessType}).`,
      'Reply in the language the user writes in (English, Swahili, or mixed). Keep replies short and warm.',
      'You may read data and draft proposals. A change is only applied after the user approves the exact payload.',
      'Never say something is done while it is only proposed, and never claim a capability you do not have.',
      'Use the provided tools. Do not invent organization or user identifiers.',
      'If no tool can fulfil the request, call log_unsupported_intent with the request, then explain what you cannot do and offer the nearest alternative.',
      'If ambiguity would change a write, ask one precise question instead of guessing.',
    ].join(' ');
  }
}
