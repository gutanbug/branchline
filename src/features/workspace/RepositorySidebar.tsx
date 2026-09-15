import { useEffect, useRef, useState } from 'react'
import { BranchTree, Button, Notice, TextField } from '../../design-system'
import { BranchMenu, type BranchAction, type Branch } from './BranchMenu'
import type { BranchGroup } from '../../design-system/Workspace'
import type { DesktopAPI, Repository, Tab, Worktree, SyncSnapshot } from '../../app/types'

export function RepositorySidebar({ api, repo, tab, disabled, onView, onOpen, onBusy, onBranchAction }: { api: DesktopAPI; repo: Repository; tab: Tab; disabled: boolean; onView: (patch: Partial<Tab>) => void; onOpen: (repo: Repository) => void; onBusy: (busy: boolean) => void; onBranchAction: (action: BranchAction, branch: Branch) => void }) {
  const [query, setQuery] = useState('')
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ key: string; items: Worktree[]; error: string } | null>(null)
  const [stashResult, setStashResult] = useState<{ key: string; value?: SyncSnapshot; error?: string } | null>(null)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)
  const search = useRef<HTMLInputElement>(null)
  const key = JSON.stringify([repo.path, repo.token, repo.checkedAt, retry])
  useEffect(() => {
    let live = true
    api.worktrees(repo.path).then(items => { if (live) setResult({ key, items, error: '' }) }).catch(e => { if (live) setResult({ key, items: [], error: e.message }) })
    api.syncState(repo.path, 0).then(value => { if (live) setStashResult({ key, value }) }).catch(e => { if (live) setStashResult({ key, error: e.message }) })
    return () => { live = false }
  }, [api, repo.path, key])
  const current = result?.key === key ? result : null
  const stashState = stashResult?.key === key ? stashResult : null
  const matches = (value: string) => value.toLocaleLowerCase('ko-KR').includes(query.toLocaleLowerCase('ko-KR'))
  const locals = repo.refs.filter(ref => ref.ref.startsWith('refs/heads/'))
  const remotes = [...new Set(['origin', ...repo.refs.filter(ref => ref.ref.startsWith('refs/remotes/')).map(ref => ref.ref.slice(13).split('/')[0])])]
  const groups: BranchGroup[] = [
    { id: 'local', label: 'LOCAL', empty: query ? '일치하는 로컬 브랜치가 없습니다.' : '첫 커밋 후 브랜치가 나타납니다.', items: locals.filter(ref => matches(ref.name)).map(ref => ({ id: ref.ref, label: ref.ref.slice(11), tracking: ref.tracking, current: ref.ref === `refs/heads/${repo.branch}` })) },
    ...remotes.map(remote => ({ id: `remote:${remote}`, label: remote.toUpperCase(), empty: query ? '일치하는 원격 브랜치가 없습니다.' : '원격 추적 브랜치가 없습니다. 상단 Fetch로 원격 이력을 가져오세요.', items: repo.refs.filter(ref => ref.ref.startsWith(`refs/remotes/${remote}/`) && matches(ref.name)).map(ref => ({ id: ref.ref, label: ref.ref.slice(14 + remote.length) })) })),
    { id: 'stashes', label: 'STASH', kind: 'stash', action: { label: 'Stash 보관함 열기', selected: tab.view === 'stashes' && !tab.stashSha, onClick: () => onView({ view: 'stashes', stashSha: '' }) }, empty: !stashState ? 'Stash를 불러오는 중…' : stashState.error ? 'Stash 조회에 실패했습니다.' : query ? '일치하는 Stash가 없습니다.' : '보관한 변경이 없습니다.', items: (stashState?.value?.stashes || []).filter(item => matches(`${item.ref} ${item.message}`)).map(item => ({ id: `stash:${item.sha}`, label: item.message, description: `${item.ref} · ${new Date(item.date).toLocaleDateString('ko-KR')}` })) },
    { id: 'worktrees', label: 'WORKTREES', kind: 'worktree', action: { label: 'Worktree 관리', selected: tab.view === 'worktrees', onClick: () => onView({ view: 'worktrees' }) }, empty: !current ? 'Worktree를 불러오는 중…' : current.error ? 'Worktree 조회에 실패했습니다.' : query ? '일치하는 worktree가 없습니다.' : 'Worktree가 없습니다.', items: (current?.items || []).filter(item => matches(`${item.branch || ''} ${item.path}`)).map(item => ({ id: item.path, label: item.branch || `detached ${item.head.slice(0, 8)}`, description: `${item.locked ? '잠김 · ' : ''}${item.prunable ? '경로 확인 필요 · ' : ''}${item.path}`, current: item.path === repo.path, disabled: item.prunable })) },
  ]
  async function select(value: string | null) {
    if (disabled || opening) return
    if (value?.startsWith('stash:')) { onView({ view: 'history', stashSha: value.slice(6), stashVisit: Date.now(), focusRef: '', focusSha: '', stashLabel: stashState?.value?.stashes.find(stash => stash.sha === value.slice(6))?.message, ref: '', query: '', author: '', file: '', after: '', before: '' }); return }
    if (!value || value.startsWith('refs/')) { const branch = repo.refs.find(ref => ref.ref === value); if (branch) onBranchAction('locate', branch); else onView({ view: 'history', stashSha: '', focusRef: '', focusSha: '', ref: '', query: '', author: '', file: '', after: '', before: '' }); return }
    setOpening(true); onBusy(true); setError('')
    try { onOpen(await api.openWorktree(repo.path, value)) } catch (e) { setError((e as Error).message) }
    finally { setOpening(false); onBusy(false) }
  }
  return <section className="bl-repository-sidebar" aria-label="현재 저장소 탐색">
    <div className="bl-sidebar-repo"><strong>{repo.name}</strong><small title={repo.path}>{repo.path}</small><small className="bl-remote-check" title={repo.remoteCheck?.error || 'Git 인증으로 1분마다 원격 이력을 가져옵니다. ↓ 받을 커밋 · ↑ 보낼 커밋, 각 브랜치의 upstream 기준'}>{repo.remoteCheck?.error || (repo.remoteCheck?.configured === false ? '자동 Fetch · 원격 미설정' : `자동 Fetch · ${repo.remoteCheck?.checkedAt ? new Date(repo.remoteCheck.checkedAt).toLocaleTimeString('ko-KR') : '확인 대기'} · 1분 간격`)}</small></div>
    <div className="bl-search-control"><TextField ref={search} label="브랜치·Stash·Worktree 찾기" value={query} onChange={event => setQuery(event.target.value)} />{query && <Button aria-label="브랜치 검색 지우기" onClick={() => { setQuery(''); search.current?.focus() }}>×</Button>}</div>
    <BranchTree revealAll={!!query} key={JSON.stringify([repo.path, query])} groups={groups} value={tab.view === 'history' && tab.stashSha ? `stash:${tab.stashSha}` : tab.view === 'history' ? tab.focusRef || tab.ref || null : '__other_view__'} renderBranch={(id, button) => { const branch = repo.refs.find(ref => ref.ref === id)!; return <BranchMenu branch={branch} repo={repo} solo={tab.ref} disabled={disabled || opening} onAction={onBranchAction} showButton>{button}</BranchMenu> }} onChange={value => void select(value)} disabled={disabled || opening} />
    {current?.error && <><Notice tone="error">{current.error}</Notice><Button disabled={opening} onClick={() => setRetry(value => value + 1)}>Worktree 다시 시도</Button></>}
    {stashState?.error && <><Notice tone="error">{stashState.error}</Notice><Button disabled={opening} onClick={() => setRetry(value => value + 1)}>Stash 다시 시도</Button></>}
    {stashState?.value?.hasMore && <p className="bl-muted">최근 100개 Stash · 나머지는 보관함에서 확인하세요.</p>}
    {error && <Notice tone="error">{error}</Notice>}
    <div className="bl-sidebar-tools"><Button disabled={disabled || opening} onClick={() => onView({ view: 'sync' })}>원격 설정 열기</Button></div>
  </section>
}
