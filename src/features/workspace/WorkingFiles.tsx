import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { Button, Dialog, FileEditor, Notice } from '../../design-system'
import type { DirectoryState } from '../../design-system/FileEditor'
import type { DesktopAPI, WorkingEditor } from '../../app/types'

export type WorkingFilesActions = { close: () => void }
export function WorkingFiles({ ref, api, path, editor, onEditor, onBusy, onSaved }: { ref?: Ref<WorkingFilesActions>; api: DesktopAPI; path: string; editor: WorkingEditor; onEditor: (editor: WorkingEditor) => void; onBusy: (busy: boolean) => void; onSaved: () => void }) {
  const [directories, setDirectories] = useState<Record<string, DirectoryState>>({}), [expanded, setExpanded] = useState<string[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const pending = useRef<(() => void) | null>(null), dialog = useRef<HTMLDialogElement>(null), inFlight = useRef(false)
  const dirty = !!editor.snapshot && editor.draft !== editor.snapshot.current.replaceAll('\r\n', '\n')
  useEffect(() => {
    let live = true
    api.workingList(path, '').then(entries => { if (live) setDirectories({ '': { entries } }) }).catch(e => { if (live) setDirectories({ '': { error: e.message } }) })
    return () => { live = false }
  }, [api, path])
  async function folder(folder: string, open: boolean) {
    setExpanded(previous => open ? [...new Set([...previous, folder])] : previous.filter(item => item !== folder))
    if (!open) return
    await Promise.all((folder ? [folder] : ['', ...expanded.filter(Boolean)]).map(async directory => {
      try { const entries = await api.workingList(path, directory); setDirectories(previous => ({ ...previous, [directory]: { entries } })) }
      catch (e) { setDirectories(previous => ({ ...previous, [directory]: { error: (e as Error).message } })) }
    }))
  }
  function guard(action: () => void) { if (inFlight.current) return; if (dirty) { pending.current = action; dialog.current?.showModal() } else action() }
  useImperativeHandle(ref, () => ({ close: () => guard(() => onEditor({ ...editor, open: false, snapshot: null, draft: '' })) }))
  async function read(file: string) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); onBusy(true); setError(''); setNotice('')
    try { const snapshot = await api.workingRead(path, file); onEditor({ ...editor, snapshot, draft: snapshot.current.replaceAll('\r\n', '\n') }) }
    catch (e) { setError(`${file} 열기 실패: ${(e as Error).message}`) }
    finally { inFlight.current = false; setBusy(false); onBusy(false) }
  }
  async function save() {
    if (inFlight.current || !editor.snapshot || !dirty) return false
    inFlight.current = true; setBusy(true); onBusy(true); setError(''); setNotice('')
    try {
      const snapshot = await api.workingSave(path, { file: editor.snapshot.file, expected: editor.snapshot.token, result: editor.draft })
      onEditor({ ...editor, snapshot, draft: snapshot.current.replaceAll('\r\n', '\n') }); setNotice('파일을 저장했습니다.'); onSaved(); return true
    } catch (e) { setError((e as Error).message); return false }
    finally { inFlight.current = false; setBusy(false); onBusy(false) }
  }
  return <div className="bl-working-files" onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && !event.nativeEvent.isComposing) { event.preventDefault(); void save() } }}>
    <FileEditor filename={editor.snapshot?.file} value={editor.draft} onChange={draft => onEditor({ ...editor, draft })} busy={busy} dirty={dirty} readOnly={editor.snapshot?.eol === 'mixed'} directories={directories} expanded={expanded} onFolder={(path, open) => void folder(path, open)} onFile={file => { if (file !== editor.snapshot?.file) guard(() => void read(file)) }} actions={<><Button disabled={busy || !editor.snapshot} onClick={() => guard(() => void read(editor.snapshot!.file))}>다시 불러오기</Button><Button variant="primary" title="저장 · ⌘S / Ctrl+S" disabled={busy || !dirty || editor.snapshot?.eol === 'mixed'} onClick={() => void save()}>파일 저장</Button></>} feedback={<>{error && <Notice tone="error">{error}</Notice>}{notice && <Notice compact>{notice}</Notice>}{editor.snapshot?.eol === 'mixed' && <Notice compact>줄바꿈이 혼합되어 읽기 전용으로 열었습니다.</Notice>}</>} />
    <Dialog dialogRef={dialog} title="저장하지 않은 파일 편집" busy={busy} onClose={() => { pending.current = null }}><p><code>{editor.snapshot?.file}</code>의 편집을 버리고 이동할까요? 저장하려면 계속 편집을 선택하세요.</p><div className="bl-actions bl-dialog-actions"><Button onClick={() => dialog.current?.close()}>계속 편집</Button><Button variant="primary" onClick={() => { const action = pending.current; dialog.current?.close(); pending.current = null; action?.() }}>편집 버리고 이동</Button></div></Dialog>
  </div>
}
