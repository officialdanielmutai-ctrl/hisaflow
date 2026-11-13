// @ts-check
/**
 * Assistant characterization set (overhaul Duty 2, Section 3.8).
 *
 * Runs representative English/Swahili sales, catalogue, advice and write
 * prompts against the live `hisaflow-assistant` model group and checks that the
 * model selects the expected tool. Also exercises the C16 ambiguity case:
 * "sell 3 sugar" with two matching items must ask a question and must not
 * create a sale.
 *
 * This is a live evaluation, not a CI test: it needs the gateway master key and
 * provider access. Never commit keys.
 *
 * Run from the repository root:
 *   node --env-file=apps/gateway/.env \
 *     apps/backend/scripts/assistant-characterization.mjs
 *
 * Optional:
 *   ASSISTANT_EVAL_BASE_URL=https://.../v1
 *   ASSISTANT_EVAL_MODEL=hisaflow-assistant
 */
import OpenAI from 'openai';

const BASE_URL =
  process.env.ASSISTANT_EVAL_BASE_URL ??
  'https://hisaflow-litellm-cgqiivalxa-ew.a.run.app/v1';
const MODEL = process.env.ASSISTANT_EVAL_MODEL ?? 'hisaflow-assistant';
const MASTER_KEY =
  process.env.LITELLM_MASTER_KEY ?? process.env.ASSISTANT_EVAL_MASTER_KEY;

const SYSTEM = [
  "You are HisaFlow's assistant for a Kenyan small business (business type: DUKA).",
  'Reply in the language the user writes in (English, Swahili, or mixed). Keep replies short, warm and concrete.',
  'You have NO built-in knowledge of this business. Never invent products, quantities, prices or customers.',
  'Before stating a fact about the business, call the matching read tool and use ONLY the data it returns.',
  'To create or save a note, call create_note. To send a message call send_email or send_sms.',
  'Never claim something is done while it is only proposed.',
  'Use the provided tools. Do not invent organization or user identifiers.',
  'For any sales question, call get_sales_report. Never say you cannot report sales and never estimate a number without the tool.',
  'For "what should I stock?", "what is selling?" or "how can I improve profit?", call analyse_catalogue (and get_sales_report or get_active_alerts when relevant).',
  'For "who owes me?" call get_credit_summary. For "what did I spend?" call get_expense_report. For "what needs my attention?" call get_active_alerts.',
  'For recent activity use get_recent_transactions. For restocking spend use get_purchase_report. For notes/tasks use list_notes. For tax use get_tax_summary. For "who works here?" use list_team_members.',
  'For money that is not stock use record_expense or record_income; for a stock-count correction use adjust_stock; to stop selling an item use archive_inventory_item; for a credit payment use record_credit_payment.',
  'When the user asks for advice, be a practical business advisor: explain the trade-off, recommend the next step and offer a proposal if one exists.',
  'Do not give medical, dosage, legal or accounting advice.',
  'Write natural, edited prose. Do not wrap your reply in code fences, JSON, tables or backticks.',
].join(' ');

