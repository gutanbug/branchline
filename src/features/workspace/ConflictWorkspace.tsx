import { ConflictChat } from '../agents/ConflictChat'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Badge, Button, ChangeFileList, CodeDiff, Dialog, Disclosure, EmptyState, Notice, TextArea, ToastMessage } from '../../design-system'
import { edited, keepFile, selectConflictFile } from '../../app/conflictEditor'
import type { ConflictEditor, ConflictInput, DesktopAPI, Repository } from '../../app/types'

export function ConflictWorkspace({ active, api, repo, onRepo, onBusy, editor, onEditor }: { active: boolean; editor: ConflictEditor; onEditor: (editor: ConflictEditor) => void; api: DesktopAPI; repo: Repository; onRepo: (repo: Repository) => void; onBusy: (busy: boolean) => void }) {
  const conflicts = repo.files.filter(item => item.conflict)
  const file = editor.file || conflicts[0]?.path || ''
  const snapshot = editor.snapshot?.file === file ? editor.snapshot : null
  const available = conflicts.some(item => item.path === file)
  const paths = new Set([...conflicts.map(item => item.path), ...(editor.parked?.keys() || [])])
  if (file) paths.add(file)
  const filePaths = [...paths]
  const { draft } = editor
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<ConflictInput['action'] | 'reload'>('apply')
  const dialog = useRef<HTMLDialogElement>(null), inFlight = useRef(false)
  const latest = useRef({ editor, onEditor, file })
  useLayoutEffect(() => { latest.current = { editor, onEditor, file } }, [editor, onEditor, file])
  useEffect(() => {
    if (!active || snapshot || !available) return
    let live = true
    api.conflictRead(repo.path, file).then(next => {
      const { editor, onEditor } = latest.current
      if (live && latest.current.file === file && !editor.snapshot) { setError(''); onEditor({ ...editor, file, snapshot: next, draft: next.current.replaceAll('\r\n', '\n') }) }
    }).catch(e => { if (live && latest.current.file === file) setError(e.message) })
    return () => { live = false }
  }, [api, active, repo.path, file, available, snapshot])
  const dirty = edited(editor)
  function confirm(action: typeof pending) { setPending(action); setError(''); dialog.current?.showModal() }
  async function run(action: typeof pending) {
    if (inFlight.current || !available || (!snapshot && action !== 'reload')) return
    inFlight.current = true
    setPending(action)
    setBusy(true); onBusy(true); setError(''); setNotice('')
    try {
      if (action === 'reload') {
        const next = await api.conflictRead(repo.path, file)
        onEditor({ ...editor, file, snapshot: next, draft: next.current.replaceAll('\r\n', '\n'), conversations: snapshot?.token === next.token ? editor.conversations : undefined })
      } else if (snapshot) {
        const next = await api.conflictChange(repo.path, { action, file, expected: snapshot.token, result: draft })
        onRepo(next.repository)
        onEditor(next.snapshot ? { ...editor, snapshot: next.snapshot, draft: next.snapshot.current.replaceAll('\r\n', '\n') } : selectConflictFile(editor, next.repository.files.find(item => item.conflict)?.path || '', true))
        setNotice(action === 'resolve' ? next.repository.operation ? '해결 표시했습니다. 모든 파일을 검토한 뒤 상단에서 Git 작업을 계속하세요.' : '해결 표시했습니다. 내 변경 사항에서 결과를 검토하세요. 보존된 Stash는 내용을 확인한 뒤 삭제할 수 있습니다.' : action === 'restore' ? '저장 직전 파일로 복원했습니다.' : '작업 파일에 저장했습니다.')
      }
      dialog.current?.close()
    } catch (e) { setError((e as Error).message) }
    finally { inFlight.current = false; setBusy(false); onBusy(false) }
  }
  return <div className="bl-conflicts">

    {filePaths.length > 0 && <ChangeFileList label="충돌 파일" paths={filePaths} empty="충돌 파일이 없습니다." actions={() =>
      <Button disabled={busy || !available || (!snapshot && !error)} loading={busy && pending === 'reload'} onClick={() => keepFile(editor) ? confirm('reload') : void run('reload')}>원본 불러오기</Button>
    } renderFile={(index, view) => {
      const path = filePaths[index], entry = path === file ? editor : editor.parked?.get(path)
      const unsaved = entry && edited(entry)
      return <Button variant="ghost" className="bl-host-list-item" aria-label={path} aria-description={unsaved ? '미저장 초안' : undefined} title={path} aria-pressed={path === file} disabled={busy}
        onClick={() => { if (path !== file) { setError(''); setNotice(''); onEditor(selectConflictFile(editor, path)) } }}>
        <strong>{view === 'tree' ? path.split('/').at(-1) : path}</strong>{unsaved && <Badge>미저장 초안</Badge>}
      </Button>
    }} />}
    {error && <Notice tone="error">{error}</Notice>}
    {!snapshot && available && !error && <Notice>충돌 파일의 원본을 불러오고 있습니다…</Notice>}
    {snapshot && !available && <Notice>이 파일은 더 이상 충돌 상태가 아닙니다. 작성한 편집은 보존했습니다.</Notice>}
    <ToastMessage scope="충돌 해결" tone="success" message={notice} />
    {!conflicts.length && <EmptyState decorated title="미해결 충돌이 없습니다">진행 중인 Git 작업이 있다면 스테이징 변경을 검토하고 상단의 계속 버튼을 선택하세요.</EmptyState>}
    {snapshot && <>
      <div className="bl-row-between"><h2 className="bl-path">{snapshot.file}</h2><span>{snapshot.eol} · UTF-8 · {dirty ? '저장하지 않은 편집' : '불러온 파일'}</span></div>
      <div className="bl-conflict-layout"><div>

      <Disclosure title="공통 기준 · Stage 1"><CodeDiff format="code" value={snapshot.base ?? '기준 파일 없음 · 추가/추가 등의 충돌'} /></Disclosure>
      <div className="bl-conflict-sides">
        <section><h3>{repo.operation === 'rebase' ? '재배치 대상' : '현재 Git 작업 쪽'} · Stage 2</h3><CodeDiff format="code" value={snapshot.ours ?? '이 쪽에는 파일이 없습니다.'} /></section>
        <section><h3>{repo.operation === 'rebase' ? '다시 적용할 커밋' : '적용 중인 변경'} · Stage 3</h3><CodeDiff format="code" value={snapshot.theirs ?? '이 쪽에는 파일이 없습니다.'} /></section>
      </div>
      <Disclosure title="불러온 작업 파일"><CodeDiff format="code" value={snapshot.current} /></Disclosure>
      <TextArea className="resize-none bl-conflict-editor" label="해결 결과 편집" value={draft} rows={14} spellCheck={false} disabled={busy} onChange={event => onEditor({ ...editor, draft: event.target.value })} />

      <div className="bl-actions">
        <Button disabled={busy || !available || !snapshot.canRestore || dirty} onClick={() => confirm('restore')}>직전 저장 복원</Button>
        <Button disabled={busy || !available || dirty} onClick={() => void run('resolve')}>스테이징하고 해결 표시</Button>
        <Button variant="primary" disabled={busy || !available || !dirty || snapshot.eol === 'mixed'} onClick={() => void run('apply')}>작업 파일에 저장</Button>
      </div>
      {snapshot.eol === 'mixed' && <Notice>줄바꿈이 혼합되어 있습니다. 외부 편집기로 저장한 뒤 원본을 다시 불러오세요.</Notice>}</div><div><ConflictChat key={file} active={active} api={api} path={repo.path} editor={editor} onEditor={onEditor} disabled={busy} /></div></div>
    </>}
    <Dialog dialogRef={dialog} busy={busy} title={pending === 'reload' ? '편집을 버리고 다시 불러오기' : '직전 저장 복원 확인'}>
      <p>{pending === 'reload' ? '저장하지 않은 편집을 버립니다. 원본이 달라지면 AI 대화도 초기화합니다.' : '작업 파일을 직전 저장 이전 내용으로 되돌립니다.'}</p>
      <p className="bl-path">{pending === 'reload' ? file : snapshot?.file}</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="bl-actions bl-dialog-actions"><Button disabled={busy} onClick={() => dialog.current?.close()}>취소</Button><Button variant="primary" loading={busy} onClick={() => void run(pending)}>{pending === 'reload' ? '편집 버리고 불러오기' : '원본 복원'}</Button></div>
    </Dialog>
  </div>
}
