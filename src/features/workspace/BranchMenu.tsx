import type { ReactElement } from 'react'
import { ContextMenu } from '../../design-system'
import type { Repository } from '../../app/types'

export type BranchAction = 'locate' | 'solo' | 'all' | 'switch' | 'branch' | 'worktree' | 'compare' | 'merge' | 'rebase' | 'rename' | 'delete' | 'copy-name' | 'copy-sha' | 'fetch' | 'pull'
export type Branch = Repository['refs'][number]
export function BranchMenu({ branch, repo, solo, disabled, onAction, children, showButton = false }: { branch: Branch; repo: Repository; solo: string; disabled: boolean; onAction: (action: BranchAction, branch: Branch) => void; children: ReactElement; showButton?: boolean }) {
  const local = branch.ref.startsWith('refs/heads/'), current = branch.ref === `refs/heads/${repo.branch}`
  const blocked = repo.operation ? `${repo.operation} 진행 중` : repo.files.length ? '변경을 커밋하거나 Stash에 보관하세요' : ''
  const remoteRef = local ? branch.tracking?.ref : branch.ref
  const remoteMissing = !remoteRef?.startsWith('refs/remotes/')
  const pullReason = remoteMissing ? '원격 추적 브랜치를 먼저 설정하세요' : local && !current ? '이 로컬 브랜치를 먼저 체크아웃하세요' : repo.operation ? `${repo.operation} 진행 중` : repo.files.some(file => file.conflict) ? '충돌을 먼저 해결하세요' : (!repo.branch || !repo.head ? '로컬 브랜치를 먼저 체크아웃하세요' : '')
  const action = (label: string, id: BranchAction, unavailable = false, hint?: string) => ({ label, onClick: () => onAction(id, branch), disabled: unavailable, hint })
  return <ContextMenu label={branch.name} description={`${local ? 'LOCAL' : 'REMOTE'} · ${branch.sha.slice(0, 8)}${current ? ' · 현재 브랜치' : ''}`} disabled={disabled} showButton={showButton} groups={[
    [action('그래프에서 위치 보기', 'locate'), action(solo === branch.ref ? 'Solo 해제 · 전체 브랜치' : 'Solo · 이 브랜치만 보기', solo === branch.ref ? 'all' : 'solo'), action('현재 브랜치와 비교', 'compare', !repo.head || branch.sha === repo.head, repo.branch ? `기준: ${repo.branch}` : '기준: detached HEAD')],
    [{ label: 'Fetch / Pull', items: [action('Fetch…', 'fetch', remoteMissing, remoteMissing ? '원격 추적 브랜치를 먼저 설정하세요' : `${remoteRef!.slice(13)}의 원격 이력 가져오기`), action(local ? 'Pull…' : '현재 브랜치로 Pull…', 'pull', !!pullReason, pullReason || `${remoteRef!.slice(13)} → ${repo.branch} · fast-forward${repo.files.length ? ' · 자동 Stash 후 복원' : ''}`)] }],
    [action(local ? '브랜치 체크아웃…' : '로컬 추적 브랜치로 체크아웃…', 'switch', current || !!repo.operation || repo.files.some(file => file.conflict), current ? '현재 체크아웃됨' : repo.operation ? blocked : repo.files.some(file => file.conflict) ? '충돌을 먼저 해결하세요' : repo.files.length ? '변경을 자동 Stash하고 전환 후 복원합니다' : undefined), action('여기서 브랜치 만들기…', 'branch'), action('여기서 Worktree 만들기…', 'worktree')],
    [action('현재 브랜치에 Merge…', 'merge', !!blocked || !repo.branch || branch.sha === repo.head, blocked || `대상: ${repo.branch || '브랜치 체크아웃 필요'}`), action('현재 브랜치를 여기로 Rebase…', 'rebase', !!blocked || !repo.branch || branch.sha === repo.head, blocked || '현재 브랜치의 커밋 SHA가 바뀝니다')],
    [action('브랜치 이름 복사', 'copy-name'), action('커밋 SHA 복사', 'copy-sha')],
    local ? [action('브랜치 이름 변경…', 'rename', !!repo.operation, repo.operation ? '진행 중 작업을 먼저 완료하세요' : undefined), action('로컬 브랜치 삭제…', 'delete', current || !!repo.operation, current ? '현재 브랜치는 삭제할 수 없습니다' : '현재 HEAD에 병합된 브랜치만 삭제')] : [],
  ]}>{children}</ContextMenu>
}
