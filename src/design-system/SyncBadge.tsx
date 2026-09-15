import { Badge } from './components'

/** Counts describe commits relative to the configured tracking branch. */
export function SyncBadge({ direction, count, icon = true }: { icon?: boolean; direction: 'incoming' | 'outgoing'; count: number | null }) {
  const label = `${direction === 'incoming' ? '받을' : '보낼'} 커밋 ${count === null ? '확인 불가' : `${count.toLocaleString('ko-KR')}개`}`
  return <span className="bl-sync-badge" title={label} aria-label={label} data-pending={!!count}><Badge><span aria-hidden="true">{icon ? direction === 'incoming' ? '↓ ' : '↑ ' : ''}{count === null ? '—' : count > 999 ? '999+' : count.toLocaleString('ko-KR')}</span></Badge></span>
}
