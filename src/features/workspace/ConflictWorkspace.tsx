import { ConflictChat } from '../agents/ConflictChat'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button, CodeDiff, Dialog, Disclosure, EmptyState, Notice, SelectField, TextArea } from '../../design-system'
import type { ConflictEditor, ConflictInput, DesktopAPI, Repository } from '../../app/types'

export function ConflictWorkspace({ active, api, repo, onRepo, onBusy, editor, onEditor }: { active: boolean; editor: ConflictEditor; onEditor: (editor: ConflictEditor) => void; api: DesktopAPI; repo: Repository; onRepo: (repo: Repository) => void; onBusy: (busy: boolean) => void }) {
  const { snapshot, draft, file } = editor
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<ConflictInput['action'] | 'reload'>('apply')
  const dialog = useRef<HTMLDialogElement>(null)
  const conflicts = repo.files.filter(item => item.conflict)
  const latest = useRef({ editor, onEditor })
  useLayoutEffect(() => { latest.current = { editor, onEditor } }, [editor, onEditor])
  const firstFile = conflicts.find(item => item.path === file)?.path || conflicts[0]?.path
  const hasSnapshot = !!snapshot
  useEffect(() => {
    if (!active || hasSnapshot || !firstFile) return
    let live = true
    api.conflictRead(repo.path, firstFile).then(next => {
      const { editor, onEditor } = latest.current
      if (live && !editor.snapshot) { setError(''); onEditor({ file: firstFile, snapshot: next, draft: next.current.replaceAll('\r\n', '\n') }) }
    }).catch(e => { if (live) { setError(e.message); const { editor, onEditor } = latest.current; if (!editor.snapshot) onEditor({ ...editor, file: firstFile }) } })
    return () => { live = false }
  }, [api, active, repo.path, firstFile, hasSnapshot])
  const dirty = !!snapshot && draft !== snapshot.current.replaceAll('\r\n', '\n')
  function confirm(action: typeof pending) { setPending(action); setError(''); dialog.current?.showModal() }
  async function run(action: typeof pending) {
    if (busy) return
    setBusy(true); onBusy(true); setError(''); setNotice('')
    try {
      if (action === 'reload') {
        const next = await api.conflictRead(repo.path, file)
        onEditor({ file, snapshot: next, draft: next.current.replaceAll('\r\n', '\n'), conversations: snapshot?.token === next.token ? editor.conversations : undefined })
      } else if (snapshot) {
        const next = await api.conflictChange(repo.path, { action, file: snapshot.file, expected: snapshot.token, result: draft })
        onRepo(next.repository); onEditor({ file, snapshot: next.snapshot, draft: next.snapshot?.current.replaceAll('\r\n', '\n') || '', conversations: action === 'resolve' ? undefined : editor.conversations })
        setNotice(action === 'resolve' ? next.repository.operation ? '해결 표시했습니다. 모든 파일을 검토한 뒤 상단에서 Git 작업을 계속하세요.' : '해결 표시했습니다. 내 변경 사항에서 결과를 검토하세요. 보존된 Stash는 내용을 확인한 뒤 삭제할 수 있습니다.' : action === 'restore' ? '저장 직전 파일로 복원했습니다.' : '작업 파일에 저장했습니다. 내용을 확인한 뒤 해결 표시하세요. 테스트는 실행하지 않았습니다.')
      }
      dialog.current?.close()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false); onBusy(false) }
  }
  return <div className="bl-conflicts">
    <Notice>{conflicts.length ? `${repo.branch || 'detached HEAD'} · ${repo.operation ? `${repo.operation} 진행 중` : '작업 파일 충돌'} · 충돌 ${conflicts.length}개를 감지했습니다. ` : ''}AI에 해결 방향을 입력하거나 직접 편집하세요. {repo.operation ? '수정안을 검토·저장하고 해결 표시한 뒤 Git 작업을 계속합니다.' : '해결 표시 후 내 변경 사항에서 결과를 검토하세요. 보존된 Stash는 확인 후 삭제할 수 있습니다.'}</Notice>
    <div className="bl-filter-grid">
      <SelectField label="충돌 파일" value={file} disabled={busy} onChange={file => onEditor({ ...editor, file })} options={[{ value: '', label: '파일 선택' }, ...conflicts.map(item => ({ value: item.path, label: item.path }))]} />
      <Button disabled={busy || !file || !conflicts.some(item => item.path === file)} loading={busy && pending === 'reload'} onClick={() => dirty || Object.values(editor.conversations || {}).some(chat => chat?.prompt || chat?.messages.length) ? confirm('reload') : void run('reload')}>원본 불러오기</Button>
    </div>
    {error && <Notice tone="error">{error}</Notice>}
    {!snapshot && conflicts.length > 0 && !error && <Notice>충돌 파일의 원본을 불러오고 있습니다…</Notice>}
    {snapshot && !conflicts.some(item => item.path === snapshot.file) && <Notice>이전에 불러온 편집을 유지하고 있습니다. 현재 충돌 파일을 선택하고 원본을 다시 불러오세요.</Notice>}
    {notice && <Notice>{notice}</Notice>}
    {!conflicts.length && <EmptyState title="미해결 충돌이 없습니다">진행 중인 Git 작업이 있다면 스테이징 변경을 검토하고 상단의 계속 버튼을 선택하세요.</EmptyState>}
    {snapshot && <>
      <div className="bl-row-between"><h2 className="bl-path">{snapshot.file}</h2><span>{snapshot.eol} · UTF-8 · {dirty ? '저장하지 않은 편집' : '불러온 파일'}</span></div>
      <div className="bl-conflict-layout"><div>
      <p>Stage 2는 현재 Git 작업 쪽, Stage 3은 적용 중인 변경입니다. Rebase에서는 Stage 2가 재배치 대상, Stage 3이 다시 적용하는 커밋이므로 ‘내 변경’으로 구분하지 않습니다.</p>
      <Disclosure title="공통 기준 · Stage 1"><CodeDiff format="code" value={snapshot.base ?? '기준 파일 없음 · 추가/추가 등의 충돌'} /></Disclosure>
      <div className="bl-conflict-sides">
        <section><h3>현재 Git 작업 쪽 · Stage 2</h3><CodeDiff format="code" value={snapshot.ours ?? '이 쪽에는 파일이 없습니다.'} /></section>
        <section><h3>적용 중인 변경 · Stage 3</h3><CodeDiff format="code" value={snapshot.theirs ?? '이 쪽에는 파일이 없습니다.'} /></section>
      </div>
      <Disclosure title="불러온 작업 파일"><CodeDiff format="code" value={snapshot.current} /></Disclosure>
      <TextArea className="resize-none bl-conflict-editor" label="해결 결과 편집" value={draft} rows={14} spellCheck={false} disabled={busy} onChange={event => onEditor({ ...editor, draft: event.target.value })} />
      <p className="bl-muted">저장 시 현재 파일의 줄바꿈을 유지합니다. 직전 저장 1회를 복원할 수 있으며, 외부 수정·해결 표시 이후에는 앱 내 복원을 사용할 수 없습니다. 화면과 탭을 이동해도 편집을 유지합니다. 탭 닫기·앱 종료 시 저장하지 않은 편집을 확인합니다.</p>
      <div className="bl-actions">
        <Button disabled={busy || !snapshot.canRestore || dirty} onClick={() => confirm('restore')}>직전 저장 복원</Button>
        <Button disabled={busy || dirty} onClick={() => confirm('resolve')}>해결 표시</Button>
        <Button variant="primary" disabled={busy || !dirty || snapshot.eol === 'mixed'} onClick={() => confirm('apply')}>결과 검토 후 저장</Button>
      </div>
      {snapshot.eol === 'mixed' && <Notice>줄바꿈이 혼합되어 있습니다. 외부 편집기로 저장한 뒤 원본을 다시 불러오세요.</Notice>}</div><div><ConflictChat api={api} path={repo.path} editor={editor} onEditor={onEditor} disabled={busy} /></div></div>
    </>}
    <Dialog dialogRef={dialog} busy={busy} title={pending === 'reload' ? '편집을 버리고 다시 불러오기' : pending === 'resolve' ? '해결 표시 확인' : pending === 'restore' ? '직전 저장 복원 확인' : '해결 결과 검토'}>
      <p>{pending === 'reload' ? '저장하지 않은 편집을 버리고 선택한 충돌 파일을 불러옵니다. 원본이 달라지면 기존 AI 대화도 초기화합니다.' : pending === 'resolve' ? '이 파일 전체를 스테이징해 충돌 해결로 표시합니다. 직전 저장 복원은 이후 사용할 수 없습니다. 이 파일의 AI 대화·입력·제안도 정리합니다. Merge·rebase 계속이나 커밋은 실행하지 않습니다.' : pending === 'restore' ? '작업 파일을 직전 저장 이전 내용으로 되돌립니다.' : '아래 전체 내용을 작업 파일에 저장합니다. 저장 직전 원본을 앱 데이터에 보관합니다. 해결 표시와 커밋은 실행하지 않습니다.'}</p>
      <p className="bl-path">{pending === 'reload' ? file : snapshot?.file}</p>
      {pending === 'apply' && <CodeDiff format="code" value={draft || '(빈 파일로 저장)'} />}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="bl-actions bl-dialog-actions"><Button disabled={busy} onClick={() => dialog.current?.close()}>취소</Button><Button variant="primary" loading={busy} onClick={() => void run(pending)}>{pending === 'reload' ? '편집 버리고 불러오기' : pending === 'resolve' ? '스테이징하고 해결 표시' : pending === 'restore' ? '원본 복원' : '작업 파일에 저장'}</Button></div>
    </Dialog>
  </div>
}
