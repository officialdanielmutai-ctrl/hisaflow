import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/**
 * Tailwind v3 utility guard (overhaul Duty 1, defect Q-001/Q-002).
 *
 * The app is on Tailwind CSS 3.4.x. v4-only utilities and non-scale fractions
 * compile to nothing, so they silently ship as no-ops (e.g. `shadow-xs`,
 * `shadow-2xs`) and unstyled icons (`h-4.5`), which is exactly the ISP KPI
 * header misalignment that was reported. This guard fails the build if any
 * reappear, so the same class of defect cannot return one card at a time.
 *
 * Scope is the rendered UI source only; `lib/` is excluded so this spec's own
 * pattern strings are never scanned.
 */
const UI_ROOTS = ['app', 'components', 'features'];

const FORBIDDEN: Array<{ name: string; pattern: RegExp }> = [
  // `h-4.5`, `w-4.5`, `gap-x-4.5`, `p-4.5`, ... not on the v3 spacing scale.
  { name: 'non-scale 4.5 spacing', pattern: /\b[a-z][a-z-]*-4\.5\b/ },
  // `shadow-xs` / `shadow-2xs` are Tailwind v4 names; v3 stops at `shadow-sm`.
  { name: 'Tailwind v4 shadow-xs/2xs', pattern: /\bshadow-(?:2xs|xs)\b/ },
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (['.ts', '.tsx'].includes(extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

describe('tailwind v3 utility guard', () => {
  const files = UI_ROOTS.flatMap(sourceFiles);

  it('finds UI source to scan', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  for (const forbidden of FORBIDDEN) {
    it(`contains no "${forbidden.name}"`, () => {
      const offenders = files.filter((file) =>
        forbidden.pattern.test(readFileSync(file, 'utf8')),
      );
      expect(offenders).toEqual([]);
    });
  }
});