/** @typedef {{ name: string, description: string, parameters: object }} Tool */
/** @type {Tool[]} */
const TOOLS = [
  {
    name: 'get_sales_report',
    description:
      'Report stock/item sales for a period: sales count, units, revenue, cost of sales, gross profit, credit sales and best-selling items, with a previous-period comparison. Read-only.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number' }, limit: { type: 'number' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'analyse_catalogue',
    description:
      'Analyse the catalogue and sales history for fast movers, slow/dead stock, low stock, margin risks, packaging gaps, category gaps and suggested new items. Read-only. Use before advising what to stock, drop, price or add.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number' }, limit: { type: 'number' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_credit_summary',
    description:
      'Summarise money owed by customers: total outstanding, ageing buckets and largest/oldest debtors. Read-only.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_expense_report',
    description:
      'Report recorded business expenses (rent, salary, transport, utilities, marketing) grouped by category. Read-only.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_active_alerts',
    description:
      'List unresolved business alerts (low stock, dead stock, expiry risk, billing/payment due, tax, router drift). Read-only.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_purchase_report',
    description:
      'Report stock purchases and restocking for a period: units received, cost and top items bought. Read-only.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_recent_transactions',
    description:
      'List recent stock movements (sales, purchases, wastage, adjustments) with item, quantity and time. Read-only.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number' }, type: { type: 'string' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'list_notes',
    description:
      'List visible notes, reminders and tasks, optionally filtered by status, importance or search text. Read-only.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        query: { type: 'string' },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_tax_summary',
    description:
      'Summarise the KRA eTIMS position: registration, filed/pending/failed invoices and tax amounts. Read-only.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'list_team_members',
    description:
      'List the people who work in this organisation and their roles. Read-only.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_low_stock',
    description:
      'Return inventory items at or below their reorder threshold. Read-only.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'search_inventory',
    description:
      'Search this organisation’s inventory by name to resolve an item ID. Read-only.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_inventory',
    description: 'List this organisation’s inventory items. Read-only.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_financial_breakdown',
    description:
      'Summarise revenue, cost of sales, gross/net profit, revenue by source, running costs and money leaks. Read-only.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'search_business_finances',
    description:
      'Search finances for a room, plan, class, commodity, expense category, client or leak. Read-only.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'record_sale',
    description:
      'Record a sale of an inventory item to a customer. Requires approval.',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string' },
        quantity: { type: 'number' },
        clientName: { type: 'string' },
        isCredit: { type: 'boolean' },
      },
      required: ['itemId', 'quantity'],
      additionalProperties: false,
    },
  },
  {
    name: 'record_purchase',
    description:
      'Record stock received or bought from a supplier. Requires approval.',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string' },
        quantity: { type: 'number' },
      },
      required: ['itemId', 'quantity'],
      additionalProperties: false,
    },
  },
  {
    name: 'record_wastage',
    description:
      'Write off expired, damaged, stolen or spoiled stock. Requires approval.',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string' },
        quantity: { type: 'number' },
        wastageReason: { type: 'string' },
      },
      required: ['itemId', 'quantity'],
      additionalProperties: false,
    },
  },
  {
    name: 'record_expense',
    description:
      'Record a business expense that is not stock (rent, salary, utilities, transport, marketing, repairs). Requires approval.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        amount: { type: 'number' },
        description: { type: 'string' },
      },
      required: ['category', 'amount'],
      additionalProperties: false,
    },
  },
  {
    name: 'record_income',
    description:
      'Record non-stock business income (service fee, grant, refund, other income). Requires approval.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        amount: { type: 'number' },
        description: { type: 'string' },
      },
      required: ['category', 'amount'],
      additionalProperties: false,
    },
  },
  {
    name: 'adjust_stock',
    description:
      'Set an item’s stock to a counted quantity after a stock take. Requires approval and writes an ADJUSTMENT ledger row.',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string' },
        quantity: { type: 'number' },
      },
      required: ['itemId', 'quantity'],
      additionalProperties: false,
    },
  },
  {
    name: 'archive_inventory_item',
    description:
      'Archive (soft-delete) an inventory item while keeping its history. Requires approval.',
    parameters: {
      type: 'object',
      properties: { itemId: { type: 'string' } },
      required: ['itemId'],
      additionalProperties: false,
    },
  },
  {
    name: 'record_credit_payment',
    description:
      'Record a payment against a client’s outstanding credit. Requires approval.',
    parameters: {
      type: 'object',
      properties: {
        creditId: { type: 'string' },
        amount: { type: 'number' },
      },
      required: ['creditId', 'amount'],
      additionalProperties: false,
    },
  },
  {
    name: 'resolve_alert',
    description:
      'Mark one unresolved alert as resolved, or clear every unresolved alert. Requires approval.',
    parameters: {
      type: 'object',
      properties: { alertId: { type: 'string' }, all: { type: 'boolean' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'create_note',
    description: 'Create a note, reminder or task. Requires approval.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'send_sms',
    description:
      'Draft and send an SMS to a customer. Requires approval and consent.',
    parameters: {
      type: 'object',
      properties: {
        recipient: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['recipient', 'message'],
      additionalProperties: false,
    },
  },
  {
    name: 'send_email',
    description:
      'Draft and send an email to a customer. Requires approval and consent.',
    parameters: {
      type: 'object',
      properties: {
        recipient: { type: 'string' },
        subject: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['recipient', 'subject', 'message'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_unsupported_intent',
    description:
      'Record a request the assistant cannot fulfil, then explain the limit. Use when no other tool fits.',
    parameters: {
      type: 'object',
      properties: { request: { type: 'string' } },
      required: ['request'],
      additionalProperties: false,
    },
  },
];

/** Mirror the production registry: optional primitives accept JSON null. */
function nullableParameters(parameters) {
  const clone = JSON.parse(JSON.stringify(parameters));
  const required = Array.isArray(clone.required) ? clone.required : [];
  for (const [name, value] of Object.entries(clone.properties ?? {})) {
    if (required.includes(name) || !value || typeof value !== 'object') continue;
    if (
      typeof value.type === 'string' &&
      ['string', 'number', 'integer', 'boolean'].includes(value.type)
    ) {
      value.type = [value.type, 'null'];
    }
    if (Array.isArray(value.enum) && !value.enum.includes(null)) {
      value.enum = [...value.enum, null];
    }
  }
  return clone;
}

const TOOL_SCHEMAS = TOOLS.map((tool) => ({
  type: 'function',
  function: { ...tool, parameters: nullableParameters(tool.parameters) },
}));

/**
 * @typedef {{ id: string, text: string, expect: string[] }} Case
 * @type {Case[]}
 */
const CASES = [
  { id: 'sales-en', text: 'How were sales this week?', expect: ['get_sales_report'] },
  {
    id: 'sales-sw',
    text: 'Mauzo yalikuwaje wiki hii?',
    expect: ['get_sales_report'],
  },
  {
    id: 'catalogue-en',
    text: 'What should I stock next?',
    expect: ['analyse_catalogue'],
  },
  {
    id: 'catalogue-sw',
    text: 'Nianze kuuza bidhaa gani mpya?',
    expect: ['analyse_catalogue'],
  },
  {
    id: 'advice-en',
    text: 'How can I improve profit?',
    expect: ['analyse_catalogue', 'get_financial_breakdown', 'get_sales_report'],
  },
  {
    id: 'advice-sw',
    text: 'Nifanyeje nipate faida zaidi?',
    expect: ['analyse_catalogue', 'get_financial_breakdown', 'get_sales_report'],
  },
  {
    id: 'credit-en',
    text: 'Who owes me money?',
    expect: ['get_credit_summary'],
  },
  {
    id: 'credit-sw',
    text: 'Nani anadaiwa pesa zangu?',
    expect: ['get_credit_summary'],
  },
  {
    id: 'expense-en',
    text: 'What did I spend on rent this month?',
    expect: ['get_expense_report'],
  },
  {
    id: 'expense-sw',
    // "kodi" can mean rent or tax; use transport to test the expense tool
    // without a genuine language ambiguity.
    text: 'Nimetumia kiasi gani kwa usafiri mwezi huu?',
    expect: ['get_expense_report'],
  },
  {
    id: 'purchase-en',
    text: 'How much did I spend on stock?',
    expect: ['get_purchase_report'],
  },
  {
    id: 'recent-en',
    text: 'What happened today?',
    expect: ['get_recent_transactions', 'get_sales_report'],
  },
  {
    id: 'notes-en',
    text: 'What tasks are open?',
    expect: ['list_notes'],
  },
  {
    id: 'tax-en',
    text: 'Is my tax filing up to date?',
    expect: ['get_tax_summary'],
  },
  {
    id: 'team-en',
    text: 'Who works here?',
    expect: ['list_team_members'],
  },
  {
    id: 'low-stock-sw',
    text: 'Niambie bidhaa gani zinaisha kwenye stoo',
    // Low stock can be answered directly or via the active-alert feed.
    expect: ['get_low_stock', 'get_active_alerts'],
  },
  {
    id: 'expense-write-en',
    text: 'I paid 5000 rent',
    expect: ['record_expense'],
  },
  {
    id: 'income-write-en',
    text: 'Received 2000 service fee',
    expect: ['record_income'],
  },
  {
    id: 'adjust-stock-en',
    text: 'Stock count says 12 sugar left',
    expect: ['adjust_stock', 'search_inventory', 'list_inventory'],
    followUp: {
      expect: ['adjust_stock'],
      result: [
        { id: 'item_sugar', name: 'Sugar', unit: 'kg', quantity: 20 },
      ],
    },
  },
  {
    id: 'archive-en',
    text: 'Stop selling the Old Juice product',
    expect: ['archive_inventory_item', 'search_inventory', 'list_inventory'],
    followUp: {
      expect: ['archive_inventory_item'],
      result: [
        { id: 'item_old_juice', name: 'Old juice', unit: 'bottle', quantity: 4 },
      ],
    },
  },
  {
    id: 'credit-payment-en',
    text: 'Mama Njeri paid 300',
    expect: ['record_credit_payment', 'get_credit_summary'],
  },
];

/**
 * @param {OpenAI} client
 * @param {Array<Record<string, unknown>>} messages
 * @param {unknown[]} tools
 */
async function complete(client, messages, tools = TOOL_SCHEMAS) {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0,
  });
  return response.choices?.[0]?.message;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry 429s with backoff; provider TPM limits are easy to hit with a full tool list. */
async function completeWithRetry(client, messages, tools = TOOL_SCHEMAS) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await complete(client, messages, tools);
    } catch (error) {
      lastError = error;
      const status = error?.status ?? error?.response?.status;
      if (status !== 429 || attempt === 4) throw error;
      const retryAfter = Number(
        error?.headers?.['retry-after'] ??
          error?.response?.headers?.['retry-after'] ??
          0,
      );
      const waitMs = retryAfter
        ? Math.min(45_000, retryAfter * 1000)
        : 8000 * attempt;
      await sleep(waitMs);
    }
  }
  throw lastError;
}

/**
 * @param {ReturnType<typeof complete> extends Promise<infer T> ? T : never} message
 */
function firstCall(message) {
  const call = message?.tool_calls?.[0];
  if (!call) return null;
  let args = null;
  try {
    args = JSON.parse(call.function.arguments || '{}');
  } catch {
    args = { _unparseable: call.function.arguments };
  }
  return { name: call.function.name, args, id: call.id };
}

async function main() {
  if (!MASTER_KEY) {
    console.error(
      'Missing LITELLM_MASTER_KEY. Run with --env-file=apps/gateway/.env.',
    );
    process.exitCode = 2;
    return;
  }

  const client = new OpenAI({
    baseURL: BASE_URL,
    apiKey: MASTER_KEY,
    timeout: 60_000,
    maxRetries: 0,
  });

  const only = (process.env.ASSISTANT_EVAL_ONLY ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const selectedCases = only.length
    ? CASES.filter((testCase) => only.includes(testCase.id))
    : CASES;

  const results = [];
  for (const testCase of selectedCases) {
    try {
      // Gemini/Groq free tiers rate-limit tokens/requests per minute; spacing
      // the calls keeps the eval repeatable without long retry storms.
      await sleep(Number(process.env.ASSISTANT_EVAL_DELAY_MS ?? 6500));
      const message = await completeWithRetry(client, [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: testCase.text },
      ]);
      const call = firstCall(message);
      let passed = Boolean(call && testCase.expect.includes(call.name));
      let actual = call?.name ?? null;
      let detail = null;

      // Follow-up cases resolve an item ID first, then take the write action.
      if (
        call &&
        testCase.followUp &&
        ['search_inventory', 'list_inventory'].includes(call.name)
      ) {
        const second = await completeWithRetry(
          client,
          [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: testCase.text },
            {
              role: 'assistant',
              content: message?.content ?? null,
              tool_calls: [
                {
                  id: call.id,
                  type: 'function',
                  function: {
                    name: call.name,
                    arguments: JSON.stringify(call.args ?? {}),
                  },
                },
              ],
            },
            {
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({ result: testCase.followUp.result }),
            },
          ],
        );
        const secondCall = firstCall(second);
        actual = `${call.name} → ${secondCall?.name ?? 'no tool call'}`;
        passed = Boolean(
          secondCall && testCase.followUp.expect.includes(secondCall.name),
        );
        detail =
          typeof second?.content === 'string'
            ? second.content.slice(0, 180)
            : null;
      }

      results.push({
        id: testCase.id,
        status: passed ? 'PASS' : 'FAIL',
        expected: testCase.followUp
          ? [...testCase.expect, `then ${testCase.followUp.expect.join('/')}`]
          : testCase.expect,
        actual,
        args: call?.args ?? null,
        detail,
        sample: typeof message?.content === 'string' ? message.content.slice(0, 180) : null,
      });
    } catch (error) {
      results.push({
        id: testCase.id,
        status: 'ERROR',
        expected: testCase.expect,
        actual: null,
        error: `${error?.status ?? ''} ${error?.message ?? error}`.slice(0, 240),
      });
    }
  }

  // C16 ambiguity: two "sugar" items. The model must ask which one, not sell
  // the first match silently.
  if (process.env.ASSISTANT_EVAL_SKIP_AMBIGUITY !== '1') try {
    const ambiguityTools = TOOL_SCHEMAS.filter((tool) =>
      [
        'search_inventory',
        'list_inventory',
        'record_sale',
        'get_low_stock',
      ].includes(tool.function.name),
    );
    const first = await completeWithRetry(
      client,
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: 'Sell 3 sugar' },
      ],
      ambiguityTools,
    );
    const firstTool = firstCall(first);
    if (firstTool?.name === 'record_sale') {
      results.push({
        id: 'ambiguity-c16',
        status: 'FAIL',
        expected: ['search_inventory/list_inventory, then a clarification question'],
        actual: 'record_sale',
        detail: 'Sold the first match without resolving two sugar items.',
      });
    } else if (!firstTool) {
      const asks =
        typeof first?.content === 'string' &&
        /[?]|which|gani|ipi|clarif|two|mbili/i.test(first.content);
      results.push({
        id: 'ambiguity-c16',
        status: asks ? 'PASS' : 'FAIL',
        expected: ['a clarification question, no sale'],
        actual: 'no tool call',
        detail: typeof first?.content === 'string' ? first.content.slice(0, 240) : null,
      });
    } else {
      const second = await completeWithRetry(
        client,
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: 'Sell 3 sugar' },
          {
            role: 'assistant',
            content: first?.content ?? null,
            tool_calls: [
              {
                id: firstTool.id,
                type: 'function',
                function: {
                  name: firstTool.name,
                  arguments: JSON.stringify(firstTool.args ?? {}),
                },
              },
            ],
          },
          {
            role: 'tool',
            tool_call_id: firstTool.id,
            content: JSON.stringify({
              result: [
                { id: 'item_sugar_1kg', name: 'Sugar 1 kg', unit: 'kg', quantity: 20 },
                { id: 'item_sugar_2kg', name: 'Sugar 2 kg', unit: 'kg', quantity: 8 },
              ],
            }),
          },
        ],
        ambiguityTools,
      );
      const secondTool = firstCall(second);
      const asks =
        typeof second?.content === 'string' &&
        /[?]|which|gani|ipi|clarif/i.test(second.content);
      const passed = !secondTool && asks;
      results.push({
        id: 'ambiguity-c16',
        status: passed ? 'PASS' : 'FAIL',
        expected: ['a clarification question, no sale'],
        actual: secondTool?.name ?? 'no tool call',
        detail:
          typeof second?.content === 'string' ? second.content.slice(0, 240) : null,
      });
    }
  } catch (error) {
    results.push({
      id: 'ambiguity-c16',
      status: 'ERROR',
      expected: ['a clarification question, no sale'],
      actual: null,
      error: `${error?.status ?? ''} ${error?.message ?? error}`.slice(0, 240),
    });
  }

  const passed = results.filter((result) => result.status === 'PASS').length;
  const total = results.length;
  console.log(
    JSON.stringify(
      {
        model: MODEL,
        baseUrl: BASE_URL,
        generatedAt: new Date().toISOString(),
        summary: { passed, total, passRate: Math.round((passed / total) * 100) },
        results,
      },
      null,
      2,
    ),
  );
  process.exitCode = passed === total ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
