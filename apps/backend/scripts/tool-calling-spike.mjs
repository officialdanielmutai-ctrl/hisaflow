// @ts-check
/**
 * Tool-calling spike (overhaul Duty 2, Phase A/B gate).
 *
 * Verifies, per underlying provider model behind the LiteLLM gateway, that the
 * model actually returns OpenAI-style `tool_calls` (and does so for a Swahili
 * request). The assistant model group must only contain models that pass this
 * spike; see apps/gateway/config.yaml `hisaflow-assistant`.
 *
 * Run (keys come from the gateway env, never printed):
 *   node --env-file=apps/gateway/.env apps/backend/scripts/tool-calling-spike.mjs
 */
import OpenAI from 'openai';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_low_stock',
      description: 'Return inventory items at or below their reorder threshold.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Maximum number of items.' },
        },
        required: [],
      },
    },
  },
];

const PROVIDERS = [
  {
    name: 'groq',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
    model: 'openai/gpt-oss-120b',
  },
  {
    name: 'groq',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
    model: 'qwen/qwen3.8-27b',
  },
  {
    name: 'cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    apiKey: process.env.CEREBRAS_API_KEY,
    model: 'gpt-oss-120b',
  },
  {
    name: 'openrouter-deepseek',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: 'deepseek/deepseek-chat',
  },
  {
    name: 'mistral',
    baseURL: 'https://api.mistral.ai/v1',
    apiKey: process.env.MISTRAL_API_KEY,
    model: 'mistral-medium-latest',
  },
  {
    name: 'gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
  },
];

const CASES = [
  { id: 'en', text: 'Which items are low on stock? Show at most 5.' },
  { id: 'sw', text: 'Niambie bidhaa gani zinaisha kwenye stoo, kama tano.' },
];

async function probe(provider, text) {
  const client = new OpenAI({
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
    timeout: 30_000,
    maxRetries: 0,
  });
  const response = await client.chat.completions.create({
    model: provider.model,
    messages: [{ role: 'user', content: text }],
    tools: TOOLS,
    tool_choice: 'auto',
    temperature: 0,
  });
  const message = response.choices?.[0]?.message;
  const call = message?.tool_calls?.[0];
  if (!call) return { toolCall: false, args: null, text: message?.content ?? '' };
  let args = null;
  try {
    args = JSON.parse(call.function.arguments || '{}');
  } catch {
    args = { _unparseable: call.function.arguments };
  }
  return { toolCall: true, name: call.function.name, args };
}

const results = [];
for (const provider of PROVIDERS) {
  if (!provider.apiKey) {
    results.push({ provider: provider.name, model: provider.model, status: 'skipped (no key)' });
    continue;
  }
  for (const testCase of CASES) {
    try {
      const result = await probe(provider, testCase.text);
      results.push({
        provider: provider.name,
        model: provider.model,
        case: testCase.id,
        status: result.toolCall ? 'PASS' : 'FAIL (no tool_call)',
        tool: result.name ?? null,
        args: result.args,
        // Truncated, non-sensitive: helps judge phrasing only.
        sample: result.text ? result.text.slice(0, 120) : null,
      });
    } catch (error) {
      results.push({
        provider: provider.name,
        model: provider.model,
        case: testCase.id,
        status: `ERROR: ${error?.status ?? ''} ${error?.message ?? error}`.slice(0, 160),
      });
    }
  }
}

console.log(JSON.stringify(results, null, 2));
