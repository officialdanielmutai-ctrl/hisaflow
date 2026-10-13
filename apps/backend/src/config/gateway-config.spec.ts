import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Q-005 regression guard.
 *
 * The LiteLLM gateway config drifted from the provider catalogues (stale 404
 * model IDs, a 403 key, and a Bedrock fallback with no credentials), and
 * nothing caught it because the config is never compiled or typed. This guard
 * runs inside the normal backend Jest job so any future edit is checked
 * against the models actually verified by
 * `apps/backend/scripts/tool-calling-spike.mjs`.
 *
 * It is intentionally dependency-free: it treats the YAML as text, ignores
 * comments (so a disabled deployment can document why it is off), and asserts
 * the small set of invariants that the defect violated.
 */
const CONFIG_PATH = resolve(
  __dirname,
  '../../../../apps/gateway/config.yaml',
);

/** Model IDs confirmed (English + Swahili tool-calling) by the spike. */
const VERIFIED_MODELS = new Set([
  'groq/openai/gpt-oss-120b',
  'openrouter/deepseek/deepseek-chat',
  'gemini/gemini-2.5-flash',
  'gemini/gemini-2.5-pro',
]);

/** Model IDs that drifted/broke and must never be re-enabled without re-verification. */
const BROKEN_MODELS = [
  'groq/llama-3.3-70b-versatile',
  'cerebras/llama-3.3-70b',
  'mistral/mistral-large-latest',
  'bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0',
];

/** Strip comments and blank lines, leaving only active YAML content. */
function activeLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

describe('LiteLLM gateway config (Q-005 regression guard)', () => {
  const raw = readFileSync(CONFIG_PATH, 'utf8');
  const lines = activeLines(raw);

  it('never enables a model ID that is known to be broken', () => {
    const active = lines.join('\n');
    for (const model of BROKEN_MODELS) {
      expect(active).not.toContain(model);
    }
  });

  it('only enables model IDs verified by the tool-calling spike', () => {
    const activeModels = lines
      .map((line) => /^-?\s*model:\s*(\S+)/.exec(line)?.[1])
      .filter((model): model is string => Boolean(model));

    expect(activeModels.length).toBeGreaterThan(0);
    for (const model of activeModels) {
      expect(VERIFIED_MODELS.has(model)).toBe(true);
    }
  });

  it('resolves every fallback target to a defined model group', () => {
    const groups = new Set(
      lines
        .map((line) => /^-?\s*model_name:\s*(\S+)/.exec(line)?.[1])
        .filter((name): name is string => Boolean(name)),
    );

    const start = lines.findIndex((line) => line === 'fallbacks:');
    expect(start).toBeGreaterThanOrEqual(0);
    const end = lines.findIndex(
      (line, index) => index > start && /^[a-z_]+:$/.test(line),
    );
    const fallbackLines = lines.slice(start + 1, end === -1 ? undefined : end);
    const referenced = fallbackLines.flatMap(
      (line) => line.match(/hisaflow-[a-z0-9-]+/g) ?? [],
    );

    expect(referenced.length).toBeGreaterThan(0);
    for (const name of referenced) {
      expect(groups.has(name)).toBe(true);
    }
  });

  it('does not reference the unprovisioned premium/Bedrock fallback', () => {
    expect(lines.join('\n')).not.toContain('hisaflow-premium');
  });
});
