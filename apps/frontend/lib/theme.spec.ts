import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THEME,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
  isTheme,
  nextTheme,
  resolveTheme,
} from './theme';

describe('theme helpers', () => {
  it('accepts only the two supported themes', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('system')).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });

  it('defaults unknown or missing stored values to light', () => {
    expect(DEFAULT_THEME).toBe('light');
    expect(resolveTheme(null)).toBe('light');
    expect(resolveTheme('purple')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('toggles between light and dark', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
  });

  it('bootstrap script reads the persisted key and sets the dark class', () => {
    expect(THEME_STORAGE_KEY).toBe('hisaflow.theme');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("classList.toggle('dark'");
  });
});
