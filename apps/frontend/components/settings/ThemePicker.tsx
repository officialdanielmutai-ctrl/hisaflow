'use client'

import { useMemo, useRef, type KeyboardEvent } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import type { ThemeId } from '@hisaflow/theme'
import { useTheme } from '@/components/providers/ThemeProvider'
import { cn } from '@/lib/utils'

type OptionId = ThemeId | 'auto'

function ThemePreview({ themeId }: { themeId: ThemeId }) {
  return (
    <div
      data-theme={themeId}
      aria-hidden="true"
      className="relative h-28 w-full overflow-hidden rounded-xl border"
      style={{
        backgroundColor: 'var(--hf-bg-canvas)',
        borderColor: 'var(--hf-border-subtle)',
        color: 'var(--hf-text-primary)',
      }}
    >
      <div className="flex h-full">
        <div
          className="flex w-1/5 flex-col items-center gap-1.5 py-2"
          style={{
            backgroundColor: 'var(--hf-bg-surface)',
            borderRight: 'var(--hf-border-width) solid var(--hf-border-subtle)',
          }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: 'var(--hf-accent-default)' }}
          />
          <span
            className="h-2 w-4 rounded-full"
            style={{ backgroundColor: 'var(--hf-text-muted)', opacity: 0.45 }}
          />
          <span
            className="h-2 w-4 rounded-full"
            style={{ backgroundColor: 'var(--hf-text-muted)', opacity: 0.25 }}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
          <span
            className="h-1.5 w-2/3 rounded-full"
            style={{ backgroundColor: 'var(--hf-text-primary)', opacity: 0.8 }}
          />
          <span
            className="h-1 w-1/2 rounded-full"
            style={{ backgroundColor: 'var(--hf-text-secondary)' }}
          />
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {[0, 1].map((index) => (
              <div
                key={index}
                className="p-1.5"
                style={{
                  backgroundColor: 'var(--hf-bg-surface)',
                  border:
                    'var(--hf-border-width) solid var(--hf-border-subtle)',
                  borderRadius: 'var(--hf-radius-sm)',
                  boxShadow: 'var(--hf-shadow-card)',
                }}
              >
                <span
                  className="block h-1 w-2/3 rounded-full"
                  style={{ backgroundColor: 'var(--hf-text-muted)' }}
                />
                <span
                  className="mt-1 block h-2 w-1/2 rounded-full"
                  style={{ backgroundColor: 'var(--hf-text-primary)' }}
                />
              </div>
            ))}
          </div>
          <span
            className="mt-auto block h-3.5 w-1/3"
            style={{
              backgroundColor: 'var(--hf-accent-default)',
              borderRadius: 'var(--hf-radius-sm)',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export function ThemePicker() {
  const { preference, resolved, themes, setPreference } = useTheme()
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const options = useMemo(
    () => [
      {
        id: 'auto' as const,
        name: 'Auto',
        description: 'Follow your device light/dark setting.',
        mode: null,
      },
      ...themes.map((theme) => ({
        id: theme.id,
        name: theme.name,
        description: theme.description,
        mode: theme.mode,
      })),
    ],
    [themes]
  )

  const select = (id: OptionId) => setPreference(id)

  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const keys = [
      'ArrowRight',
      'ArrowDown',
      'ArrowLeft',
      'ArrowUp',
      'Home',
      'End',
    ]
    if (!keys.includes(event.key)) return
    event.preventDefault()

    let next = index
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = options.length - 1
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (index + 1) % options.length
    } else {
      next = (index - 1 + options.length) % options.length
    }

    itemRefs.current[next]?.focus()
    const option = options[next]
    if (option) select(option.id)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Appearance theme"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
    >
      {options.map((option, index) => {
        const selected = preference === option.id
        const previewTheme = option.id === 'auto' ? resolved : option.id
        const ModeIcon =
          option.mode === 'dark'
            ? Moon
            : option.mode === 'light'
              ? Sun
              : Monitor

        return (
          <button
            key={option.id}
            ref={(node) => {
              itemRefs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={
              selected || (preference === 'auto' && index === 0) ? 0 : -1
            }
            onClick={() => select(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'group hf-motion hf-focus-ring flex min-h-[var(--hf-touch-target)] flex-col gap-2 rounded-[var(--hf-radius-lg)] border p-2 text-left transition-colors',
              selected
                ? 'border-[var(--hf-accent-default)] bg-[var(--hf-accent-subtle)]'
                : 'border-[var(--hf-border-subtle)] bg-[var(--hf-bg-surface)] hover:border-[var(--hf-border-strong)]'
            )}
          >
            <ThemePreview themeId={previewTheme} />
            <span className="flex w-full items-start gap-1.5 px-0.5">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--hf-text-primary)]">
                  <ModeIcon className="h-3.5 w-3.5 shrink-0 text-[var(--hf-text-muted)]" />
                  {option.name}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[var(--hf-text-secondary)]">
                  {option.description}
                </span>
              </span>
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                  selected
                    ? 'border-[var(--hf-accent-default)] bg-[var(--hf-accent-default)] text-[var(--hf-accent-foreground)]'
                    : 'border-[var(--hf-border-strong)] text-transparent'
                )}
                aria-hidden="true"
              >
                <Check className="h-3 w-3" />
              </span>
            </span>
            <span className="sr-only">
              {selected ? 'Selected theme' : 'Select theme'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default ThemePicker
