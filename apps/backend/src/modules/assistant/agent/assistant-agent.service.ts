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

export const MAX_TOOL_CALLS_PER_TURN = 8;

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
      'The user says "add a new item, 20 bags of unga" — call create_inventory_item with name, unit and quantity; to add stock to an existing item call record_purchase. Present the proposal; never say it is done before approval.',
      // Sales reporting, catalogue advice and broader business questions.
      'For any sales question, call get_sales_report. Never say you cannot report sales and never estimate a number without the tool. Use get_financial_breakdown for room, plan or fee revenue, and get_sales_report for item/stock sales.',
      'For a question like "what should I stock?", "what is selling?", "what should I drop?" or "how can I improve profit?", call analyse_catalogue (and get_sales_report or get_active_alerts when relevant) first. Give at most three prioritised recommendations, each with the evidence from the tool and a concrete next action.',
      'You may suggest new products or pack sizes as ideas, but label them clearly as suggestions. Never imply a suggested product is already in the catalogue or has sales history.',
      'For "who owes me?" call get_credit_summary. For "what did I spend?" call get_expense_report. For "what needs my attention?" call get_active_alerts. Use the figures the tools return.',
      'For recent activity use get_recent_transactions. For restocking spend use get_purchase_report. For notes, reminders and tasks use list_notes. For the KRA/eTIMS position use get_tax_summary. For "who works here?" use list_team_members. Only call resolve_alert when the user explicitly asks to dismiss or clear alerts.',
      'For money that is not stock, use record_expense (rent, salary, transport, utilities, repairs) or record_income (service fee, grant, refund); for a stock delivery use record_purchase. For a stock-count correction use adjust_stock, to stop selling an item use archive_inventory_item, and for a customer credit payment use record_credit_payment.',
      'When the user asks for advice, be a practical business advisor: explain the trade-off, recommend the next step, and offer to prepare the related proposal if one exists. Do not simply repeat raw data. State your assumption when the data does not cover the question, and never promise a result you cannot guarantee.',
      // Safety: advice must stay inside the assistant's competence.
      'Do not give medical, dosage, legal or accounting advice. For a chemist, explain what the catalogue shows but tell the user to consult a qualified health professional for any treatment or dosage question. For tax or legal questions, explain the recorded figures and recommend a qualified professional.',
      // Comparisons and trend answers must come from the tool's own period data.
      'When comparing periods, use the comparedWithPreviousPeriod figures from get_sales_report; do not calculate your own revenue estimate. If a tool returns no data, say so plainly rather than presenting zero as a confident result.',
      // Natural response formatting: the UI renders light markdown, but code/JSON
      // blocks look like a developer dump and are unhelpful to shop owners.
      'Write natural, edited prose with short paragraphs and a few bullets only when a list genuinely helps. Do not wrap your reply in code fences, JSON, tables or backticks unless the user explicitly asks for raw data.',
    ].join(' ');
  }
}
