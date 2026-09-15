import type { MouseEventHandler, ReactNode } from 'react'
import { Badge, Button } from './components'

export function ReviewListRow({ title, identifier, author, source, target, status, draft, updated, onClick }: { title: string; identifier: string; author: string; source?: string; target?: string; status: string; draft?: boolean; updated: string; onClick: MouseEventHandler<HTMLButtonElement> }) {
  return <Button variant="ghost" className="bl-review-list-row" onClick={onClick} aria-label={`${identifier} ${title}`}>
    <span className="bl-review-row-copy"><strong>{title}</strong><span className="bl-review-row-meta"><span>{identifier}</span><span>{author}</span>{source && <span className="bl-review-row-branch" title={`${source}${target ? ` → ${target}` : ''}`}><span aria-hidden="true">⑂ </span>{source}{target ? ` → ${target}` : ''}</span>}</span></span>
    <span className="bl-review-row-status"><span className="bl-review-row-badges">{draft && <Badge>초안</Badge>}<Badge>{status}</Badge></span><small>업데이트 {updated}</small></span>
  </Button>
}

export function ReviewDetailLayout({ title, identifier, status, draft, author, updated, source, target, actions, facts, children }: { title: string; identifier: string; status: string; draft?: boolean; author: string; updated: string; source?: string; target?: string; actions: ReactNode; facts: { label: string; value: ReactNode }[]; children: ReactNode }) {
  return <article className="bl-review-layout">
    <header className="bl-review-titlebar"><div><small>{identifier}</small><h2>{title}</h2></div><div className="bl-actions">{actions}</div></header>
    <div className="bl-review-metadata"><Badge>{status}</Badge>{draft && <Badge>초안</Badge>}<span>{author}</span><span>업데이트 {updated}</span></div>
    <div className="bl-review-direction" aria-label="병합 방향"><Badge variant="branch">{source || '출발 브랜치 미제공'}</Badge><span aria-label="대상 브랜치로">→</span><Badge variant="branch">{target || '대상 브랜치 미제공'}</Badge></div>
    <div className="bl-review-detail-columns"><div className="bl-review-main">{children}</div><aside className="bl-review-sidebar" aria-label="리뷰 정보"><dl>{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl></aside></div>
  </article>
}
