import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const globals = readFileSync(
  join(__dirname, '..', 'app', 'globals.css'),
  'utf8'
)
const dashboardLayout = readFileSync(
  join(__dirname, '..', 'app', '(dashboard)', 'layout.tsx'),
  'utf8'
)

describe('legacy text contrast bridge', () => {
  it('scopes the bridge to the themed app shell', () => {
    expect(dashboardLayout).toContain('data-hf-app')
    expect(globals).toContain('[data-hf-app]')
  })

  it('maps neutral text utilities to semantic text tokens', () => {
    expect(globals).toContain('text-gray-9')
    expect(globals).toContain('text-gray-4')
    expect(globals).toContain('var(--hf-text-primary)')
    expect(globals).toContain('var(--hf-text-secondary)')
    expect(globals).toContain('var(--hf-text-muted)')
  })

  it('maps solid accent and status backgrounds with a readable foreground', () => {
    expect(globals).toContain('bg-[var(--color-accent)]')
    expect(globals).toContain('bg-emerald-600')
    expect(globals).toContain('bg-amber-500')
    expect(globals).toContain('bg-red-500')
    expect(globals).toContain('var(--hf-accent-foreground)')
  })

  it('maps legacy status text utilities to status tokens', () => {
    expect(globals).toContain('text-red-')
    expect(globals).toContain('text-rose-')
    expect(globals).toContain('var(--hf-status-danger)')
    expect(globals).toContain('var(--hf-status-warning)')
    expect(globals).toContain('var(--hf-status-success)')
    expect(globals).toContain('var(--hf-status-info)')
  })
})
