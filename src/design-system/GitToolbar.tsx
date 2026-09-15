import { SyncBadge } from './SyncBadge'
import { ToolbarButton } from './components'
export type GitTool = 'fetch' | 'pull' | 'push' | 'branch' | 'stash-save' | 'stash-pop'
const items: { action: GitTool; label: string; title: string; path: string }[] = [
  { action: 'fetch', label: 'Fetch', title: '원격 이력 가져오기', path: 'M12 3v11m0 0-4-4m4 4 4-4M4 19h16' },
  { action: 'pull', label: 'Pull', title: '원격 변경 반영 · fast-forward', path: 'M12 3v12m0 0-4-4m4 4 4-4M4 20h16M4 5v4M20 5v4' },
  { action: 'push', label: 'Push', title: '현재 커밋 게시', path: 'M12 20V9m0 0-4 4m4-4 4 4M4 4h16' },
  { action: 'branch', label: 'Branch', title: '브랜치 만들기', path: 'M6 3v18M18 3v5c0 5-12 3-12 9' },
  { action: 'stash-save', label: 'Stash', title: 'Stash 변경 보관', path: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { action: 'stash-pop', label: 'Pop', title: '최근 Stash 복원 후 제거', path: 'M12 13V3m0 0-3.5 3.5M12 3l3.5 3.5M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5' },
]
export function GitToolbar({ onAction, disabled = {}, reasons = {}, counts }: { counts?: { incoming: number | null; outgoing: number | null }; onAction: (action: GitTool) => void; disabled?: Partial<Record<GitTool, boolean>>; reasons?: Partial<Record<GitTool, string>> }) {
  return <div className="bl-git-toolbar" role="group" aria-label="Git 빠른 작업">{items.map(item => <ToolbarButton key={item.action} aria-label={item.title} title={reasons[item.action] || item.title} aria-description={reasons[item.action]} disabled={disabled[item.action]} onClick={() => onAction(item.action)} icon={<svg className="ico" viewBox="0 0 24 24"><path d={item.path} /></svg>}>{item.label}{counts && ['fetch', 'pull', 'push'].includes(item.action) && <SyncBadge icon={false} direction={item.action === 'push' ? 'outgoing' : 'incoming'} count={item.action === 'push' ? counts.outgoing : counts.incoming} />}</ToolbarButton>)}</div>
}
