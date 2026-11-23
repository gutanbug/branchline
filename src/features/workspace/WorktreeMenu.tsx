import type { ReactElement } from 'react'
import { ContextMenu } from '../../design-system'
import type { Worktree } from '../../app/types'

export type WorktreeAction = 'open' | 'open-new' | 'worktree-remove' | 'worktree-remove-branch' | 'worktree-lock' | 'worktree-unlock'
export function WorktreeMenu({ worktree, primary, openPaths, disabled, onAction, children, showButton = false }: { worktree: Worktree; primary: boolean; openPaths: string[]; disabled: boolean; onAction: (action: WorktreeAction, worktree: Worktree) => void; children: ReactElement; showButton?: boolean }) {
  const reason = primary ? '기본 Worktree는 제거할 수 없습니다.' : openPaths.includes(worktree.path) ? '열려 있는 Worktree 탭을 먼저 닫으세요.' : worktree.locked ? '잠금을 먼저 해제하세요.' : worktree.prunable ? 'Worktree 경로를 확인하세요.' : ''
  return <ContextMenu label={`Worktree · ${worktree.branch || 'detached HEAD'}`} description={worktree.path} disabled={disabled} showButton={showButton} groups={[
    [{ label: '현재 탭에서 열기', disabled: worktree.prunable, hint: worktree.prunable ? 'Worktree 경로를 확인하세요.' : undefined, onClick: () => onAction('open', worktree) }, { label: '새 탭에서 열기', disabled: worktree.prunable, hint: worktree.prunable ? 'Worktree 경로를 확인하세요.' : '이미 열려 있으면 해당 탭으로 이동합니다.', onClick: () => onAction('open-new', worktree) }],
    [{ label: 'Worktree 제거…', disabled: !!reason, hint: reason || '폴더를 제거하고 브랜치는 유지합니다.', onClick: () => onAction('worktree-remove', worktree) }, { label: 'Worktree와 브랜치 제거…', disabled: !!reason || !worktree.branch, hint: reason || (!worktree.branch ? '연결된 로컬 브랜치가 없습니다.' : '현재 HEAD에 병합된 로컬 브랜치만 함께 제거합니다.'), onClick: () => onAction('worktree-remove-branch', worktree) }],
    [{ label: worktree.locked ? 'Worktree 잠금 해제' : 'Worktree 잠금', disabled: primary, hint: primary ? '기본 Worktree는 잠글 수 없습니다.' : 'Worktree의 제거·이동·정리를 보호하는 Git 잠금입니다.', onClick: () => onAction(worktree.locked ? 'worktree-unlock' : 'worktree-lock', worktree) }],
  ]}>{children}</ContextMenu>
}
