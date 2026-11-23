import type { ReactNode } from 'react'

/** Page title block shared by settings-style pages: small eyebrow, title, one-line purpose, optional actions. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return <header className="bl-page-header">
    <div>{eyebrow && <span className="bl-page-eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="bl-actions">{actions}</div>}
  </header>
}
