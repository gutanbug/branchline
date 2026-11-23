import { useImperativeHandle, useRef, useState, type Ref, type ComponentProps } from 'react'
import { Button, FileChangeRow, CodeDiff, Dialog, Notice } from '../../design-system'
import type { DesktopAPI, FileAction, GitFile, Repository } from '../../app/types'
import { fileMenuGroups, type FileMenuAction } from './fileMenuGroups'

type HandledAction = Exclude<FileMenuAction, 'stage' | 'unstage'>
type Request = { action: HandledAction; file: GitFile; staged: boolean; expected: string }
export type FileActionsHandle = { open: (action: HandledAction, file: GitFile, staged: boolean) => void }
const labels: Partial<Record<FileMenuAction, string>> = { discard: '작업 파일 변경 취소', 'stash-file': '이 파일 Stash', trash: '파일을 휴지통으로 이동', 'ignore-file': '이 파일 무시', 'ignore-extension': '같은 확장자 무시', 'ignore-folder': '이 폴더 무시', blame: '행별 작성자 · Blame' }
export function FileActions({ ref, api, repo, onRepo, onBusy, onNavigate, onFeedback }: { ref: Ref<FileActionsHandle>; api: DesktopAPI; repo: Repository; onRepo: (repo: Repository) => void; onBusy: (busy: boolean) => void; onNavigate: (action: FileMenuAction, file: GitFile, staged: boolean) => Promise<void>; onFeedback: (message: string, error?: boolean) => void }) {
  const cancel = useRef<HTMLButtonElement>(null)
  const modal = useRef<HTMLDialogElement>(null), inFlight = useRef(false)
  const [request, setRequest] = useState<Request | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [value, setValue] = useState<string | null>(null)
  async function execute(input: Request) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); onBusy(true); setError('')
    try {
      if (['history', 'edit', 'diff', 'conflicts'].includes(input.action)) { await onNavigate(input.action, input.file, input.staged); return }
      const result = await api.fileAction(repo.path, { action: input.action as FileAction, file: input.file.path, staged: input.staged, expected: input.expected })
      if (result.cancelled) { onFeedback('패치 저장을 취소했습니다.'); return }
      if (result.repository) onRepo(result.repository)
      if (input.action === 'blame') { setValue(result.text || ''); return }
      modal.current?.close()
      const message = input.action.startsWith('copy-') ? '파일 경로를 복사했습니다.' : input.action === 'patch' ? '변경 패치를 저장했습니다.' : input.action === 'stash-file' ? '이 파일을 Stash에 보관했습니다. 왼쪽 Stash에서 확인하세요.' : input.action === 'trash' ? '파일을 휴지통으로 이동했습니다. 복원은 운영체제 휴지통에서 진행하세요.' : input.action.startsWith('ignore-') ? `.gitignore에 ${result.pattern} 규칙을 추가했습니다. 파일은 삭제하지 않았습니다.` : input.action === 'discard' ? '작업 파일의 변경을 취소했습니다. 스테이징 내용은 유지했습니다.' : '파일을 열었습니다.'
      onFeedback(message)
    } catch (e) {
      const message = (e as Error).message; setError(message); if (!modal.current?.open) onFeedback(message, true)
      try { onRepo(await api.state(repo.path)) } catch { /* Keep the original error; repository refresh is available. */ }
    } finally { inFlight.current = false; setBusy(false); onBusy(false) }
  }
  useImperativeHandle(ref, () => ({ open(action, file, staged) {
    if (inFlight.current) return
    const next = { action, file, staged, expected: repo.token }; setRequest(next); setError(''); setValue(null)
    if (['discard', 'trash', 'blame'].includes(action)) { modal.current?.showModal(); cancel.current?.focus(); if (action === 'blame') void execute(next) } else void execute(next)
  } }))
  const action = request?.action
  const description = action === 'discard' ? '스테이징되지 않은 변경을 버립니다. 되돌릴 수 없습니다.' : '이 파일을 휴지통으로 이동합니다.'

  return <Dialog dialogRef={modal} title={labels[action!] || '파일 작업'} busy={busy} size={action === 'blame' ? 'wide' : undefined}>
    <p className="bl-path">{request?.file.path}</p>{action !== 'blame' && <p>{description}</p>}
    {action === 'blame' && (busy ? <Notice>행별 작성자를 읽고 있습니다…</Notice> : value !== null ? <CodeDiff value={value} filename={request?.file.path} format="code" /> : null)}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="bl-actions bl-dialog-actions"><Button ref={cancel} disabled={busy} onClick={() => modal.current?.close()}>{action === 'blame' ? '닫기' : '취소'}</Button>{action === 'blame' ? error && <Button disabled={busy} onClick={() => request && void execute({ ...request, expected: repo.token })}>다시 조회</Button> : <Button variant="primary" loading={busy} disabled={busy || request?.expected !== repo.token} onClick={() => request && void execute(request)}>{labels[action!] || '실행'}</Button>}</div>
    {action !== 'blame' && request && request.expected !== repo.token && <Notice>저장소가 변경되었습니다. 취소한 뒤 파일 메뉴를 다시 열어 검토하세요.</Notice>}
  </Dialog>
}

export function FileMenuRow({ repo, file, onAction, ...props }: ComponentProps<typeof FileChangeRow> & { repo: Repository; file: GitFile; onAction: (action: FileMenuAction) => void }) {
  return <FileChangeRow {...props} menuGroups={fileMenuGroups(file, props.staged, repo, onAction)} />
}
