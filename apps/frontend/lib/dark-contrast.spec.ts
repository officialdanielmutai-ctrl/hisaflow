import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard for the dark-mode palette. Rather than eyeballing the colours, this
 * reads the `.dark` token block from `globals.css` and asserts the WCAG
 * contrast ratios the design relies on. If someone dims a text token or
 * brightens the accent button, this fails.
 */

function parseDarkTokens(css: string): Record<string, string> {
  const block = css.match(/\.dark\s*\{([\s\S]*?)\}/);
  if (!block) throw new Error('Could not find the .dark token block in globals.css');
  const tokens: Record<string, string> = {};
  for (const match of block[1].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    tokens[match[1]] = match[2];
  }
  return tokens;
}

function luminance(hex: string): number {
  let value = hex.replace('#', '');
  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const channel = (index: number) => {
    const c = parseInt(value.slice(index, index + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
const tokens = parseDarkTokens(css);
const surface = tokens['--color-bg-surface'];

describe('dark mode contrast', () => {
  it('uses a card surface token', () => {
    expect(surface).toBeTruthy();
  });

  it('keeps body text at AAA on the card surface', () => {
    expect(contrast(tokens['--color-text-primary'], surface)).toBeGreaterThanOrEqual(7);
  });

  it('keeps secondary and muted text at AA on the card surface', () => {
    expect(contrast(tokens['--color-text-secondary'], surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['--color-text-muted'], surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps white text on the accent (primary buttons) at AA', () => {
    expect(contrast('#ffffff', tokens['--color-accent'])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps accents and borders legible as UI elements (3:1 / visible edge)', () => {
    expect(contrast(tokens['--color-accent'], surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(tokens['--color-border'], surface)).toBeGreaterThanOrEqual(1.5);
  });
});
