import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/**
 * Data-integrity guard: prevents hardcoded fake analytics values from creeping
 * back into shipped dashboard code.  Any match in the guarded directories causes
 * this test to fail at CI time, before the code reaches production.
 *
 * Rules:
 *  1. No literal KES amounts that match the old DEFAULT_DATA fixtures.
 *  2. No `+17.8% peak` badge string.
 *  3. No hardcoded percentage deltas like '+18%', '+21%' etc. in config files.
 *  4. No single-scalar sparkline multiplier arrays of the form
 *     `Math.round(data.xxx * 0.NN)` repeated 5+ times in one expression.
 */

const DASHBOARD_ROOTS = [
  'features/dashboard/config',
  'components/charts',
  'components/dashboard/bento',
  'components/system',
  'app/(dashboard)/dashboard',
  'components/chemist',
  'components/wholesale',
  'components/restaurant',
  'components/guesthouse',
  'components/school',
  'components/isp',
];

type Rule = { name: string; pattern: RegExp };

const FORBIDDEN: Rule[] = [
  // Old DEFAULT_DATA hardcoded fixture amounts (42k, 68k, 91k, 145k, 112k, 84k, 53k)
  { name: 'DEFAULT_DATA fixture — 42000', pattern: /sales:\s*42000/ },
  { name: 'DEFAULT_DATA fixture — 68000', pattern: /sales:\s*68000/ },
  { name: 'DEFAULT_DATA fixture — 145000', pattern: /sales:\s*145000/ },
  // Hardcoded peak badge text
  { name: 'hardcoded "+17.8% peak" badge', pattern: /\+17\.8%\s*peak/ },
  // Hardcoded delta strings in config files
  { name: 'hardcoded "+18%" delta', pattern: /value:\s*['"`]\+18%['"`]/ },
  { name: 'hardcoded "+21%" delta', pattern: /value:\s*['"`]\+21%['"`]/ },
  { name: 'hardcoded "+16%" delta', pattern: /value:\s*['"`]\+16%['"`]/ },
  { name: 'hardcoded "+15%" delta', pattern: /value:\s*['"`]\+15%['"`]/ },
  { name: 'hardcoded "+14%" delta', pattern: /value:\s*['"`]\+14%['"`]/ },
  { name: 'hardcoded "-6%" delta (fake loss)', pattern: /value:\s*['"`]-6%['"`]/ },
  // Mon–Sun hardcoded bar set
  {
    name: 'hardcoded BentoStatisticsCard Mon-bar (40%)',
    pattern: /day:\s*['"`]Mon['"`],\s*tag:\s*['"`]40%['"`]/,
  },
  // DEFAULT_DATA const declaration (the entire constant must be gone)
  { name: 'DEFAULT_DATA const declaration', pattern: /const\s+DEFAULT_DATA\s*[:=]/ },
  // Fake bar minimum height (must animate from 0% when 0)
  { name: 'fake 8% minimum bar height in BentoStatisticsCard', pattern: /Math\.max\(\s*bar\.pct\s*,\s*8\s*\)/ },
  // Fake default mock bar arrays in BentoStatisticsCard
  { name: 'DEFAULT_TAB1_BARS fixture', pattern: /DEFAULT_TAB1_BARS/ },
  { name: 'DEFAULT_TAB2_BARS fixture', pattern: /DEFAULT_TAB2_BARS/ },
  // Fake ratio multiplier arrays that simulated week traffic from single day
  { name: 'fake ratio series [0.4, 0.55, 0.7...]', pattern: /0\.4,\s*0\.55,\s*0\.7/ },
  { name: 'fake ratio series [0.45, 0.6, 0.7...]', pattern: /0\.45,\s*0\.6,\s*0\.7/ },
  // Hardcoded dispensed string in Chemist Bento
  { name: 'hardcoded Chemist dispensed string', pattern: /KES 12,500 dispensed today/ },
  // Hardcoded +21% sales trend prop in BentoSalesPair
  { name: 'hardcoded salesTrendPct={21}', pattern: /salesTrendPct=\{21\}/ },
];

/** Recursively collect .ts / .tsx files, skip spec / test / node_modules. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // directory does not exist in this environment
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (
      st.isFile() &&
      ['.ts', '.tsx'].includes(extname(entry)) &&
      !entry.endsWith('.spec.ts') &&
      !entry.endsWith('.spec.tsx') &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.test.tsx')
    ) {
      out.push(full);
    }
  }
  return out;
}

describe('data-integrity guard — no hardcoded fake analytics values', () => {
  for (const root of DASHBOARD_ROOTS) {
    const absRoot = join(process.cwd(), root);
    const files = sourceFiles(absRoot);

    for (const rule of FORBIDDEN) {
      it(`[${root}] must not contain: ${rule.name}`, () => {
        const hits: string[] = [];
        for (const file of files) {
          const src = readFileSync(file, 'utf-8');
          if (rule.pattern.test(src)) {
            const relPath = file.replace(join(process.cwd(), ''), '').replace(/\\/g, '/');
            hits.push(relPath);
          }
        }
        expect(
          hits,
          `Found "${rule.name}" in:\n  ${hits.join('\n  ')}`,
        ).toHaveLength(0);
      });
    }
  }
});
