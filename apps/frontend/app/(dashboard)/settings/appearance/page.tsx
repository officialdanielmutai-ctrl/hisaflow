'use client'

import { Palette, ShieldCheck } from 'lucide-react'
import { themeForId } from '@hisaflow/theme'
import { ThemePicker } from '@/components/settings/ThemePicker'
import { useTheme } from '@/components/providers/ThemeProvider'

export default function AppearanceSettingsPage() {
  const { preference, themeId } = useTheme()
  const active = themeForId(themeId)

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-24 lg:max-w-4xl">
      <header>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-[var(--hf-accent-default)]" />
          <h1 className="text-2xl font-bold tracking-tight">Appearance</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Pick a theme. Colour, shape, depth, spacing and motion change
          together.
        </p>
      </header>

      <section className="hf-card flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
              Theme
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {preference === 'auto'
                ? `Auto — currently ${active.name}`
                : `${active.name} — ${active.description}`}
            </p>
          </div>
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
            {active.mode === 'dark' ? 'Dark' : 'Light'}
          </span>
        </div>

        <ThemePicker />
      </section>

      <section className="rounded-[var(--hf-radius-card)] border border-[var(--hf-border-subtle)] bg-[var(--hf-bg-elevated)] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--hf-status-success)]" />
          <div>
            <h2 className="text-sm font-semibold text-[var(--hf-text-primary)]">
              Readable by construction
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--hf-text-secondary)]">
              Every theme is tested for WCAG AA contrast; Contrast goes further
              to AAA body text with thicker focus rings. Status colours always
              keep their icon or text cue, and reduced-motion preferences are
              honoured in every theme.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
