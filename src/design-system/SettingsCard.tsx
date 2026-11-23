import { useId, type ReactNode } from 'react'

/** One settings group: heading row (title, description, status/actions on the right) and its content. */
export function SettingsCard({ title, description, aside, children, label }: { title: string; description?: ReactNode; aside?: ReactNode; children?: ReactNode; label?: string }) {
  const id = useId()
  return <section className="bl-settings-card" aria-label={label} aria-labelledby={label ? undefined : `${id}-title`}>
    <div className="bl-settings-card-heading">
      <div><h2 id={`${id}-title`}>{title}</h2>{description && <p>{description}</p>}</div>
      {aside && <div className="bl-settings-card-aside">{aside}</div>}
    </div>
    {children && <div className="bl-settings-card-body">{children}</div>}
  </section>
}
