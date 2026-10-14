import { Injectable, Logger } from '@nestjs/common';
import { AssistantContextService } from '../context/assistant-context.service';
import { ToolRegistryService } from '../registry/tool-registry.service';
import { AssistantPolicyService } from '../policy/policy.service';
import { ProposalService } from '../proposal/proposal.service';
import { toPublicProposal } from '../proposal/public-proposal';
import type { PublicProposal } from '../proposal/public-proposal';
import { AssistantProviderService } from '../provider/assistant-provider.service';
import type { ToolContext } from '../tool.types';
import type {
  AgentCompletion,
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
  private readonly logger = new Logger(AssistantAgentService.name);

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
    history: AgentMessage[] = [],
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
      // Recent turns from the thread's memory, so "no, make it 30" can update
      // the previous request instead of starting a new one.
      ...history,
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

      let completion: AgentCompletion;
      try {
        completion = await this.provider.complete(messages, schemas);
      } catch (error) {
        // Never let a provider/gateway failure become a 500. Keep any
        // proposals already collected and return an honest, retryable reply.
        this.logger.error(
          `Assistant turn failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return {
          reply:
            "I couldn't reach the AI service just now. Please try again in a moment.",
          toolCalls: collected,
          proposals: proposed,
          capped: false,
        };
      }
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
      'Reply in the language the user writes in (English, Swahili, or mixed). Keep replies short, warm and concrete.',
      // Grounding: the assistant has no built-in knowledge of this business.
      'You have NO built-in knowledge of this business. Never invent, guess or "example" products, quantities, prices, customers, guests, bookings, invoices, subscribers, tickets, work orders or any other record.',
      'Before you state any fact about the business, call the matching read tool and use ONLY the data it returns. If a read tool returns an empty list, say plainly that there is nothing to show (for example, "You have no inventory items yet") and do not fill the gap with invented items.',
      'If you cannot find a matching item or record, say you could not find it and ask the user to confirm; never substitute a different one.',
      'To create or save a note, reminder or task, call create_note and present the proposal — do not just write the note text in your reply.',
      'To send a message, call send_email or send_sms with the exact recipient and text and present the proposal; never claim a message was sent before it is approved and executed.',
      'You may read data and draft proposals. A change is only applied after the user approves the exact payload.',
      'Never say something is done while it is only proposed, and never claim a capability you do not have.',
      'Use the provided tools. Do not invent organization or user identifiers.',
      'If no tool can fulfil the request, call log_unsupported_intent with the request, then explain what you cannot do and offer the nearest alternative.',
      'If ambiguity would change a write, ask one precise question instead of guessing.',
      // Concrete examples measurably improve tool-call reliability, especially
      // for weaker/faster models that otherwise answer from memory.
      'Examples: the user says "what is in my stock?" — call list_inventory, then list only the items it returned, or say plainly that there is nothing.',
      'The user says "draft a note reminding me to call the plumber" — call create_note with title "Call the plumber" and the message as content, then tell them the note is ready for review. Do not paste the note as plain text.',
      'The user says "sold 3 unga" — call record_sale and present the proposal; never say it is done before approval.',
    ].join(' ');
  }
}
