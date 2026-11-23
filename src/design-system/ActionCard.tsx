import { useId, type ReactNode } from 'react'
import { Icon } from './IconButton'

type IconName = Parameters<typeof Icon>[0]['name']

/** A large choice button for start screens, inspired by Magic UI's Bento card: icon, title, one-line description. */
export function ActionCard({ icon, title, description, primary = false, disabled, onClick }: { icon: IconName; title: string; description: ReactNode; primary?: boolean; disabled?: boolean; onClick: () => void }) {
  const id = useId()
  return <button type="button" className="bl-action-card" data-primary={primary || undefined} disabled={disabled} onClick={onClick} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
    <span className="bl-action-card-icon"><Icon name={icon} /></span>
    <strong id={`${id}-title`}>{title}</strong>
    <small id={`${id}-description`}>{description}</small>
  </button>
}

export function ActionCardGrid({ label, children }: { label: string; children: ReactNode }) {
  return <div className="bl-action-cards" role="group" aria-label={label}>{children}</div>
}
