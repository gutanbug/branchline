import type { ContextAction } from '../../design-system/ContextMenu'
import type { FileAction, GitFile, Repository } from '../../app/types'
export type FileMenuAction = FileAction | 'stage' | 'unstage' | 'history' | 'edit' | 'diff' | 'conflicts'
export function fileMenuGroups(file: GitFile, staged: boolean, repo: Repository, onAction: (action: FileMenuAction) => void): ContextAction[][] {
  const locked = !!repo.operation || repo.files.some(item => item.conflict), missing = file.working === 'D' || file.index === 'D' && file.working === ' '
  const hasHistory = !!repo.head && !file.untracked && file.index !== 'A', name = file.path.split('/').at(-1)!, extension = name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')) : '', folder = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : ''
  const item = (label: string, action: FileMenuAction, disabled = false, hint?: string): ContextAction => ({ label, onClick: () => onAction(action), disabled, hint })
  return [
    [item(staged ? '스테이징 해제' : '스테이징', staged ? 'unstage' : 'stage', file.conflict), item('변경 내용 보기', 'diff'), ...(file.conflict ? [item('충돌 해결하기', 'conflicts')] : []), item('이 파일 Stash', 'stash-file', locked || !repo.head || !!file.originalPath || repo.files.some(other => other.path !== file.path && !other.untracked && other.index !== ' '), !repo.head ? '첫 커밋 이후 사용' : file.originalPath ? '이름 변경은 전체 Stash 사용' : repo.files.some(other => other.path !== file.path && !other.untracked && other.index !== ' ') ? '다른 파일 스테이징 해제 필요' : undefined)],
    [{ label: '무시 규칙 추가', disabled: locked || !file.untracked, hint: file.untracked ? '.gitignore에 추가' : '미추적 파일만 가능', items: [item('이 파일 무시', 'ignore-file', false, file.path), item('같은 확장자 무시', 'ignore-extension', !extension, extension || '확장자 없음'), item('이 폴더 무시', 'ignore-folder', !folder, folder || '저장소 루트 전체는 제외할 수 없음')] }],
    [item('파일 이력 보기', 'history', !hasHistory), item('행별 작성자 · Blame', 'blame', !hasHistory)],
    [item('앱에서 파일 편집', 'edit', missing || file.conflict), item('기본 프로그램으로 열기', 'open', missing), item('파일 위치 보기', 'reveal', missing)],
    [{ label: '파일 경로 복사', items: [item('상대 경로 복사', 'copy-relative'), item('전체 경로 복사', 'copy-absolute')] }, item('변경 패치 저장', 'patch', file.conflict)],
    [item('작업 파일 변경 취소…', 'discard', locked || staged || file.untracked || !!file.originalPath || file.working === ' '), item('파일을 휴지통으로 이동…', 'trash', locked || missing)],
  ]
}
