import { Button } from './components'
import { ContextMenu, type ContextAction } from './ContextMenu'

export function DiffStats({ added, deleted, reason }: { added?: number | null; deleted?: number | null; reason?: string }) {
  const known = typeof added === 'number' && typeof deleted === 'number'
  return <span className="bl-change-stats" aria-label={known ? `추가 ${added}줄, 삭제 ${deleted}줄` : reason || '변경 줄 수 조회 중'} title={reason}>
    {known ? <><span className="bl-change-added">+{added.toLocaleString('ko-KR')}</span><span className="bl-change-deleted">−{deleted.toLocaleString('ko-KR')}</span></> : <span className="bl-muted">{reason || '…'}</span>}
  </span>
}
export function FileChangeRow({ path, originalPath, status, selected, staged, disabled, stats, onSelect, onToggle, menuGroups, menuDisabled = disabled }: {
  menuGroups?: ContextAction[][]; menuDisabled?: boolean; path: string; originalPath?: string | null; status: string; selected: boolean; staged: boolean; disabled: boolean;
  stats?: { added: number | null; deleted: number | null; reason?: string }; onSelect: () => void; onToggle: () => void;
}) {
  const added = ['?', 'A'].includes(status), deleted = status === 'D', label = added ? '추가' : deleted ? '삭제' : status === '!' ? '충돌' : status === 'R' ? '이름 변경' : '수정'
  const selection = <Button variant="ghost" className="bl-change-file" aria-pressed={selected} aria-label={`${label} ${path}`} title={path} onClick={onSelect}>
      <span className={`bl-change-kind ${added ? 'bl-change-added' : deleted ? 'bl-change-deleted' : ''}`}>{label}</span>
      <span className="bl-change-path"><strong>{path.split('/').at(-1)}</strong><small>{path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '저장소 루트'}</small><span className="sr-only">{path}</span>{originalPath && <small>이전: {originalPath}</small>}</span>
      <DiffStats {...stats} />
    </Button>
  return <div className="bl-change-row">
    {menuGroups ? <ContextMenu label={path} description={staged ? '스테이징된 변경' : '작업 파일 변경'} groups={menuGroups} showButton disabled={menuDisabled}>{selection}</ContextMenu> : selection}
    <Button className="bl-change-toggle" disabled={disabled} aria-label={`${path} ${staged ? '스테이징 해제' : '스테이징'}`} title={staged ? '스테이징 해제' : '스테이징'} onClick={onToggle}>{staged ? '−' : '+'}</Button>
  </div>
}
