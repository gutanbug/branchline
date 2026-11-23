import type { ReactElement } from 'react'
import { ContextMenu } from '../../design-system'
import type { Repository, SyncSnapshot } from '../../app/types'
import { operationLabel } from './operation'

export type Stash = SyncSnapshot['stashes'][number]
export type StashAction = 'stash-apply' | 'stash-pop' | 'stash-drop'
export function StashMenu({ stash, repo, disabled, onAction, children, showButton = false }: { stash: Stash; repo: Repository; disabled: boolean; onAction: (action: StashAction, stash: Stash) => void; children: ReactElement; showButton?: boolean }) {
  const reason = repo.operation ? `${operationLabel(repo.operation)} 작업을 먼저 완료하세요.` : repo.files.some(file => file.conflict) ? '충돌을 먼저 해결하세요.' : ''
  return <ContextMenu label={`${stash.ref} · ${stash.message}`} description={stash.sha} disabled={disabled} showButton={showButton} groups={[
    [{ label: 'Apply · 복원하고 Stash 유지', disabled: !!reason, hint: reason || '변경을 복원하고 Stash는 유지합니다.', onClick: () => onAction('stash-apply', stash) },
      { label: 'Pop · 복원 성공 시 Stash 삭제', disabled: !!reason, hint: reason || '변경을 복원하고 성공한 경우에만 Stash를 삭제합니다.', onClick: () => onAction('stash-pop', stash) }],
    [{ label: 'Stash 삭제…', hint: '선택한 Stash를 삭제합니다.', onClick: () => onAction('stash-drop', stash) }],
  ]}>{children}</ContextMenu>
}
