import type { ReactNode } from 'react'
import { Badge } from './components'

export function ActionSummary({ title, status, facts, next, children, headingLevel = 3 }: { title: string; status: string; facts: { label: string; value: string }[]; next: string; children?: ReactNode; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return <section className="bl-action-summary" aria-label={title}>
    <div className="bl-action-summary-heading"><Heading>{title}</Heading><Badge>{status}</Badge></div>
    <dl>{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
    <p><strong>다음 확인</strong> · {next}</p>
    {children}
  </section>
}
