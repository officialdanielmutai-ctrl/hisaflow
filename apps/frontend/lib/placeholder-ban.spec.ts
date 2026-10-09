import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/**
 * Build-time placeholder ban (`hisaflow-landing-page.md` Layer L-B,
 * `hisaflow-landing-visual-spec.md` Section 7.6). If any of these tokens can
 * survive into shipped marketing source, the test fails rather than letting a
 * placeholder or a reference-image string deploy by accident.
 */
const MARKETING_ROOTS = [
  'components/marketing',
  'features/marketing',
  'app/(marketing)',
];

const FORBIDDEN: Array<{ name: string; pattern: RegExp }> = [
  { name: 'TODO', pattern: /\bTODO\b/ },
  { name: 'FIXME', pattern: /\bFIXME\b/ },
  // House style: no em dashes in any shipped marketing copy.
  { name: 'em dash', pattern: /—/ },
  { name: 'lorem ipsum', pattern: /lorem ipsum/i },
  { name: 'PLACEHOLDER constant', pattern: /\bPLACEHOLDER\b/ },
  // Reference-image brands and copy that must never be shipped.
  { name: 'Mintro', pattern: /Mintro/ },
  { name: 'Netdot', pattern: /Netdot/ },
  { name: 'Sparkweb', pattern: /Sparkweb/ },
  { name: 'Pixelpath', pattern: /Pixelpath/ },
  { name: 'CodeLine', pattern: /CodeLine/ },
  { name: 'Digitech', pattern: /Digitech/ },
  { name: 'Train Your Dog', pattern: /Train Your Dog/i },
  // Invented trust signals.
  { name: 'invented user count', pattern: /\bActive Users\b/i },
  { name: 'invented review rating', pattern: /\b5[- ]star\b/i },
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

describe('marketing placeholder ban', () => {
  const files = MARKETING_ROOTS.flatMap(sourceFiles);

  it('finds marketing source to scan', () => {
    expect(files.length).toBeGreaterThan(10);
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
