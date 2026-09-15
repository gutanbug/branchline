import { useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Button, Dialog, Notice, TextField } from '../../design-system'
import type { DesktopAPI, Repository } from '../../app/types'

export function CloneDialog({ api, dialogRef, onOpen, onBusy }: { api: DesktopAPI; dialogRef: RefObject<HTMLDialogElement | null>; onOpen: (repo: Repository) => void; onBusy: (value: boolean) => void }) {
  const [url, setUrl] = useState('')
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')
  const [id, setId] = useState<string | null>(null)
  const [canceling, setCanceling] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  async function clone() {
    if (id) return
    if (!url.trim()) { setError('복제할 주소를 입력하세요.'); field.current?.focus(); return }
    if (!target) { setError('복제할 새 폴더 위치를 선택하세요.'); return }
    const operationId = crypto.randomUUID(); setId(operationId); onBusy(true); setCanceling(false); setError('')
    try { const repo = await api.clone({ id: operationId, url: url.trim(), target }); onOpen(repo); dialogRef.current?.close(); setUrl(''); setTarget('') }
    catch (e) { setError((e as Error).message) }
    finally { setId(null); onBusy(false) }
  }
  return <Dialog dialogRef={dialogRef} title="저장소 복제" busy={!!id}><form noValidate onSubmit={e => { e.preventDefault(); void clone() }} onKeyDown={e => { if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault() }}>
    <TextField ref={field} label="복제할 저장소 주소" value={url} disabled={!!id} onChange={e => { setUrl(e.target.value); setError('') }} placeholder="https://github.com/team/repository.git" hint="HTTPS·SSH·로컬 절대 경로를 사용하세요. 토큰·비밀번호는 입력하지 마세요." error={error && !url.trim() ? error : undefined} />
    <div className="bl-commit-form"><Button disabled={!!id} onClick={() => { api.cloneDestination().then(value => { if (value) { setTarget(value); setError('') } }).catch(e => setError(e.message)) }}>복제 위치 선택</Button><p className="bl-path">{target || '새 폴더가 생성될 위치를 선택하세요.'}</p></div>
    <Notice>기존 Git 인증을 사용합니다. 완료하면 새 프로젝트 탭으로 열립니다. submodule은 자동 복제하지 않습니다.</Notice>
    {id && <Notice>저장소를 복제하고 있습니다… 최대 2분까지 기다립니다.</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="bl-actions bl-dialog-actions">{id ? <Button disabled={canceling} onClick={() => { setCanceling(true); api.cancel(id).catch(e => setError(e.message)) }}>{canceling ? '취소 요청됨' : '복제 취소'}</Button> : <Button onClick={() => dialogRef.current?.close()}>닫기</Button>}<Button type="submit" variant="primary" loading={!!id}>복제</Button></div>
  </form></Dialog>
}
