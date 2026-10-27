import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const globals = readFileSync(
  join(__dirname, '..', 'app', 'globals.css'),
  'utf8'
)

describe('marketing surface theme isolation', () => {
  it('pins the public landing page to the light brand palette', () => {
    const pageBlock = globals.match(
      /\.mk-page\s*\{(?<body>[\s\S]*?)\n {2}\}/
    )
    expect(pageBlock?.groups?.body).toBeTruthy()

    const body = pageBlock?.groups?.body ?? ''
    expect(body).toContain('color-scheme: light')
    expect(body).toContain('--mk-canvas: #faf7f2')
    expect(body).toContain('--mk-surface: #ffffff')
    expect(body).toContain('--mk-ink: #1c1b19')
    expect(body).toContain('--mk-accent: #2f6f5e')
    expect(body).toContain('--color-bg-elevated: #f1ece3')
    expect(body).toContain('--color-text-primary: #1c1b19')
  })

  it('keeps inverse white controls white when a dark app theme is saved', () => {
    expect(globals).toContain('html[data-theme] .mk-page .bg-white')
    expect(globals).toContain('background-color: #ffffff;')
  })
})
