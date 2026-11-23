import { ToastMessage } from '../../design-system'
import { createPortal } from 'react-dom'
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { StashMenu, type Stash, type StashAction } from './StashMenu'
import type { Branch } from './BranchMenu'
import { Button, Checkbox, CodeDiff, Dialog, EmptyState, GitToolbar, Notice, Pagination, SelectField, TextField } from '../../design-system'
import type { DesktopAPI, PushRecovery, Repository, SyncInput, SyncSnapshot } from '../../app/types'
import { operationLabel } from './operation'

const labels: Record<string, string> = { fetch: 'Fetch', pull: 'Pull · fast-forward', push: 'Push', upstream: 'Upstream 설정', 'remote-add': '원격 추가', 'stash-save': '변경 보관', 'stash-apply': 'Stash 복원', 'stash-drop': 'Stash 삭제', 'stash-pop': 'Pop', preview: '보관한 변경' }
export type ReviewPush = (remote: string, url: string, branch: string, sha: string) => Promise<boolean>
export type RemoteActions = { pushForReview: ReviewPush; prepareStash: (action: StashAction, stash: Stash) => void; prepareBranch: (action: 'fetch' | 'pull', branch: Branch) => void }
function recoveryMessage(recovery: PushRecovery) {
  const destination = `${recovery.remote}/${recovery.branch}`
  if (recovery.ahead > 0 && recovery.behind > 0) return `${destination}에 먼저 올라간 커밋 ${recovery.behind}개가 있어 Push하지 않았습니다. Merge 또는 Rebase 후 다시 Push하세요. 보낼 커밋 ${recovery.ahead}개는 그대로입니다.`
  if (recovery.ahead === 0 && recovery.behind > 0) return `보낼 커밋이 없고 ${destination}에 받을 커밋 ${recovery.behind}개가 있습니다. Pull로 최신 상태를 받으세요.`
  return recovery.message
}

