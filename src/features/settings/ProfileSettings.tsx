import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, EmptyState, Notice, SelectField, TextField } from '../../design-system'
import type { AuthorProfile, DesktopAPI, Repository } from '../../app/types'

export function ProfileSettings({ api, repos, activePath, onRepo, onBusy }: { api: DesktopAPI; repos: Repository[]; activePath: string | null; onRepo: (repo: Repository) => void; onBusy: (path: string, busy: boolean) => void }) {
  const [profiles, setProfiles] = useState<AuthorProfile[]>([])
  const [ready, setReady] = useState(false), [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState(''), [label, setLabel] = useState(''), [name, setName] = useState(''), [email, setEmail] = useState('')
  const [path, setPath] = useState(''), [applying, setApplying] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const confirmation = useRef<HTMLDialogElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const [intent, setIntent] = useState<{ remove: boolean; id: string }>({ remove: false, id: '' })
  const [invalid, setInvalid] = useState(false)
  const original = profiles.find(item => item.id === selected)
  const dirty = label !== (original?.label || '') || name !== (original?.name || '') || email !== (original?.email || '')
  function requestEdit(id: string) { if (dirty) { setIntent({ remove: false, id }); confirmation.current?.showModal() } else edit(id) }
  useEffect(() => {
    let live = true
    api.profiles().then(value => { if (live) { setProfiles(value); setReady(true); setError('') } }).catch(reason => { if (live) setError(reason.message) })
    return () => { live = false }
  }, [api, revision])
  const target = repos.find(repo => repo.path === (path || activePath)) || repos[0]
  const profile = profiles.find(item => item.id === applying)
  function edit(id: string) { const item = profiles.find(item => item.id === id); setInvalid(false); setSelected(id); setLabel(item?.label || ''); setName(item?.name || ''); setEmail(item?.email || ''); setError(''); setNotice('') }
  async function save(remove = false) {
    if (busy) return
    if (!remove && (!label.trim() || !name.trim() || !email.trim() || !form.current?.checkValidity())) { setInvalid(true); setError('표시된 프로필 항목을 확인하세요.'); const fields = form.current?.querySelectorAll<HTMLInputElement>('input'); const values = [label, name, email]; Array.from(fields || []).find((field, index) => !values[index].trim() || !field.validity.valid)?.focus(); return }
    setBusy(true); setError(''); setNotice('')
    const id = selected || crypto.randomUUID()
    const next = remove ? profiles.filter(item => item.id !== id) : [...profiles.filter(item => item.id !== id), { id, label: label.trim(), name: name.trim(), email: email.trim() }]
    try { setProfiles(await api.saveProfiles(next)); if (remove) { edit(''); if (applying === id) setApplying('') } else { setSelected(id); setLabel(label.trim()); setName(name.trim()); setEmail(email.trim()); setApplying(id) } setInvalid(false); confirmation.current?.close(); setNotice(remove ? '프로필을 삭제했습니다. 저장소에 적용된 작성자는 유지됩니다.' : '프로필을 저장했습니다. 아래에서 적용할 저장소를 선택하세요.') }
    catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }
  async function apply() {
    if (!target || !profile || busy) return
    setBusy(true); onBusy(target.path, true); setError(''); setNotice('')
    try { onRepo(await api.mutate(target.path, { action: 'identity', expected: target.token, name: profile.name, email: profile.email })); setNotice(`${target.name} 작성자를 ${profile.label}로 변경했습니다.`) }
    catch (reason) { setError((reason as Error).message); try { onRepo(await api.state(target.path)) } catch { /* Keep the actionable mutation error. */ } }
    finally { setBusy(false); onBusy(target.path, false) }
  }
  return <section className="bl-profile-settings"><div className="bl-page-heading"><h1>앱 설정</h1><p>개인·업무용 Git 작성자 프로필을 저장하고 저장소별로 선택하세요.</p></div>
    {error && <Notice tone="error">{error}</Notice>}{notice && <Notice>{notice}</Notice>}
    {!ready ? error ? <Button onClick={() => { setError(''); setRevision(value => value + 1) }}>프로필 다시 읽기</Button> : <Notice>작성자 프로필을 읽고 있습니다…</Notice> : <>
      <section className="bl-settings-section" aria-label="작성자 프로필 관리"><h2>작성자 프로필</h2><div className="bl-actions"><SelectField label="편집할 프로필" value={selected} disabled={busy} onChange={requestEdit} options={[{ value: '', label: '새 프로필' }, ...profiles.map(item => ({ value: item.id, label: item.label }))]} /><Button disabled={busy} onClick={() => requestEdit('')}>새 프로필</Button></div>
        <form ref={form} noValidate onSubmit={event => { event.preventDefault(); void save() }} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault() }}>
          <div className="bl-filter-grid"><TextField error={invalid && !label.trim() ? '프로필 이름을 입력하세요.' : undefined} label="프로필 이름" placeholder="개인 · 업무" required value={label} disabled={busy} onChange={event => setLabel(event.target.value)} /><TextField error={invalid && !name.trim() ? '작성자 이름을 입력하세요.' : undefined} label="작성자 이름" required value={name} disabled={busy} onChange={event => setName(event.target.value)} /><TextField error={invalid && (!email.trim() || !/^[^\s@]+@[^\s@]+$/.test(email)) ? '올바른 이메일을 입력하세요.' : undefined} label="작성자 이메일" required type="email" value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></div>
          <div className="bl-actions"><Button variant="primary" type="submit" disabled={busy}>프로필 저장</Button><Button disabled={busy || !selected} onClick={() => { setIntent({ remove: true, id: selected }); confirmation.current?.showModal() }}>프로필 삭제</Button></div>
        </form>
      </section>
      <section className="bl-settings-section" aria-label="저장소에 프로필 적용"><h2>저장소에 프로필 적용</h2><p>이후 커밋에 사용할 이름·이메일입니다. 기존 커밋과 Git 로그인 계정은 바뀌지 않습니다. 같은 저장소의 worktree에는 함께 적용될 수 있습니다.</p>
        {target ? <><div className="bl-filter-grid"><SelectField label="프로필 적용 저장소" value={target.path} disabled={busy} onChange={setPath} options={repos.map(repo => ({ value: repo.path, label: `${repo.name} · ${repo.path}` }))} /><SelectField label="적용할 프로필" value={applying} disabled={busy} onChange={setApplying} options={[{ value: '', label: '프로필 선택' }, ...profiles.map(item => ({ value: item.id, label: `${item.label} · ${item.email}` }))]} /></div><p>현재 작성자: {target.identity.name || '미설정'} · {target.identity.email || '미설정'}</p><Button disabled={busy || !profile} onClick={() => void apply()}>선택한 저장소에 적용</Button></> : <EmptyState title="저장소를 열어 주세요">프로필은 먼저 저장할 수 있습니다.</EmptyState>}
      </section>
    </>}
    <Dialog busy={busy} dialogRef={confirmation} title={intent.remove ? '프로필 삭제 확인' : '저장하지 않은 프로필'}><p>{intent.remove ? '이 프로필을 삭제할까요? 저장소에 이미 적용한 작성자는 유지됩니다.' : '편집한 내용을 저장하지 않고 다른 프로필로 이동할까요?'}</p><div className="bl-actions"><Button disabled={busy} onClick={() => confirmation.current?.close()}>계속 편집</Button><Button variant="primary" disabled={busy} onClick={() => { if (intent.remove) void save(true); else { edit(intent.id); confirmation.current?.close() } }}>{intent.remove ? '프로필 삭제' : '변경 버리고 이동'}</Button></div></Dialog>
  </section>
}
