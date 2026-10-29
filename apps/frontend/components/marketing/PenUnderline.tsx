'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const STROKES = [
  'M 5 10 C 42 4 78 5 116 8 S 196 12 235 5',
  'M 10 21 C 48 13 86 19 124 15 S 198 19 232 11',
]

/**
 * Double hand-drawn pen underline that draws itself as the word scrolls into
 * view. Progress is tied to the viewport so the note feels marked in a journal
 * rather than played as a one-off loop.
 */
export function PenUnderline({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null)
  const pathRefs = useRef<(SVGPathElement | null)[]>([])

  useEffect(() => {
    const wrapper = wrapperRef.current
    const paths = pathRefs.current.filter(
      (path): path is SVGPathElement => Boolean(path)
    )
    if (!wrapper || paths.length === 0) return

    const lengths = paths.map((path) =>
      typeof path.getTotalLength === 'function' ? path.getTotalLength() : 0
    )
    if (lengths.some((length) => length === 0)) return

    paths.forEach((path, index) => {
      path.style.strokeDasharray = `${lengths[index]}`
    })

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced) {
      paths.forEach((path) => {
        path.style.strokeDashoffset = '0'
      })
      return
    }

    paths.forEach((path, index) => {
      path.style.strokeDashoffset = `${lengths[index]}`
    })

    let frame = 0
    const update = () => {
      frame = 0
      const rect = wrapper.getBoundingClientRect()
      const viewport = window.innerHeight || 1
      const start = viewport * 0.95
      const end = viewport * 0.5
      const progress = Math.min(
        1,
        Math.max(0, (start - rect.top) / (start - end))
      )

      paths.forEach((path, index) => {
        const delay = index * 0.16
        const local = Math.min(
          1,
          Math.max(0, (progress - delay) / (1 - delay))
        )
        path.style.strokeDashoffset = `${lengths[index] * (1 - local)}`
      })
    }

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <span
      ref={wrapperRef}
      className={cn(
        'relative isolate inline-block whitespace-nowrap text-[var(--mk-ink)]',
        className
      )}
    >
      {children}
      <svg
        aria-hidden="true"
        viewBox="0 0 240 28"
        preserveAspectRatio="none"
        fill="none"
        className="pointer-events-none absolute -bottom-[0.14em] left-[-0.08em] -z-10 h-[0.5em] w-[calc(100%+0.16em)] overflow-visible"
      >
        {STROKES.map((d, index) => (
          <path
            key={d}
            ref={(node) => {
              pathRefs.current[index] = node
            }}
            d={d}
            stroke="var(--mk-accent)"
            strokeWidth={index === 0 ? 3.4 : 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={index === 0 ? 0.95 : 0.72}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </span>
  )
}