export function RemoteWorkspace({ ref, api, repo, active, onRepo, onBusy, onChanges, toolbarHost, commitPushHost, onRemoteSettings, onCompare, onIntegrate, onBranch, blocked = false, expanded = true, section = 'remote', stashSha, onStashRemoved }: { onIntegrate?: (action: 'merge' | 'rebase', ref: string, sha: string) => void; onStashRemoved?: (sha: string, ref: string, message?: string) => void; ref?: Ref<RemoteActions>; section?: 'remote' | 'stash'; stashSha?: string; toolbarHost?: HTMLElement | null; commitPushHost?: HTMLElement | null; onRemoteSettings: () => void; onCompare: (source: string, target: string) => void; onBranch?: () => void; blocked?: boolean; expanded?: boolean; api: DesktopAPI; repo: Repository; active: boolean; onRepo: (repo: Repository) => void; onBusy: (value: boolean) => void; onChanges: () => void }) {
  const [data, setData] = useState<{ key: string; value: SyncSnapshot } | null>(null)
  const [offset, setOffset] = useState(0)
  const [readError, setReadError] = useState<{ key: string; message: string } | null>(null)
  const [revision, setRevision] = useState(0)
  const [remoteName, setRemoteName] = useState('')
  const [branch, setBranch] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [recovery, setRecovery] = useState<PushRecovery | null>(null)
  const [fetched, setFetched] = useState<{ message: string; pull: boolean; diverged: boolean } | null>(null)
  const [running, setRunning] = useState<{ id: string; action: string } | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [pending, setPending] = useState<SyncInput | null>(null)
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
  const previewRequest = useRef(0), inFlight = useRef(false)
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
  const [settingsBranch, setSettingsBranch] = useState(repo.branch)
  if (settingsBranch !== repo.branch) {
    setSettingsBranch(repo.branch); setRemoteName(''); setBranch(null)
  }
  const remotes = snapshot?.remotes || []
  const upstream = snapshot?.upstream
  const pushRemote = upstream?.remote ? remotes.find(item => item.name === upstream.remote)
    : remotes.find(item => item.name === 'origin') ?? (remotes.length === 1 ? remotes[0] : undefined)
  const pushBranch = upstream?.remote ? upstream.branch : current.branch
  const remote = remotes.find(item => item.name === remoteName) ?? pushRemote ?? remotes[0]
  const targetBranch = branch ?? (upstream?.remote === remote?.name ? upstream?.branch : null) ?? current.branch ?? ''
  function canTrack(destination: typeof remote, target: string | null) {
    return !!destination && !!target && destination.fetch === destination.push && !upstream?.remote && !upstream?.branch && target === current.branch
  }
  const remoteTip = recovery ? recovery.repository.refs.find(item => item.ref === `refs/remotes/${recovery.remote}/${recovery.branch}`) : undefined
  const stashBlocked = !!current.operation || current.files.some(file => file.conflict)
  const disabled = blocked || !!running || !snapshot
  function prepare(action: string, extra: Partial<SyncInput> = {}) {
    if (!snapshot || disabled || inFlight.current) return
    const input = { id: crypto.randomUUID(), action, expected: current.token, remote: remote?.name, branch: targetBranch, restoreIndex, ...extra }
    if (['fetch', 'pull', 'push', 'upstream', 'stash-apply', 'stash-pop'].includes(action)) { void execute(input); return }
    const request = ++previewRequest.current
    setPending(input); setFormError(''); setPreview(null)
    dialog.current?.showModal()
    if (action === 'preview') api.stashDiff(repo.path, extra.stashSha!).then(value => { if (previewRequest.current === request) setPreview(value) }).catch(e => { if (previewRequest.current === request) setFormError(e.message) })
  }
  function prepareStash(action: StashAction, stash: Stash) {
    if (!active || blocked || running || inFlight.current) return
    if (!snapshot) { setError(loadError || 'Stash 목록을 읽고 있습니다. 잠시 후 다시 시도하세요.'); return }
    if (action !== 'stash-drop' && stashBlocked) { setError('진행 중인 Git 작업과 충돌을 먼저 해결하세요.'); return }
    prepare(action, { stashRef: stash.ref, stashSha: stash.sha, stashMessage: stash.message })
  }
  useImperativeHandle(ref, () => ({ prepareStash, async pushForReview(name, url, branch, sha) {
    const destination = snapshot?.remotes.find(item => item.name === name && item.push === url && !item.blocked)
    if (!active || disabled || !destination || current.branch !== branch || current.head !== sha || current.operation) {
      setError('브랜치 또는 원격 상태가 바뀌었습니다. 비교를 새로고침한 뒤 Push하세요.')
      return false
    }
    return execute({ id: crypto.randomUUID(), action: 'push', expected: current.token, remote: name, branch })
  }, prepareBranch(action, selected) {
    if (!active || blocked || running) return
    if (!snapshot) { setError(loadError || '원격 설정을 읽고 있습니다. 잠시 후 다시 시도하세요.'); return }
    const source = current.refs.find(item => item.ref === selected.ref)
    if (!source || source.sha !== selected.sha || source.tracking?.ref !== selected.tracking?.ref) { setError('선택한 브랜치가 변경되었습니다. 다시 선택하세요.'); return }
    const local = source.ref.startsWith('refs/heads/'), remoteRef = local ? source.tracking?.ref : source.ref
    // Remote names may contain slashes; choose the longest configured prefix.
    const target = snapshot.remotes.filter(item => remoteRef?.startsWith(`refs/remotes/${item.name}/`)).sort((a, b) => b.name.length - a.name.length)[0]
    if (!target || target.blocked) { setError(target?.blocked || '선택한 브랜치의 원격 추적 설정을 확인하세요.'); return }
    const backgroundPull = local && source.ref !== `refs/heads/${current.branch}`
    if (action === 'pull' && !backgroundPull && (!current.head || !current.branch || current.operation || current.files.some(file => file.conflict))) { setError('Pull할 로컬 브랜치를 체크아웃하고 충돌과 진행 중 작업을 정리하세요.'); return }
    prepare(action, { fetchBranchOnly: action === 'fetch', remote: target.name, branch: remoteRef!.slice(`refs/remotes/${target.name}/`.length), ...(action === 'pull' && local ? { localBranch: source.ref.slice(11) } : {}) })
  } }))
  async function execute(input: SyncInput) {
    if (inFlight.current || blocked) return false
    inFlight.current = true
    setRecovery(null); setFetched(null)
    setRunning({ id: input.id, action: input.action }); onBusy(true); setCanceling(false); setError(''); setFormError(''); setNotice('')
    const backgroundPull = input.action === 'pull' && input.localBranch && input.localBranch !== current.branch
    try {
      const result = await api.sync(repo.path, input)
      if ('rejectedPush' in result) {
        onRepo(result.rejectedPush.repository)
        setRecovery(result.rejectedPush)
        return false
      }
      onRepo(result); dialog.current?.close()
      if (input.stashSha && ['stash-pop', 'stash-drop'].includes(input.action)) onStashRemoved?.(input.stashSha, input.stashRef!, input.stashMessage)
      if (input.action === 'fetch' && !input.fetchBranchOnly) {
        const tracking = result.refs.find(item => item.ref === `refs/heads/${result.branch}`)?.tracking
        const name = tracking?.ref.replace(/^refs\/remotes\//, '')
        const behind = tracking?.behind ?? 0
        setFetched({ message: !tracking || !name ? 'Fetch를 완료했습니다. 현재 브랜치에 추적 브랜치가 없습니다.' : behind > 0 && (tracking?.ahead ?? 0) > 0 ? `${name}에서 받을 커밋 ${behind}개가 있고 보낼 커밋 ${tracking?.ahead}개와 이력이 갈라졌습니다. Push 전에 브랜치 비교에서 Merge 또는 Rebase하세요.` : behind > 0 ? `${name}에서 받을 커밋 ${behind}개가 있습니다.` : `현재 브랜치가 ${name}의 최신 이력과 같습니다.`, pull: behind > 0 && (tracking?.ahead ?? 0) === 0, diverged: behind > 0 && (tracking?.ahead ?? 0) > 0 })
        return true
      }
      setNotice(backgroundPull ? `${input.localBranch} Pull을 완료했습니다.` : input.action === 'pull' ? 'Pull을 완료했습니다.' : input.action === 'push' ? 'Push를 완료했습니다.' : input.action === 'stash-pop' ? 'Stash를 복원하고 제거했습니다.' : input.action === 'stash-apply' ? 'Stash를 복원했습니다.' : `${labels[input.action]} 작업을 완료했습니다.`)
      if (input.action === 'remote-add') { setRemoteName(input.remote!); setName(''); setUrl('') }
      if (input.action === 'stash-save') setMessage('')
      return true
    } catch (e) {
      const reason = (e as Error).message; setError(reason)
      try { const refreshed = await api.state(repo.path); onRepo(refreshed); if (refreshed.files.some(file => file.conflict)) dialog.current?.close() } catch { setError(`${reason}\n저장소 상태를 다시 읽지 못했습니다. 상태 새로고침을 사용하세요.`) }
      return false
    } finally { inFlight.current = false; setRunning(null); onBusy(false) }
  }
  function submit() {
    if (!pending) return
    if (pending.action === 'remote-add' && !name.trim()) { setFormError('원격 이름을 입력하세요.'); firstField.current?.focus(); return }
    if (pending.action === 'remote-add' && !url.trim()) { setFormError('원격 주소를 입력하세요.'); urlField.current?.focus(); return }
    void execute({ ...pending, ...(pending.action === 'remote-add' ? { remote: name.trim(), url: url.trim() } : {}), message, includeUntracked, restoreIndex })
  }
  async function preparePop() {
    if (disabled || inFlight.current) return
    inFlight.current = true
    setRunning({ id: crypto.randomUUID(), action: 'stash-pop' }); onBusy(true); setError('')
    try {
      const latest = await api.syncState(repo.path, 0), stash = latest.stashes[0]
      if (!stash) throw new Error('보관한 변경이 없습니다. Stash 목록을 다시 확인하세요.')
      inFlight.current = false
      await execute({ id: crypto.randomUUID(), action: 'stash-pop', expected: latest.repository.token, stashRef: stash.ref, stashSha: stash.sha, stashMessage: stash.message, restoreIndex })
    } catch (reason) { setError((reason as Error).message) }
    finally { inFlight.current = false; setRunning(null); onBusy(false) }
  }
  const matchesUpstream = snapshot?.upstream.remote === remote?.name && snapshot?.upstream.branch === targetBranch
  const trackingReason = !remotes.length ? '원격 저장소 없음' : !current.branch ? '분리된 HEAD라 추적 브랜치 없음' : !upstream?.remote ? '추적 브랜치 없음 · 첫 Push 때 설정하거나 Upstream 설정' : ''
  const counts = {
    incoming: matchesUpstream ? upstream?.behind ?? null : null,
    outgoing: pushRemote && pushRemote.name === upstream?.remote && pushRemote.fetch === pushRemote.push ? upstream.ahead : null,
    incomingReason: trackingReason || (!matchesUpstream ? '선택한 원격 브랜치가 추적 브랜치와 다름' : undefined),
    outgoingReason: trackingReason || (pushRemote && pushRemote.fetch !== pushRemote.push ? 'Fetch·Push 주소가 달라 계산하지 않음' : undefined),
  }
  const pushDisabled = disabled || !pushRemote || !!pushRemote.blocked || !pushBranch || !current.head || !current.branch || !!current.operation
  const pushLabel = !pushRemote || !pushBranch ? '원격 설정에서 Push 대상 선택' : canTrack(pushRemote, pushBranch)
    ? `${pushRemote.name}/${pushBranch}에 게시하고 추적`
    : `${pushRemote.name}/${pushBranch}에 ${counts.outgoing === null ? '' : counts.outgoing + '개 '}Push`
  function pushCurrent() {
    if (!pushDisabled) prepare('push', { remote: pushRemote!.name, branch: pushBranch!, publishAndTrack: canTrack(pushRemote, pushBranch) })
  }
  const checkStatus = repo.remoteCheck?.error || (repo.remoteCheck?.checkedAt ? `자동 Fetch 확인 ${new Date(repo.remoteCheck.checkedAt).toLocaleTimeString('ko-KR')}` : '자동 Fetch · 1분 간격')
  const countStatus = trackingReason ? `받을·보낼 커밋 확인 불가 · ${trackingReason} · ${checkStatus}` : `추적 브랜치 기준 · 받을 커밋 ${counts.incoming ?? `확인 불가${counts.incomingReason ? ` (${counts.incomingReason})` : ''}`} · 보낼 커밋 ${counts.outgoing ?? `확인 불가${counts.outgoingReason ? ` (${counts.outgoingReason})` : ''}`} · ${checkStatus}`
  const quick = <GitToolbar counts={counts} onAction={action => {
    if (action === 'branch') onBranch?.()
    else if (!snapshot || disabled) return
    else if (action === 'push') pushCurrent()
    else if (action === 'stash-pop') void preparePop()
    else prepare(action)
  }} disabled={{
    branch: blocked || !!running || !current.head,
    fetch: disabled || !remote || !!remote.blocked,
    pull: disabled || !remote || !!remote.blocked || !targetBranch || !current.head || !current.branch || current.files.some(file => file.conflict) || !!current.operation,
    push: pushDisabled,
    'stash-save': disabled || !current.head || !current.files.length || !!current.operation || current.files.some(file => file.conflict),
    'stash-pop': disabled || !snapshot?.stashes.length || stashBlocked,
  }} reasons={{ fetch: loadError || (!remote ? '원격 설정에서 원격 저장소를 등록하세요.' : `Fetch · ${remote.name} · 배지는 Fetch 후 Pull 대기 커밋 수 · ${countStatus}`), pull: current.operation ? `${operationLabel(current.operation)} 작업을 먼저 완료하세요.` : current.files.some(file => file.conflict) ? '충돌을 먼저 해결하세요.' : current.files.length ? '변경을 유지하며 Pull합니다. 겹치는 변경은 자동 Stash 후 스테이징 상태까지 복원합니다.' : !remote ? '원격 설정에서 원격 저장소를 등록하세요.' : `Pull · ${remote.name}/${targetBranch} · ${countStatus}`, push: `${pushLabel} · ${countStatus}`, 'stash-pop': stashBlocked ? '진행 중인 Git 작업과 충돌을 먼저 해결하세요.' : '최근 Stash를 복원한 뒤 성공한 경우에만 제거합니다.' }} />
  return <>
    {toolbarHost && createPortal(quick, toolbarHost)}
    {commitPushHost && snapshot && counts.outgoing !== 0 && createPortal(
      <Button variant="primary" disabled={pushRemote ? pushDisabled : disabled} onClick={pushRemote ? pushCurrent : onRemoteSettings}>{pushLabel}</Button>, commitPushHost)}
    {active && recovery && repo.token === recovery.repository.token && !disabled && <ToastMessage scope={repo.name} tone="warning" message={recoveryMessage(recovery)}>
      {recovery.ahead === 0 && recovery.behind > 0 && !repo.operation && !repo.files.some(file => file.conflict) && <Button onClick={() => prepare('pull', { remote: recovery.remote, branch: recovery.branch })}>fast-forward Pull</Button>}
      {recovery.ahead > 0 && recovery.behind > 0 && onIntegrate && remoteTip && !repo.operation && !repo.files.some(file => file.conflict) && <>
        <Button onClick={() => { setRecovery(null); onIntegrate('merge', remoteTip.ref, remoteTip.sha) }}>원격 변경 Merge…</Button>
        <Button onClick={() => { setRecovery(null); onIntegrate('rebase', remoteTip.ref, remoteTip.sha) }}>원격 위로 Rebase…</Button>
      </>}
      <Button onClick={() => {
        setRecovery(null)
        onCompare(`refs/remotes/${recovery.remote}/${recovery.branch}`, `refs/heads/${recovery.repository.branch}`)
      }}>브랜치 비교 열기</Button>
    </ToastMessage>}
    {active && fetched && <ToastMessage scope={repo.name} tone={fetched.diverged ? 'warning' : fetched.pull ? 'info' : 'success'} message={fetched.message}>
      {fetched.pull && !disabled && !repo.operation && !repo.files.some(file => file.conflict) && <Button onClick={() => { setFetched(null); prepare('pull') }}>Pull</Button>}
    </ToastMessage>}
    {active && <><ToastMessage scope={repo.name} tone="error" message={error} />
    <ToastMessage scope={repo.name} tone="success" message={notice} />
    <ToastMessage scope={repo.name} tone="error" message={!expanded ? loadError : ''}><Button onClick={() => setRevision(value => value + 1)}>원격 목록 다시 시도</Button></ToastMessage>
    <ToastMessage scope={repo.name} tone="loading" message={running ? `${labels[running.action]} ${canceling ? '취소 요청됨…' : '실행 중…'}` : ''}>{running && ['fetch', 'pull', 'push'].includes(running.action) && <Button disabled={canceling} onClick={() => { setCanceling(true); api.cancel(running.id).catch(e => setError(e.message)) }}>{canceling ? '취소 요청됨' : '작업 취소'}</Button>}</ToastMessage>
    </>}
    {expanded && <div className="bl-sync">
    {section === 'remote' && <section className="bl-sync-section" aria-label="원격 설정"><div className="bl-row-between"><h2>원격 주소·추적 브랜치</h2><Button disabled={disabled} onClick={() => prepare('remote-add')}>원격 추가</Button></div>
      {!snapshot ? loadError ? <><Notice tone="error">{loadError}</Notice><Button onClick={() => setRevision(v => v + 1)}>원격 목록 다시 시도</Button></> : <Notice>원격 설정과 보관 목록을 읽고 있습니다…</Notice> : !remote ? <EmptyState title="등록된 원격이 없습니다">원격을 추가하면 커밋을 보내고 다른 작업자의 변경을 받을 수 있습니다.</EmptyState> : <>
        <div className="bl-filter-grid"><SelectField label="원격 저장소" value={remote.name} onChange={value => { setRemoteName(value); setBranch(null) }} disabled={disabled} options={snapshot.remotes.map(r => ({ value: r.name, label: r.name }))} /><TextField label="대상 원격 브랜치" value={targetBranch} disabled={disabled} onChange={e => setBranch(e.target.value)} /></div>
        <dl className="bl-facts"><dt>받을 주소</dt><dd><code>{remote.fetch}</code></dd><dt>보낼 주소</dt><dd><code>{remote.push}</code></dd><dt>추적 브랜치</dt><dd>{snapshot.upstream.ref || '미설정 또는 로컬 추적 ref 없음'}</dd><dt>추적 ref와 차이</dt><dd>{snapshot.upstream.ahead === null ? '비교할 추적 이력이 없습니다.' : `보낼 커밋 ${snapshot.upstream.ahead}개 · 받을 커밋 ${snapshot.upstream.behind}개`}{current.shallow && ' · shallow 이력 기준'}</dd></dl>
        {remote.blocked && <Notice tone="error">{remote.blocked}</Notice>}
        <div className="bl-actions">
          <Button disabled={disabled || !!remote.blocked || !current.head || !current.branch || !targetBranch || !!current.operation} onClick={() => prepare('push', { publishAndTrack: canTrack(remote, targetBranch) })}>
            {remote.name}/{targetBranch}에 {canTrack(remote, targetBranch) ? '게시하고 추적' : 'Push'}
          </Button>
          <Button disabled={disabled || !!remote.blocked || !current.head || !current.branch || !targetBranch || !!current.operation} onClick={() => prepare('upstream')}>Upstream 설정</Button></div>
      </>}
    </section>}
    {section === 'stash' && <section className="bl-sync-section" aria-label="Stash 보관함"><div className="bl-row-between"><p className="bl-muted">보관한 변경을 확인하고 복원하거나 삭제합니다.</p><div className="bl-actions"><Button disabled={!!running} onClick={onChanges}>내 변경 사항 보기</Button><Button disabled={disabled || !current.head || !current.files.length || !!current.operation || current.files.some(f => f.conflict)} onClick={() => prepare('stash-save')}>변경 보관</Button></div></div>
      <Checkbox label="스테이징 상태도 복원" checked={restoreIndex} disabled={disabled} onChange={event => setRestoreIndex(event.target.checked)} />
      {stashSha && <section className="bl-stash-preview" aria-label="선택한 Stash 변경"><h3>선택한 Stash · {stashSha.slice(0, 8)}</h3>{selectedDiff?.key !== selectedKey ? <Notice>보관한 변경을 읽고 있습니다…</Notice> : selectedDiff.error ? <><Notice tone="error">{selectedDiff.error}</Notice><Button onClick={() => setDiffRetry(value => value + 1)}>변경 다시 시도</Button></> : <CodeDiff value={selectedDiff.value || '표시할 텍스트 변경이 없습니다.'} />}</section>}
      {!snapshot && (loadError ? <><Notice tone="error">{loadError}</Notice><Button onClick={() => setRevision(value => value + 1)}>Stash 목록 다시 시도</Button></> : <Notice>Stash 목록을 읽고 있습니다…</Notice>)}
      {snapshot && (snapshot.stashes.length ? <div className="bl-worktree-list">{snapshot.stashes.map(stash => <StashMenu key={`${stash.ref}/${stash.sha}`} stash={stash} repo={current} disabled={disabled} onAction={prepareStash}><article className="bl-worktree" tabIndex={0}><div><h3>{stash.message}</h3><p><code>{stash.ref} · {stash.sha.slice(0, 8)}</code></p><small>{new Date(stash.date).toLocaleString('ko-KR')}</small></div><div className="bl-actions"><Button disabled={disabled} onClick={() => prepare('preview', { stashRef: stash.ref, stashSha: stash.sha, stashMessage: stash.message })}>변경 보기</Button><Button disabled={disabled || stashBlocked} onClick={() => prepareStash('stash-apply', stash)}>복원</Button><Button disabled={disabled || stashBlocked} onClick={() => prepareStash('stash-pop', stash)}>Pop</Button><Button disabled={disabled} onClick={() => prepareStash('stash-drop', stash)}>삭제</Button></div></article></StashMenu>)}</div> : <EmptyState decorated title="보관한 변경이 없습니다">작업 중인 변경을 잠시 보관하고 다른 브랜치에서 작업할 수 있습니다.</EmptyState>)}
      {(!snapshot || snapshot.stashes.length > 0 || offset > 0) && <Pagination label="Stash 보관 항목 페이지" page={offset / 100 + 1} hasMore={!!snapshot?.hasMore} busy={disabled} previousLabel="이전 보관 항목" nextLabel="다음 보관 항목" summary={`${offset + (snapshot?.stashes.length ? 1 : 0)}–${offset + (snapshot?.stashes.length || 0)}개 표시`} onChange={page => setOffset((page - 1) * 100)} />}
    </section>}
    </div>}
    <Dialog dialogRef={dialog} title={labels[pending?.action || 'preview']} busy={!!running} onClose={() => { previewRequest.current++; setFormError('') }}>
      {pending?.action === 'preview' ? <>{formError ? <Notice tone="error">{formError}</Notice> : preview === null ? <Notice>보관한 변경을 읽고 있습니다…</Notice> : <CodeDiff value={preview || '표시할 텍스트 변경이 없습니다.'} />}</> : <form noValidate onSubmit={e => { e.preventDefault(); submit() }} onKeyDown={e => { if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault() }}>
        {pending?.action === 'remote-add' ? <><TextField ref={firstField} label="원격 이름" placeholder="origin" value={name} disabled={!!running} onChange={e => setName(e.target.value)} error={formError && !name.trim() ? formError : undefined} /><TextField ref={urlField} label="원격 주소" placeholder="https://github.com/team/repository.git" value={url} disabled={!!running} onChange={e => setUrl(e.target.value)} error={formError && !url.trim() ? formError : undefined} hint="토큰·비밀번호를 URL에 넣지 마세요. HTTPS·SSH·로컬 절대 경로 지원" /></> : pending?.action === 'stash-save' ? <><TextField ref={firstField} label="보관 메시지" placeholder={`선택 · 비우면 WIP on ${repo.branch || 'HEAD'}`} value={message} disabled={!!running} onChange={e => setMessage(e.target.value)} /><Checkbox label="미추적 파일도 보관" checked={includeUntracked} disabled={!!running} onChange={e => setIncludeUntracked(e.target.checked)} /></> : <div className="bl-confirm"><p>이 Stash를 삭제합니다. 앱에서 되돌릴 수 없습니다.</p><p>{pending?.stashMessage}</p><pre>{pending?.stashRef}
{pending?.stashSha}</pre></div>}
        {formError && <Notice tone="error">{formError}</Notice>}
        <div className="bl-actions bl-dialog-actions"><Button disabled={!!running} onClick={() => dialog.current?.close()}>취소</Button>{running && ['fetch', 'pull', 'push'].includes(running.action) && <Button disabled={canceling} onClick={() => { setCanceling(true); api.cancel(running.id).catch(e => setFormError(e.message)) }}>{canceling ? '취소 요청됨' : '작업 취소'}</Button>}<Button type="submit" variant="primary" loading={!!running}>{labels[pending?.action || 'fetch']}</Button></div>
      </form>}
    </Dialog>
  </>
}
