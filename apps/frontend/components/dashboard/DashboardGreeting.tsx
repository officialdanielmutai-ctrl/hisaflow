import { cn } from '@/lib/utils'

export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

/**
 * Weather-app-style home greeting. The scene rises, the clouds drift and the
 * sun/moon keeps a gentle ambient motion after the entrance. All motion is
 * transform/opacity-only and is disabled under reduced-motion.
 */
export function DashboardGreeting({
  name,
  timeOfDay,
  className,
}: {
  name: string
  timeOfDay: TimeOfDay
  className?: string
}) {
  const greeting = `Good ${timeOfDay}, ${name}`

  return (
    <section
      className={cn('hf-greeting', `hf-greeting--${timeOfDay}`, className)}
      aria-label={greeting}
    >
      <div className="hf-greeting-scene" aria-hidden="true">
        <span className="hf-greeting-glow" />
        <span className="hf-greeting-orb" />
        <span className="hf-greeting-cloud hf-greeting-cloud--far" />
        <span className="hf-greeting-cloud hf-greeting-cloud--mid" />
        <span className="hf-greeting-cloud hf-greeting-cloud--near" />
        {timeOfDay !== 'afternoon' && (
          <span className="hf-greeting-birds">
            <i />
            <i />
          </span>
        )}
        {timeOfDay === 'evening' && (
          <span className="hf-greeting-stars">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
        <span className="hf-greeting-horizon" />
      </div>

      <div className="hf-greeting-copy">
        <h1 className="hf-greeting-title">{greeting}</h1>
      </div>
    </section>
  )
}

export default DashboardGreeting
