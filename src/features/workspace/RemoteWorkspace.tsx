import { createPortal } from 'react-dom'
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import type { Branch } from './BranchMenu'
import { Button, Checkbox, CodeDiff, Dialog, EmptyState, GitToolbar, Notice, Pagination, SelectField, TextField } from '../../design-system'
import type { DesktopAPI, Repository, SyncInput, SyncSnapshot } from '../../app/types'

const labels: Record<string, string> = { fetch: 'Fetch', pull: 'Pull · fast-forward', push: 'Push', upstream: 'Upstream 설정', 'remote-add': '원격 추가', 'stash-save': '변경 보관', 'stash-apply': 'Stash 복원', 'stash-drop': 'Stash 삭제', 'stash-pop': 'Pop', preview: '보관한 변경' }
export type RemoteActions = { prepareBranch: (action: 'fetch' | 'pull', branch: Branch) => void }
export function RemoteWorkspace({ ref, api, repo, active, onRepo, onBusy, onChanges, toolbarHost, onBranch, blocked = false, expanded = true, section = 'remote', stashSha }: { ref?: Ref<RemoteActions>; section?: 'remote' | 'stash'; stashSha?: string; toolbarHost?: HTMLElement | null; onBranch?: () => void; blocked?: boolean; expanded?: boolean; api: DesktopAPI; repo: Repository; active: boolean; onRepo: (repo: Repository) => void; onBusy: (value: boolean) => void; onChanges: () => void }) {
  const [data, setData] = useState<{ key: string; value: SyncSnapshot } | null>(null)
  const [offset, setOffset] = useState(0)
  const [readError, setReadError] = useState<{ key: string; message: string } | null>(null)
  const [revision, setRevision] = useState(0)
  const [remoteName, setRemoteName] = useState('')
  const [branch, setBranch] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [running, setRunning] = useState<{ id: string; action: string } | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [pending, setPending] = useState<SyncInput | null>(null)
  const [branchContext, setBranchContext] = useState('')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [message, setMessage] = useState('')
  const [includeUntracked, setIncludeUntracked] = useState(true)
  const [restoreIndex, setRestoreIndex] = useState(false)
  const [formError, setFormError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedDiff, setSelectedDiff] = useState<{ key: string; value?: string; error?: string } | null>(null)
  const [diffRetry, setDiffRetry] = useState(0)
  const selectedKey = `${repo.path}/${stashSha}/${diffRetry}`
  useEffect(() => {
    if (!active || !expanded || section !== 'stash' || !stashSha) return
    let live = true
    api.stashDiff(repo.path, stashSha).then(value => { if (live) setSelectedDiff({ key: selectedKey, value }) }).catch(e => { if (live) setSelectedDiff({ key: selectedKey, error: e.message }) })
    return () => { live = false }
  }, [api, active, expanded, section, repo.path, stashSha, selectedKey])
  const dialog = useRef<HTMLDialogElement>(null)
  const previewRequest = useRef(0)
  const firstField = useRef<HTMLInputElement>(null)
  const urlField = useRef<HTMLInputElement>(null)
  const key = `${repo.token}/${repo.checkedAt}/${offset}/${revision}/${expanded}`
  useEffect(() => {
    if (!active) return
    let live = true
    api.syncState(repo.path, offset).then(value => { if (live) { setData({ key, value }); if (!value.stashes.length && offset) setOffset(Math.max(0, offset - 100)) } }).catch(e => { if (live) setReadError({ key, message: e.message }) })
    return () => { live = false }
  }, [api, active, repo.path, key, offset])
  const loadError = readError?.key === key ? readError.message : ''
  // A repeated refresh of the same Git state must not disable a tool mid-click.
  const snapshot = !loadError && data && (data.key === key || data.value.repository.token === repo.token && data.value.offset === offset) ? data.value : null
  const current = snapshot?.repository || repo
  const remote = snapshot?.remotes.find(r => r.name === remoteName) || snapshot?.remotes.find(r => r.name === snapshot.upstream.remote) || snapshot?.remotes[0]
  const targetBranch = branch ?? (snapshot?.upstream.remote === remote?.name ? snapshot?.upstream.branch : null) ?? current.branch ?? ''
  const disabled = blocked || !!running || !snapshot
  function prepare(action: string, extra: Partial<SyncInput> = {}) {
    if (!snapshot) return
    setBranchContext('')
    const request = ++previewRequest.current
    setPending({ id: crypto.randomUUID(), action, expected: current.token, remote: remote?.name, branch: targetBranch, ...extra }); setFormError(''); setPreview(null); setRestoreIndex(false)
    dialog.current?.showModal()
    if (action === 'preview') api.stashDiff(repo.path, extra.stashSha!).then(value => { if (previewRequest.current === request) setPreview(value) }).catch(e => { if (previewRequest.current === request) setFormError(e.message) })
  }
  useImperativeHandle(ref, () => ({ prepareBranch(action, selected) {
    if (!active || blocked || running) return
    if (!snapshot) { setError(loadError || '원격 설정을 읽고 있습니다. 잠시 후 다시 시도하세요.'); return }
    const source = current.refs.find(item => item.ref === selected.ref)
    if (!source || source.sha !== selected.sha || source.tracking?.ref !== selected.tracking?.ref) { setError('선택한 브랜치가 변경되었습니다. 다시 선택하세요.'); return }
    const local = source.ref.startsWith('refs/heads/'), remoteRef = local ? source.tracking?.ref : source.ref
    // Remote names may contain slashes; choose the longest configured prefix.
    const target = snapshot.remotes.filter(item => remoteRef?.startsWith(`refs/remotes/${item.name}/`)).sort((a, b) => b.name.length - a.name.length)[0]
    if (!target || target.blocked) { setError(target?.blocked || '선택한 브랜치의 원격 추적 설정을 확인하세요.'); return }
    if (action === 'pull' && (!current.head || !current.branch || current.operation || current.files.some(file => file.conflict) || local && source.ref !== `refs/heads/${current.branch}`)) { setError('Pull할 로컬 브랜치를 체크아웃하고 충돌과 진행 중 작업을 정리하세요.'); return }
    prepare(action, { remote: target.name, branch: remoteRef!.slice(`refs/remotes/${target.name}/`.length) })
    setBranchContext(source.name)
  } }))
  async function execute(input: SyncInput) {
    if (running || blocked) return
    setRunning({ id: input.id, action: input.action }); onBusy(true); setCanceling(false); setError(''); setFormError(''); setNotice('')
    try {
      onRepo(await api.sync(repo.path, input)); dialog.current?.close()
      setNotice(input.action === 'pull' ? 'Pull을 완료했습니다. 자동 보관한 변경이 있으면 스테이징 상태까지 복원하고 해당 Stash를 삭제했습니다.' : input.action === 'push' ? 'Push를 완료했습니다. Fetch로 원격 추적 상태를 다시 확인하세요.' : input.action === 'stash-pop' ? '변경을 복원하고 해당 Stash를 제거했습니다. 내 변경 사항에서 확인하세요.' : input.action === 'stash-apply' ? '변경을 복원했습니다. 내 변경 사항에서 확인하세요. Stash 원본은 유지했습니다.' : `${labels[input.action]} 작업을 완료했습니다.`)
      if (input.action === 'remote-add') { setRemoteName(input.remote!); setName(''); setUrl('') }
      if (input.action === 'stash-save') setMessage('')
    } catch (e) {
      const reason = (e as Error).message; setError(reason); setFormError(reason)
      try { const refreshed = await api.state(repo.path); onRepo(refreshed); if (refreshed.files.some(file => file.conflict)) dialog.current?.close() } catch { setError(`${reason}\n저장소 상태를 다시 읽지 못했습니다. 상태 새로고침을 사용하세요.`) }
    } finally { setRunning(null); onBusy(false) }
  }
  function submit() {
    if (!pending) return
    if (pending.action === 'remote-add' && !name.trim()) { setFormError('원격 이름을 입력하세요.'); firstField.current?.focus(); return }
    if (pending.action === 'remote-add' && !url.trim()) { setFormError('원격 주소를 입력하세요.'); urlField.current?.focus(); return }
    if (pending.action === 'stash-save' && !message.trim()) { setFormError('보관 메시지를 입력하세요.'); firstField.current?.focus(); return }
    void execute({ ...pending, ...(pending.action === 'remote-add' ? { remote: name.trim(), url: url.trim() } : {}), message, includeUntracked, restoreIndex })
  }
  async function preparePop() {
    if (disabled) return
    setRunning({ id: crypto.randomUUID(), action: 'stash-pop' }); onBusy(true); setError('')
    try {
      const latest = await api.syncState(repo.path, 0), stash = latest.stashes[0]
      if (!stash) throw new Error('보관한 변경이 없습니다. Stash 목록을 다시 확인하세요.')
      prepare('stash-pop', { expected: latest.repository.token, stashRef: stash.ref, stashSha: stash.sha })
    } catch (reason) { setError((reason as Error).message) }
    finally { setRunning(null); onBusy(false) }
  }
  const matchesUpstream = snapshot?.upstream.remote === remote?.name && snapshot?.upstream.branch === targetBranch
  const counts = { incoming: matchesUpstream ? snapshot?.upstream.behind ?? null : null, outgoing: matchesUpstream && remote?.fetch === remote?.push ? snapshot?.upstream.ahead ?? null : null }
  const checkStatus = repo.remoteCheck?.error || (repo.remoteCheck?.checkedAt ? `자동 Fetch 확인 ${new Date(repo.remoteCheck.checkedAt).toLocaleTimeString('ko-KR')}` : '자동 Fetch · 1분 간격')
  const countStatus = `추적 브랜치 기준 · 받을 커밋 ${counts.incoming ?? '확인 불가'} · 보낼 커밋 ${counts.outgoing ?? '확인 불가'} · ${checkStatus}`
  const quick = <GitToolbar counts={counts} onAction={action => {
    if (action === 'branch') onBranch?.()
    else if (!snapshot || disabled) return
    else if (action === 'stash-pop') void preparePop()
    else prepare(action)
  }} disabled={{
    branch: blocked || !!running || !current.head,
    fetch: disabled || !remote || !!remote.blocked,
    pull: disabled || !remote || !!remote.blocked || !targetBranch || !current.head || !current.branch || current.files.some(file => file.conflict) || !!current.operation,
    push: disabled || !remote || !!remote.blocked || !targetBranch || !current.head || !current.branch || !!current.operation,
    'stash-save': disabled || !current.head || !current.files.length || !!current.operation || current.files.some(file => file.conflict),
    'stash-pop': disabled || !snapshot?.stashes.length || !!current.files.length || !!current.operation,
  }} reasons={{ fetch: loadError || (!remote ? '원격 설정에서 원격 저장소를 등록하세요.' : `Fetch · ${remote.name} · 배지는 Fetch 후 Pull 대기 커밋 수 · ${countStatus}`), pull: current.operation ? `${current.operation} 작업을 먼저 완료하세요.` : current.files.some(file => file.conflict) ? '충돌을 먼저 해결하세요.' : current.files.length ? '변경을 자동 Stash한 뒤 Pull하고 스테이징 상태까지 복원합니다.' : `Pull · ${remote?.name || '원격 미설정'}/${targetBranch} · ${countStatus}`, push: `Push · ${remote?.name || '원격 미설정'}/${targetBranch} · ${countStatus}`, 'stash-pop': current.files.length ? '깨끗한 작업 디렉터리에서 Pop하세요.' : '최근 Stash를 복원한 뒤 성공한 경우에만 제거합니다.' }} />
  return <>
    {toolbarHost && createPortal(quick, toolbarHost)}
    {!expanded && (error || notice || running || loadError) && <Notice tone={error || loadError ? 'error' : 'info'}>{error || loadError || (running ? `${labels[running.action]} 실행 중…` : notice)}{loadError && <Button onClick={() => setRevision(value => value + 1)}>원격 목록 다시 시도</Button>}{!running && !loadError && <Button variant="ghost" aria-label="Git 작업 알림 닫기" onClick={() => { setError(''); setNotice('') }}>×</Button>}</Notice>}
    {expanded && <div className="bl-sync">
    {section === 'remote' && <Notice>원격 주소와 현재 브랜치의 추적 대상을 관리합니다. Fetch·Pull·Push는 상단 도구 모음에서 실행하세요. Git 인증은 기존 credential helper·SSH를 사용하며 호스팅 계정 연결과는 별개입니다.</Notice>}
    <div className="bl-feedback">{error ? <Notice tone="error">{error}</Notice> : notice ? <Notice>{notice}</Notice> : null}</div>
    {running && <Notice>{labels[running.action]} 실행 중… {['fetch', 'pull', 'push'].includes(running.action) && <Button disabled={canceling} onClick={() => { setCanceling(true); api.cancel(running.id).catch(e => setError(e.message)) }}>{canceling ? '취소 요청됨' : '작업 취소'}</Button>}</Notice>}
    {section === 'remote' && <section className="bl-sync-section" aria-label="원격 설정"><div className="bl-row-between"><h2>원격 주소·추적 브랜치</h2><Button disabled={disabled} onClick={() => prepare('remote-add')}>원격 추가</Button></div>
      {!snapshot ? loadError ? <><Notice tone="error">{loadError}</Notice><Button onClick={() => setRevision(v => v + 1)}>원격 목록 다시 시도</Button></> : <Notice>원격 설정과 보관 목록을 읽고 있습니다…</Notice> : !remote ? <EmptyState title="등록된 원격이 없습니다">원격을 추가하면 커밋을 보내고 다른 작업자의 변경을 받을 수 있습니다.</EmptyState> : <>
        <div className="bl-filter-grid"><SelectField label="원격 저장소" value={remote.name} onChange={value => { setRemoteName(value); setBranch(null) }} disabled={disabled} options={snapshot.remotes.map(r => ({ value: r.name, label: r.name }))} /><TextField label="대상 원격 브랜치" value={targetBranch} disabled={disabled} onChange={e => setBranch(e.target.value)} hint="Pull·Push·Upstream에 사용할 브랜치 이름" /></div>
        <dl className="bl-facts"><dt>받을 주소</dt><dd><code>{remote.fetch}</code></dd><dt>보낼 주소</dt><dd><code>{remote.push}</code></dd><dt>추적 브랜치</dt><dd>{snapshot.upstream.ref || '미설정 또는 로컬 추적 ref 없음'}</dd><dt>추적 ref와 차이</dt><dd>{snapshot.upstream.ahead === null ? '비교할 추적 이력이 없습니다.' : `보낼 커밋 ${snapshot.upstream.ahead}개 · 받을 커밋 ${snapshot.upstream.behind}개`}{current.shallow && ' · shallow 이력 기준'}</dd></dl>
        {remote.blocked && <Notice tone="error">{remote.blocked}</Notice>}
        <div className="bl-actions"><Button disabled={disabled || !!remote.blocked || !current.head || !current.branch || !targetBranch || !!current.operation} onClick={() => prepare('upstream')}>Upstream 설정</Button></div>
        <p className="bl-muted">Upstream은 Fetch한 브랜치만 선택할 수 있습니다. 여러 원격이 있다면 위에서 대상을 선택하거나 상단 Git 작업의 확인 창에서 변경하세요.</p>
      </>}
    </section>}
    {section === 'stash' && <section className="bl-sync-section" aria-label="Stash 보관함"><div className="bl-row-between"><div><h2>Stash 보관함</h2><p className="bl-muted">같은 저장소의 모든 worktree가 공유합니다.</p></div><div className="bl-actions"><Button disabled={!!running} onClick={onChanges}>내 변경 사항 보기</Button><Button disabled={disabled || !current.head || !current.files.length || !!current.operation || current.files.some(f => f.conflict)} onClick={() => prepare('stash-save')}>변경 보관</Button></div></div>
      {stashSha && <section className="bl-stash-preview" aria-label="선택한 Stash 변경"><h3>선택한 Stash · {stashSha.slice(0, 8)}</h3>{selectedDiff?.key !== selectedKey ? <Notice>보관한 변경을 읽고 있습니다…</Notice> : selectedDiff.error ? <><Notice tone="error">{selectedDiff.error}</Notice><Button onClick={() => setDiffRetry(value => value + 1)}>변경 다시 시도</Button></> : <CodeDiff value={selectedDiff.value || '표시할 텍스트 변경이 없습니다.'} />}</section>}
      {!snapshot && (loadError ? <><Notice tone="error">{loadError}</Notice><Button onClick={() => setRevision(value => value + 1)}>Stash 목록 다시 시도</Button></> : <Notice>Stash 목록을 읽고 있습니다…</Notice>)}
      {snapshot && (snapshot.stashes.length ? <div className="bl-worktree-list">{snapshot.stashes.map(stash => <article className="bl-worktree" key={`${stash.ref}/${stash.sha}`}><div><h3>{stash.message}</h3><p><code>{stash.ref} · {stash.sha.slice(0, 8)}</code></p><small>{new Date(stash.date).toLocaleString('ko-KR')}</small></div><div className="bl-actions"><Button disabled={disabled} onClick={() => prepare('preview', { stashRef: stash.ref, stashSha: stash.sha })}>변경 보기</Button><Button disabled={disabled || !!current.files.length || !!current.operation} onClick={() => prepare('stash-apply', { stashRef: stash.ref, stashSha: stash.sha })}>복원</Button><Button disabled={disabled} onClick={() => prepare('stash-drop', { stashRef: stash.ref, stashSha: stash.sha })}>삭제</Button></div></article>)}</div> : <EmptyState title="보관한 변경이 없습니다">작업 중인 변경을 잠시 보관하고 다른 브랜치에서 작업할 수 있습니다.</EmptyState>)}
      <Pagination label="Stash 보관 항목 페이지" page={offset / 100 + 1} hasMore={!!snapshot?.hasMore} busy={disabled} previousLabel="이전 보관 항목" nextLabel="다음 보관 항목" summary={`${offset + (snapshot?.stashes.length ? 1 : 0)}–${offset + (snapshot?.stashes.length || 0)}개 표시`} onChange={page => setOffset((page - 1) * 100)} />
    </section>}
    </div>}
    <Dialog dialogRef={dialog} title={labels[pending?.action || 'preview']} busy={!!running} onClose={() => { previewRequest.current++; setFormError('') }}>
      {pending?.action === 'preview' ? <>{formError ? <Notice tone="error">{formError}</Notice> : preview === null ? <Notice>보관한 변경을 읽고 있습니다…</Notice> : <CodeDiff value={preview || '표시할 텍스트 변경이 없습니다.'} />}</> : <form noValidate onSubmit={e => { e.preventDefault(); submit() }} onKeyDown={e => { if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault() }}>
        {pending?.action === 'remote-add' ? <><TextField ref={firstField} label="원격 이름" placeholder="origin" value={name} disabled={!!running} onChange={e => setName(e.target.value)} error={formError && !name.trim() ? formError : undefined} /><TextField ref={urlField} label="원격 주소" placeholder="https://github.com/team/repository.git" value={url} disabled={!!running} onChange={e => setUrl(e.target.value)} error={formError && !url.trim() ? formError : undefined} hint="토큰·비밀번호를 URL에 넣지 마세요. HTTPS·SSH·로컬 절대 경로 지원" /></> : pending?.action === 'stash-save' ? <><TextField ref={firstField} label="보관 메시지" value={message} disabled={!!running} onChange={e => setMessage(e.target.value)} error={formError && !message.trim() ? formError : undefined} /><Checkbox label="미추적 파일도 보관" checked={includeUntracked} disabled={!!running} onChange={e => setIncludeUntracked(e.target.checked)} /><p>보관한 변경은 작업 디렉터리에서 제거됩니다. ignored 파일과 submodule 내부 변경은 포함하지 않습니다.</p></> : <div className="bl-confirm">{branchContext && <Notice>선택 브랜치: {branchContext}{pending?.action === 'pull' ? ` · 반영할 로컬 브랜치: ${current.branch}` : ' · 해당 원격의 전체 이력을 가져옵니다.'}</Notice>}{pending && ['fetch', 'pull', 'push'].includes(pending.action) && <><SelectField label="작업 원격" value={pending.remote || ''} disabled={!!running || !!branchContext} options={snapshot?.remotes.filter(item => !item.blocked).map(item => ({ value: item.name, label: item.name })) || []} onChange={remote => setPending({ ...pending, remote })} />{pending.action !== 'fetch' && <TextField label="작업 대상 브랜치" value={pending.branch || ''} disabled={!!running || !!branchContext} onChange={event => setPending({ ...pending, branch: event.target.value })} />}</>}<p>{pending?.action === 'push' ? '아래 커밋을 선택한 원격 브랜치에 게시합니다. 작업 파일의 미커밋 변경은 포함하지 않습니다. 강제 Push는 실행하지 않습니다.' : pending?.action === 'pull' ? `현재 변경: ${current.files.length}개. 변경이 있으면 미추적 파일과 함께 자동 Stash한 뒤 Fetch·fast-forward Pull합니다. 이후 stash apply로 스테이징 상태까지 복원하고 성공한 자동 Stash만 삭제합니다. 충돌·실패 시 Stash를 보존합니다. ignored 파일과 서브모듈 내부 변경은 포함하지 않습니다.` : pending?.action === 'upstream' ? '현재 로컬 브랜치의 기본 추적 대상을 변경합니다.' : pending?.action === 'fetch' ? '선택한 원격의 이력을 가져옵니다. 현재 브랜치와 작업 파일은 유지합니다.' : pending?.action === 'stash-pop' ? '현재 worktree에 최근 Stash를 복원하고 성공한 경우에만 보관 항목을 제거합니다. 충돌 또는 실패 시 원본을 유지합니다.' : pending?.action === 'stash-apply' ? '현재 worktree에 변경을 복원합니다. 충돌이 생기면 직접 검토해야 하며 stash 원본은 유지됩니다.' : '보관 목록에서 이 항목을 삭제합니다. 앱에서 실행 취소할 수 없습니다. 복원한 작업 파일은 그대로 유지됩니다.'}</p><pre>{pending?.stashRef ? `${pending.stashRef}\n${pending.stashSha}` : `${pending?.action === 'fetch' ? `원격 ${pending.remote}` : pending?.action === 'pull' ? `${pending.remote}/${pending.branch} → ${current.branch}` : `${current.branch} → ${pending?.remote}/${pending?.branch}`}\n${pending?.action === 'push' ? snapshot?.remotes.find(item => item.name === pending.remote)?.push : snapshot?.remotes.find(item => item.name === pending?.remote)?.fetch}\nHEAD ${current.head}`}</pre>{['stash-apply', 'stash-pop'].includes(pending?.action || '') && <Checkbox label="스테이징 상태도 복원" checked={restoreIndex} disabled={!!running} onChange={e => setRestoreIndex(e.target.checked)} />}</div>}
        {formError && <Notice tone="error">{formError}</Notice>}
        <div className="bl-actions bl-dialog-actions"><Button disabled={!!running} onClick={() => dialog.current?.close()}>취소</Button>{running && ['fetch', 'pull', 'push'].includes(running.action) && <Button disabled={canceling} onClick={() => { setCanceling(true); api.cancel(running.id).catch(e => setFormError(e.message)) }}>{canceling ? '취소 요청됨' : '작업 취소'}</Button>}<Button type="submit" variant="primary" loading={!!running}>{labels[pending?.action || 'fetch']}</Button></div>
      </form>}
    </Dialog>
  </>
}
