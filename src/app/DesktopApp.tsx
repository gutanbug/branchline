import { dirtyFiles, keepFile, selectConflictFile } from './conflictEditor'
import { ToastMessage } from '../design-system'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ActionCard, ActionCardGrid, Brand, Button, DotPattern, Icon, IconButton, ContextMenu, Dialog, EmptyState, Notice, ResizeHandle, ScrollArea, ShortcutList, type ShortcutGroup } from '../design-system'
import { RepositorySidebar } from '../features/workspace/RepositorySidebar'
import { RepositoryWorkspace, type WorkspaceActions } from '../features/workspace/RepositoryWorkspace'
import { CloneDialog } from '../features/workspace/CloneDialog'
import { ProfileSettings } from '../features/settings/ProfileSettings'
import { AgentSettings } from '../features/agents/AgentSettings'
import { HostingWorkspace } from '../features/hosting/HostingWorkspace'
import { McpSettings } from '../features/hosting/McpSettings'
import type { WorkingEditor, AgentId, ConflictEditor, DesktopAPI, Repository, Tab } from './types'
import { headLabel } from './headLabel'
import './desktop.css'

const sidebarWidthKey = 'branchline:sidebar-width', defaultSidebarWidth = 270, minSidebarWidth = 200, maxSidebarWidth = 480
const emptyWorkingEditor: WorkingEditor = { open: false, visit: 0, snapshot: null, draft: '' }
function workingDirty(editor?: WorkingEditor) { return !!editor?.snapshot && editor.draft !== editor.snapshot.current.replaceAll('\r\n', '\n') }
const emptyEditor: ConflictEditor = { snapshot: null, draft: '', file: '' }
/** Never open a comparison of a branch with itself: main pairs with its upstream (or another branch). */
function comparePair(repo: Repository) {
  const current = repo.refs.find(r => r.ref === `refs/heads/${repo.branch}`)
  const base = repo.refs.find(r => r.ref === 'refs/heads/main') || repo.refs.find(r => r.ref === 'refs/heads/master')
  if (current && base && current.ref !== base.ref) return { a: current.ref, b: base.ref }
  const target = current || base
  const source = target && (repo.refs.find(r => r.ref === target.tracking?.ref) || repo.refs.find(r => r.ref.startsWith('refs/heads/') && r.ref !== target.ref) || repo.refs.find(r => r.ref.startsWith('refs/remotes/') && r.ref !== target.ref))
  return { a: source?.ref || '', b: target?.ref || '' }
}
function newTab(repo: Repository): Tab { return { path: repo.path, view: 'history', query: '', author: '', file: '', ref: '', after: '', before: '', commitMessage: '', ...comparePair(repo), mode: 'a', diffMode: 'endpoints' } }
const shortcutGroups: ShortcutGroup[] = [
  { title: '전체', items: [{ keys: ['⌘+/', 'Ctrl+/', '?'], label: '키보드 단축키 보기' }, { keys: ['Esc'], label: '대화상자·메뉴·선택 닫기' }, { keys: ['Shift+F10'], label: '선택 항목의 메뉴 열기' }, { keys: ['⌘+1…9', 'Ctrl+1…9'], label: '저장소 탭 이동 · 9는 마지막 탭' }, { keys: ['Ctrl+Tab', 'Ctrl+Shift+Tab'], label: '다음·이전 저장소 탭' }] },
  { title: '커밋 그래프', items: [{ keys: ['/'], label: '커밋 검색으로 이동' }, { keys: ['↑', '↓'], label: '이전·다음 커밋 선택' }, { keys: ['Home', 'End'], label: '처음·마지막 커밋' }, { keys: ['PageUp', 'PageDown'], label: '한 화면씩 이동' }] },
  { title: '내 변경 사항', items: [{ keys: ['⌘+Enter', 'Ctrl+Enter'], label: '커밋 메시지 입력 중 바로 커밋' }, { keys: ['⌘+S', 'Ctrl+S'], label: '파일 편집 저장' }] },
]

