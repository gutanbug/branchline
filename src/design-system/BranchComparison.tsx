import type { ReactNode } from 'react'
import { Badge, Button, Notice } from './components'

export function BranchComparison({ source, target, bases, shallow = false, onBase }: { source: { name: string; sha: string; count: number; graph: ReactNode }; target: { name: string; sha: string; count: number; graph: ReactNode }; bases: string[]; shallow?: boolean; onBase: (sha: string) => void }) {
  return <section className="bl-branch-comparison" aria-label="두 브랜치 그래프">
    <div className="bl-comparison-graphs">{([['가져올 브랜치', source], ['반영할 브랜치', target]] as const).map(([label, side]) => <section key={label} aria-label={`${label} 그래프`} className="bl-comparison-side"><header><div><small>{label}</small><h2 title={side.name}>{side.name}</h2><code title={side.sha}>{side.sha.slice(0, 12)}</code></div><Badge>이쪽에만 {side.count}개</Badge></header><div className="bl-comparison-graph-body">{side.graph}</div></section>)}</div>
    <div className="bl-comparison-bases"><strong>공통 조상</strong>{bases.map(sha => <Button key={sha} title={sha} onClick={() => onBase(sha)}>양쪽에서 보기 · {sha.slice(0, 8)}</Button>)}{!bases.length && <Notice compact>{shallow ? 'Shallow 저장소입니다. 로컬 이력에서 공통 조상을 찾지 못했습니다.' : '두 브랜치에 공통 조상이 없습니다.'}</Notice>}</div>
  </section>
}