export function DesktopApp({ api = window.branchline }: { api?: DesktopAPI }) {
  const workspaces = useRef<Record<string, WorkspaceActions | null>>({})
  const [workingEditors, setWorkingEditors] = useState<Record<string, WorkingEditor>>({})
  const [editors, setEditors] = useState<Record<string, ConflictEditor>>({})
  const [closing, setClosing] = useState<string | null>(null)
  const closeDialog = useRef<HTMLDialogElement>(null)
  const dirtyPaths = [...new Set([...Object.keys(editors), ...Object.keys(workingEditors)])].filter(path => dirtyFiles(editors[path]).length > 0 || workingDirty(workingEditors[path]))
  const dirtyPathsRef = useRef(dirtyPaths)
  useEffect(() => { dirtyPathsRef.current = dirtyPaths }, [dirtyPaths])
  const conflictVisits = useRef<Record<string, string>>({})
  const [refreshError, setRefreshError] = useState('')
  const cloneDialog = useRef<HTMLDialogElement>(null)
  const shortcutDialog = useRef<HTMLDialogElement>(null)
  const savedTabs = useRef<Record<string, Tab>>({})
  const [working, setWorking] = useState<Record<string, boolean>>({})
  const mutating = Object.values(working).some(Boolean)
  const [tabs, setTabs] = useState<Tab[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [repos, setRepos] = useState<Record<string, Repository>>({})
  const [recent, setRecent] = useState<string[]>([])
  const [page, setPage] = useState<'workspace' | 'team' | 'agents' | 'integrations' | 'settings'>('workspace')
  const [ready, setReady] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => { try { return Number(localStorage.getItem(sidebarWidthKey)) || defaultSidebarWidth } catch { return defaultSidebarWidth } })
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  useEffect(() => { const resize = () => setViewportWidth(window.innerWidth); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize) }, [])
  const sidebarMax = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, Math.round(viewportWidth * .29)))
  const sidebarColumn = Math.max(minSidebarWidth, Math.min(sidebarMax, sidebarWidth))
  const resizeSidebar = (value: number) => { setSidebarWidth(value); try { localStorage.setItem(sidebarWidthKey, String(value)) } catch { /* The width still applies for this session. */ } }
  const [busy, setBusy] = useState(false)
  const [closeNotice, setCloseNotice] = useState('')
  const [error, setError] = useState('')
  const [defaultAgent, setDefaultAgent] = useState<AgentId>('codex')
  useEffect(() => {
    if (!api) return
    let live = true
    api.bootstrap().then(async state => {
      if (!live) return
      savedTabs.current = state.savedTabs || {};
      setPage(state.tabs.find(tab => tab.path === state.active)?.area === 'team' ? 'team' : 'workspace')
      setRecent(state.recent); setTabs(state.tabs.map(tab => ({ ...tab, view: 'history' }))); setActive(state.active); setDefaultAgent(state.defaultAgent)
      const results = await Promise.allSettled(state.tabs.map(t => api.state(t.path)))
      if (!live) return
      const map: Record<string, Repository> = {}
      results.forEach(r => { if (r.status === 'fulfilled') map[r.value.path] = r.value })
      setRepos(map); setReady(true)
      if (results.some(r => r.status === 'rejected')) setError('일부 저장소 경로를 열지 못했습니다. 해당 탭을 닫고 저장소를 다시 열어 주세요.')
    }).catch(e => { if (live) { setError(e.message); setReady(true) } })
    return () => { live = false }
  }, [api])
  useEffect(() => {
    if (!api || !ready) return
    let live = true
    api.saveWorkspace({ tabs, active }).catch(e => { if (live) setError(`보기 상태 저장 실패: ${e.message}`) })
    return () => { live = false }
  }, [api, ready, tabs, active])
  useEffect(() => {
    if (!api || !active || !ready || working[active]) return
    let live = true, reading = false
    // ponytail: poll only the active repository; replace with a Git/file watcher for large repositories.
    async function check() {
      if (reading || document.visibilityState === 'hidden') return
      reading = true
      try {
        const next = await api!.state(active!)
        if (live) { setRepos(current => current[next.path]?.token === next.token ? current : { ...current, [next.path]: { ...next, remoteCheck: current[next.path]?.remoteCheck } }); setRefreshError('') }
      } catch (e) { if (live) setRefreshError(`자동 갱신 실패: ${(e as Error).message}`) }
      finally { reading = false }
    }
    void check()
    const timer = window.setInterval(() => void check(), 5000)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => { live = false; clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check) }
  }, [api, active, ready, working])
  const monitoredPaths = JSON.stringify(tabs.map(tab => tab.path))
  useEffect(() => {
    if (!api?.monitorRemote || !ready || mutating) return
    let live = true
    const reading = new Set<string>()
    async function checkRemotes() {
      await Promise.allSettled((JSON.parse(monitoredPaths) as string[]).map(async path => {
        if (reading.has(path)) return
        reading.add(path)
        try {
          const remoteCheck = await api!.monitorRemote!(path)
          if (!live) return
          const next = await api!.state(path)
          if (live) setRepos(current => ({ ...current, [path]: { ...(current[path]?.token === next.token ? current[path] : next), remoteCheck } }))
        } catch {
          if (live) setRepos(current => current[path] ? { ...current, [path]: { ...current[path], remoteCheck: { attemptedAt: Date.now(), checkedAt: current[path].remoteCheck?.checkedAt || null, configured: true, error: '자동 확인 실패 · 저장소 경로와 Git 연결을 확인하세요.' } } } : current)
        } finally { reading.delete(path) }
      }))
    }
    void checkRemotes()
    const timer = window.setInterval(() => void checkRemotes(), 60000)
    return () => { live = false; clearInterval(timer) }
  }, [api, ready, monitoredPaths, mutating])
  useEffect(() => {
    for (const repo of Object.values(repos)) {
      if (!repo.files.some(file => file.conflict)) delete conflictVisits.current[repo.path]
    }
    const repo = active ? repos[active] : null
    const firstConflict = repo?.files.find(file => file.conflict)
    if (!repo || page !== 'workspace' || working[repo.path] || !firstConflict) return
    // A conflict episode is acknowledged once; file edits and navigation must not reopen it.
    const episode = JSON.stringify([repo.head, repo.branch, repo.operation])
    if (conflictVisits.current[repo.path] === episode) return
    conflictVisits.current[repo.path] = episode
    setEditors(current => {
      const editor = current[repo.path]
      return editor && !keepFile(editor) ? { ...current, [repo.path]: selectConflictFile(editor, firstConflict.path) } : current
    })
    setTabs(current => current.map(tab => tab.path === repo.path ? { ...tab, view: 'conflicts' } : tab))
  }, [repos, active, page, working])
  // Repository tab switching: ⌘/Ctrl+1…9 (9 = last) and Ctrl+Tab / Ctrl+Shift+Tab. Skipped while a modal is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented || tabs.length < 2 || document.querySelector('dialog[open]')) return
      const index = tabs.findIndex(tab => tab.path === active)
      let target = -1
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && /^[1-9]$/.test(event.key)) target = event.key === '9' ? tabs.length - 1 : Number(event.key) - 1
      else if (event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'Tab') target = (index + (event.shiftKey ? -1 : 1) + tabs.length) % tabs.length
      if (target < 0 || target >= tabs.length) return
      event.preventDefault()
      const path = tabs[target].path
      if (path !== active) { setActive(path); navigate(page === 'team' ? 'team' : 'workspace', path) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  useEffect(() => {
    const show = () => { if (!shortcutDialog.current?.open && !document.querySelector('dialog[open]')) shortcutDialog.current?.showModal() }
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) return
      const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable=true]')
      if ((event.metaKey || event.ctrlKey) && event.key === '/') { event.preventDefault(); show() }
      else if (event.key === '?' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); show() }
    }
    window.addEventListener('keydown', onKey)
    const off = api?.onShortcuts?.(show)
    return () => { window.removeEventListener('keydown', onKey); off?.() }
  }, [api])
  useEffect(() => api?.onCloseRequested?.(() => {
    if (dirtyPaths.length) { setClosing('quit'); closeDialog.current?.showModal() }
    else void api.closeWindow?.().catch(e => setError(e.message))
  }), [api, dirtyPaths])
  function navigate(area: 'team' | 'workspace', path = active) {
    setPage(area)
    if (path) setTabs(current => current.some(tab => tab.path === path && tab.area !== area) ? current.map(tab => tab.path === path ? { ...tab, area } : tab) : current)
  }
  function receive(repo: Repository) { setRepos(current => ({ ...current, [repo.path]: { ...repo, remoteCheck: current[repo.path]?.remoteCheck } })) }
  function opened(repo: Repository, replacePath?: string) {
    if (replacePath === repo.path) replacePath = undefined
    if (replacePath && dirtyPathsRef.current.includes(replacePath)) { setError('현재 탭의 편집을 저장하거나 새 탭에서 Worktree를 여세요.'); return }
    if (!replacePath && tabs.length >= 30 && !tabs.some(t => t.path === repo.path)) { setError('최대 30개의 탭을 열 수 있습니다.'); return }
    const previous = tabs.find(tab => tab.path === replacePath)
    if (previous) savedTabs.current[previous.path] = previous
    receive(repo); setError('')
    setTabs(current => {
      if (current.some(tab => tab.path === repo.path)) return current.filter(tab => tab.path !== replacePath)
      const next = { ...(savedTabs.current[repo.path] || newTab(repo)), view: 'history' as const, focusSha: undefined, stashSha: undefined }
      return current.some(tab => tab.path === replacePath) ? current.map(tab => tab.path === replacePath ? next : tab) : [...current, next]
    })
    setActive(repo.path); setRecent(current => [repo.path, ...current.filter(p => p !== repo.path)].slice(0, 20)); setPage((tabs.find(t => t.path === repo.path) || savedTabs.current[repo.path])?.area === 'team' ? 'team' : 'workspace')
  }

  async function open(kind: 'open' | 'init', path?: string, area?: 'team') {
    if (!api || busy) return
    if (tabs.length >= 30 && !tabs.some(t => t.path === path)) { setError('최대 30개의 탭을 열 수 있습니다. 사용하지 않는 탭을 닫아 주세요.'); return }
    setBusy(true); setError('')
    try { const repo = await (kind === 'init' ? api.init() : api.open(path)); if (repo) { opened(repo); if (area) navigate(area, repo.path) } } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function refresh() { if (!api || !active) return; setBusy(true); setError(''); try { receive(await api.state(active)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  function close(path: string, discard = false) { if (working[path]) return; if (!discard && (dirtyFiles(editors[path]).length > 0 || workingDirty(workingEditors[path]))) { setClosing(path); closeDialog.current?.showModal(); return } delete conflictVisits.current[path]; setWorkingEditors(current => { const next = { ...current }; delete next[path]; return next }); setEditors(current => { const next = { ...current }; delete next[path]; return next }); const tab = tabs.find(t => t.path === path); if (tab) savedTabs.current[path] = tab; setCloseNotice(tab?.commitMessage.trim() ? `${repos[path]?.name || path.split(/[\\/]/).at(-1)} 탭을 닫았습니다. 커밋 메시지 초안은 저장소를 다시 열면 복원됩니다.` : ''); const next = tabs.filter(t => t.path !== path); setTabs(next); if (active === path) { const last = next.at(-1); setActive(last?.path || null); setPage(last?.area === 'team' ? 'team' : 'workspace') } }
  const openRepos = tabs.flatMap(tab => repos[tab.path] ? [repos[tab.path]] : [])
  const repo = active ? repos[active] : null
  return <div className="bl-desktop">
    <header className="bl-desktop-header"><Brand /><div className="bl-actions"><IconButton icon="settings" label="앱 설정" aria-current={page === 'settings' ? 'page' : undefined} disabled={!api || !ready || mutating} onClick={() => setPage('settings')} /></div></header>
    {api && <CloneDialog api={api} dialogRef={cloneDialog} onOpen={opened} onBusy={setBusy} />}
    <div className="bl-project-tab-bar"><div className="bl-project-tabs" aria-label="열린 프로젝트">{tabs.map((tab, index) => <div className="bl-project-tab" key={tab.path} data-active={active === tab.path}><Button variant="ghost" title={tab.path} aria-pressed={active === tab.path} onClick={() => { setActive(tab.path); navigate(page === 'team' ? 'team' : 'workspace', tab.path) }}><span>{repos[tab.path]?.name || tab.path.split(/[\\/]/).at(-1)}</span><small>{repos[tab.path] ? headLabel(repos[tab.path]) : '경로 확인'}{repos[tab.path]?.files.length ? ' · 변경 있음' : ''}{tab.commitMessage ? ' · 초안' : ''}{dirtyFiles(editors[tab.path]).length > 0 ? ' · 충돌 편집 중' : ''}{workingDirty(workingEditors[tab.path]) ? ' · 파일 편집 중' : ''}</small></Button>{tabs.length > 1 && index > 0 && <Button variant="ghost" className="bl-project-tab-move" aria-label={`${tab.path.split(/[\\/]/).at(-1)} 탭 왼쪽 이동`} onClick={() => setTabs(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next })}>‹</Button>}<Button variant="ghost" aria-label={`${tab.path.split(/[\\/]/).at(-1)} 탭 닫기`} disabled={working[tab.path]} onClick={() => close(tab.path)}>×</Button></div>)}</div><ContextMenu menuOnly label="저장소 추가" disabled={!api || busy || !ready} groups={[[
      { label: '저장소 열기', onClick: () => void open('open') },
      { label: '새 저장소', onClick: () => void open('init') },
      { label: '저장소 복제', disabled: tabs.length >= 30, hint: tabs.length >= 30 ? '열린 탭을 닫은 뒤 복제하세요.' : undefined, onClick: () => cloneDialog.current?.showModal() },
    ]]}><IconButton icon="plus" label="저장소 추가" tooltip={false} /></ContextMenu></div>
    <div className="bl-desktop-shell" style={{ '--sidebar-width': `${sidebarColumn}px` } as CSSProperties}><aside className="bl-desktop-sidebar"><nav aria-label="작업 공간"><Button variant="ghost" aria-current={page === 'workspace' ? 'page' : undefined} onClick={() => navigate('workspace')} title={`열린 저장소 ${tabs.length}개`} aria-description={`열린 저장소 ${tabs.length}개`}>내 작업</Button><Button variant="ghost" aria-current={page === 'team' ? 'page' : undefined} disabled={mutating} onClick={() => navigate('team')}>프로젝트 현황</Button><Button variant="ghost" aria-current={page === 'agents' ? 'page' : undefined} disabled={mutating} onClick={() => setPage('agents')}>AI Agents</Button><Button variant="ghost" aria-current={page === 'integrations' ? 'page' : undefined} disabled={mutating} onClick={() => setPage('integrations')}>외부 도구 연결</Button></nav><ScrollArea className="bl-sidebar-scroll">{page === 'workspace' && api && repo && tabs.find(tab => tab.path === repo.path) && <RepositorySidebar openPaths={tabs.map(tab => tab.path)} onWorktreeAction={(action, worktree) => workspaces.current[repo.path]?.worktreeAction(action, worktree)} onStashAction={(action, stash) => workspaces.current[repo.path]?.stashAction(action, stash)} onBranchAction={(action, branch) => workspaces.current[repo.path]?.branchAction(action, branch)} key={repo.path} api={api} repo={repo} tab={tabs.find(tab => tab.path === repo.path)!} disabled={busy || mutating} onView={patch => { navigate('workspace'); setTabs(current => current.map(tab => tab.path === repo.path ? { ...tab, ...patch } : tab)) }} onOpen={opened} onBusy={value => setWorking(current => ({ ...current, [repo.path]: value }))} />}{repo && <div className="bl-sidebar-context"><Button disabled={busy || mutating} onClick={() => { navigate('workspace'); setTabs(current => current.map(tab => tab.path === repo.path ? { ...tab, view: 'history' } : tab)); setWorkingEditors(current => ({ ...current, [repo.path]: { ...(current[repo.path] || emptyWorkingEditor), open: true, visit: Date.now() } })) }}>폴더에서 보기</Button></div>}</ScrollArea>{repo && <div className="bl-sidebar-refresh"><small title={repo.path}>{repo.name}</small><IconButton icon="refresh" label="상태 새로고침" disabled={!api || busy || mutating} onClick={() => void refresh()} /></div>}</aside>{viewportWidth > 650 && <ResizeHandle label="왼쪽 메뉴 너비" value={sidebarColumn} min={minSidebarWidth} max={sidebarMax} onChange={resizeSidebar} style={{ left: sidebarColumn - 6 }} />}
      <main className="bl-desktop-main" tabIndex={0} aria-label="작업 내용">
        <ToastMessage scope="작업 공간" tone="error" message={refreshError} /><ToastMessage scope="작업 공간" tone="error" message={error} /><ToastMessage scope="작업 공간" tone="info" message={closeNotice} />
        {!api ? <div className="bl-welcome"><span className="bl-kicker">BRANCHLINE DESKTOP</span><h1>내 저장소에 집중하는<br />작업 공간.</h1><p>로컬 변경을 검토하고, 브랜치를 비교하고,<br />여러 프로젝트의 맥락을 함께 유지하세요.</p><Notice>로컬 Git 기능은 Electron 앱에서 사용할 수 있습니다.</Notice><p><code>pnpm desktop</code>으로 데스크톱 앱을 실행하세요.</p><a className="btn btn-secondary" href="?demo=1">디자인 시스템 예제 보기</a></div>
          : !ready ? <Notice>작업 공간을 복원하고 있습니다…</Notice>
            : page === 'agents' ? <AgentSettings api={api} defaultAgent={defaultAgent} onDefault={setDefaultAgent} />
              : page === 'integrations' ? <McpSettings api={api} repos={openRepos} />
              : (page === 'team' || page === 'settings') ? null
                : !tabs.length ? <div className="bl-welcome"><div className="bl-welcome-hero"><DotPattern /><span className="bl-welcome-mark"><Icon name="branch" /></span><h1>저장소에서 작업 시작</h1><p>이 컴퓨터의 Git 저장소를 열거나 원격 저장소를 복제하세요.</p></div><ActionCardGrid label="시작 방법"><ActionCard primary icon="folderOpen" title="저장소 열기" description="이 컴퓨터에 있는 Git 저장소 폴더를 엽니다." disabled={busy} onClick={() => void open('open')} /><ActionCard icon="download" title="저장소 복제" description="GitHub·GitLab 등 원격 주소에서 내려받습니다." disabled={busy} onClick={() => cloneDialog.current?.showModal()} /><ActionCard icon="plus" title="새 저장소 만들기" description="빈 폴더에 새 Git 저장소를 시작합니다." disabled={busy} onClick={() => void open('init')} /></ActionCardGrid>{recent.length > 0 && <div className="bl-recent"><h2>최근 프로젝트</h2>{recent.map(p => <Button variant="ghost" key={p} disabled={busy} onClick={() => void open('open', p)}><Icon name="folder" /><strong>{p.split(/[\\/]/).at(-1)}</strong><code title={p}>{p.split(/[\\/]/).filter(Boolean).length > 4 ? `…/${p.split(/[\\/]/).filter(Boolean).slice(-3, -1).join('/')}` : p}</code><Icon name="external" /></Button>)}</div>}</div>
                  : null}
        {api && ready && tabs.map(tab => repos[tab.path] ? <RepositoryWorkspace openPaths={tabs.map(tab => tab.path)} workingEditor={workingEditors[tab.path] || emptyWorkingEditor} onWorkingEditor={editor => setWorkingEditors(current => ({ ...current, [tab.path]: editor }))} ref={handle => { workspaces.current[tab.path] = handle }} editor={editors[tab.path] || emptyEditor} onEditor={editor => setEditors(current => ({ ...current, [tab.path]: editor }))} key={tab.path} api={api} repo={repos[tab.path]} tab={tab} active={page === 'workspace' && active === tab.path} onTab={patch => setTabs(current => current.map(t => t.path === tab.path ? { ...t, ...patch } : t))} onRepo={receive} onOpen={opened} onBusy={value => setWorking(current => ({ ...current, [tab.path]: value }))} /> : page === 'workspace' && active === tab.path ? <EmptyState key={tab.path} title="저장소를 다시 열어 주세요">경로가 이동되었거나 접근할 수 없습니다. 탭을 닫고 저장소 열기를 선택하세요.</EmptyState> : null)}
        {api && ready && <div hidden={page !== 'settings'}><ProfileSettings api={api} repos={openRepos} activePath={active} onRepo={receive} onBusy={(path, value) => setWorking(current => ({ ...current, [path]: value }))} /></div>}
        {api && ready && <div hidden={page !== 'team'}><HostingWorkspace persist onOpenRepository={() => void open('open', undefined, 'team')} busy={busy} api={api} repos={openRepos} activePath={active} active={page === 'team'} /></div>}
      </main></div><footer className="bl-desktop-footer"><span>{busy || mutating ? '작업 중…' : api ? '로컬 Git 연결' : '브라우저 미리보기'}</span><span>{repo?.head ? `${page === 'workspace' ? 'HEAD' : '로컬 HEAD'} ${repo.head.slice(0, 8)}` : 'Branchline'}</span><span>{repo ? `확인 ${new Date(repo.checkedAt).toLocaleTimeString('ko-KR')}` : '개인 작업 · 여러 프로젝트'}</span></footer>
    <Dialog dialogRef={shortcutDialog} title="키보드 단축키"><ShortcutList groups={shortcutGroups} /><div className="bl-actions bl-dialog-actions"><Button onClick={() => shortcutDialog.current?.close()}>닫기</Button></div></Dialog>
    <Dialog dialogRef={closeDialog} title={dirtyPaths.some(path => workingDirty(workingEditors[path])) ? "저장하지 않은 파일 편집" : "저장하지 않은 충돌 편집"} busy={mutating} onClose={() => setClosing(null)}>
      <p>{closing === 'quit' ? '앱을 종료하면 아래 저장소의 편집이 사라집니다.' : '탭을 닫으면 이 저장소의 편집이 사라집니다.'} 원본 파일과 Git 이력은 변경하지 않습니다.</p>
      <ul>{(closing === 'quit' ? dirtyPaths : closing ? [closing] : []).map(path => <li key={path}>{repos[path]?.name} / {[...dirtyFiles(editors[path]), workingDirty(workingEditors[path]) && workingEditors[path]?.snapshot?.file].filter(Boolean).join(', ')}</li>)}</ul>
      <div className="bl-actions bl-dialog-actions"><Button onClick={() => closeDialog.current?.close()}>계속 편집</Button><Button variant="primary" disabled={mutating} onClick={() => { if (closing === 'quit') void api?.closeWindow?.().catch(e => setError(e.message)); else if (closing) close(closing, true); closeDialog.current?.close() }}>편집 버리고 {closing === 'quit' ? '종료' : '탭 닫기'}</Button></div>
    </Dialog>
  </div>
}
