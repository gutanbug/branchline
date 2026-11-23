import { edited } from '../../app/conflictEditor'
import { branchNameError } from './branchName'
import { useNavigationBookmark } from '../../app/useNavigationBookmark'
import { ToastMessage } from '../../design-system'
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactElement, type Ref } from 'react'
import { Badge, Button, FilterBar, Icon, IconButton, ChangeFileList, ContextMenu, CodeDiff, InspectorPanel, ScrollArea, Dialog, EmptyState, Notice, SelectField, TextArea, TextField } from '../../design-system'
import { FileActions, FileMenuRow, type FileActionsHandle } from './FileActions'
import { type FileMenuAction } from './fileMenuGroups'
import { BranchMenu, type BranchAction, type Branch } from './BranchMenu'
import { ComparisonWorkspace } from './ComparisonWorkspace'
import { HistoryGraph } from './HistoryGraph'
import { AmendCommit } from './AmendCommit'
import { WorkingFiles, type WorkingFilesActions } from './WorkingFiles'
import { CommitReview } from './CommitReview'
import { ConflictWorkspace } from './ConflictWorkspace'
import { WorktreeMenu, type WorktreeAction } from './WorktreeMenu'
import type { StashAction, Stash } from './StashMenu'
import { RemoteWorkspace, type RemoteActions } from './RemoteWorkspace'
import type { ChangeStats, Commit, WorkingEditor, ConflictEditor, DesktopAPI, GitFile, Mutation, Repository, Tab, Worktree } from '../../app/types'
import { operationLabel } from './operation'
import { compactPath } from '../../app/paths'

const emptyGraph = { selected: '', sha: '', index: 0, offset: 0, left: 0 }
const viewNames = { history: '커밋 그래프', changes: '내 변경 사항', compare: '브랜치 비교', worktrees: 'Worktree', sync: '원격 설정', stashes: 'Stash 보관함', conflicts: '충돌 해결' }
export type WorkspaceActions = { worktreeAction: (action: WorktreeAction, worktree: Worktree) => void; stashAction: (action: StashAction, stash: Stash) => void; branchAction: (action: BranchAction, branch: Branch) => void }
const refName = (ref?: string) => ref?.replace(/^refs\/(heads|remotes)\//, '') || ''
const shortRef = (ref?: string) => ref?.replace(/^refs\/(heads|remotes)\//, '') || ''
/** A success toast names what changed so users do not have to inspect the graph to confirm it. */
function doneMessage(input: Partial<Mutation>, next: Repository) {
  const head = next.head?.slice(0, 8) || ''
  switch (input.action) {
    case 'commit': return `${next.branch || 'HEAD'}에 커밋했습니다 · ${head}`
    case 'amend': return `최근 커밋을 수정했습니다 · 새 SHA ${head}`
    case 'branch': return `${input.name} 브랜치를 만들었습니다.`
    case 'branch-switch': return `${input.name} 브랜치를 만들고 전환했습니다.`
    case 'branch-rename': return `${shortRef(input.ref)} 브랜치 이름을 ${input.name}(으)로 바꿨습니다.`
    case 'branch-delete': return `${shortRef(input.ref)} 브랜치를 삭제했습니다.`
    case 'merge': return `${shortRef(input.ref)}을(를) ${next.branch || 'HEAD'}에 Merge했습니다.`
    case 'rebase': return `${next.branch || 'HEAD'}을(를) ${shortRef(input.ref)} 위로 Rebase했습니다.`
    case 'cherry-pick': return `커밋을 ${next.branch || 'HEAD'}에 Cherry-pick했습니다 · ${head}`
    case 'abort': return '진행 중이던 Git 작업을 중단하고 이전 상태로 되돌렸습니다.'
    case 'skip': return '현재 커밋을 건너뛰었습니다.'
    case 'stage': case 'stage-all': return '변경을 스테이징했습니다.'
    case 'unstage': case 'unstage-all': return '스테이징을 해제했습니다.'
    case 'stage-hunk': return '선택한 구간을 스테이징했습니다.'
    case 'unstage-hunk': return '선택한 구간의 스테이징을 해제했습니다.'
    case 'identity': return '작성자 정보를 저장했습니다.'
    case 'worktree-add': return `Worktree를 만들었습니다 · ${input.target || ''}`
    case 'worktree-remove': case 'worktree-remove-branch': return 'Worktree를 삭제했습니다.'
    case 'worktree-lock': return 'Worktree를 잠갔습니다.'
    case 'worktree-unlock': return 'Worktree 잠금을 해제했습니다.'
    default: return '작업을 완료했습니다.'
  }
}

export function RepositoryWorkspace({ ref, api, repo, tab, active, openPaths, onTab, onRepo, onOpen, onBusy, editor, onEditor, workingEditor, onWorkingEditor }: { openPaths: string[]; workingEditor: WorkingEditor; onWorkingEditor: (editor: WorkingEditor) => void; ref?: Ref<WorkspaceActions>; editor: ConflictEditor; onEditor: (editor: ConflictEditor) => void; api: DesktopAPI; repo: Repository; tab: Tab; active: boolean; onTab: (patch: Partial<Tab>) => void; onRepo: (repo: Repository) => void; onOpen: (repo: Repository, replacePath?: string) => void; onBusy: (value: boolean) => void }) {
  const scope = JSON.stringify([tab.view, tab.ref, tab.query, tab.author, tab.file, tab.after, tab.before, tab.a, tab.b, tab.mode, tab.diffMode])
  const [selection, setSelection] = useState<{ scope: string; value: { sha?: string; file?: string; staged?: boolean } | null } | null>(null)
  const historyScope = JSON.stringify([tab.ref, tab.query, tab.author, tab.file, tab.after, tab.before])
  const bookmark = useNavigationBookmark('graph:' + repo.path, historyScope, emptyGraph)
  const [pickedCommit, setPickedCommit] = useState<{ scope: string; sha: string } | null>(() => bookmark.value.selected ? { scope: historyScope, sha: bookmark.value.selected } : null)
  const historySha = tab.stashSha || tab.focusSha || (pickedCommit?.scope === historyScope ? pickedCommit.sha : undefined)
  if (pickedCommit && (pickedCommit.scope !== historyScope || tab.stashSha || tab.focusSha)) setPickedCommit(null)
  useEffect(() => { if (tab.focusSha) bookmark.update({ selected: tab.focusSha }) }, [bookmark, tab.focusSha])
  const historySelection = useMemo(() => historySha ? { sha: historySha } : null, [historySha])
  const stashSelection = tab.stashSha ? historySelection : null
  const selected: { sha?: string; file?: string; staged?: boolean } | null = tab.view === 'history' ? historySelection : selection?.scope === scope ? selection.value : null
  if (selection && selection.scope !== scope) setSelection(null)
  function setSelected(value: { sha?: string; file?: string; staged?: boolean } | null) {
    if (tab.view !== 'history') { setSelection({ scope, value }); return }
    if (tab.focusSha || tab.stashSha) onTab({ focusSha: '', stashSha: '', stashLabel: '' })
    bookmark.update({ selected: value?.sha || '' })
    setPickedCommit(value?.sha ? { scope: historyScope, sha: value.sha } : null)
  }
  const showHistory = active && tab.view === 'history'
  const [visitedHistory, setVisitedHistory] = useState(false)
  if (showHistory && !visitedHistory) setVisitedHistory(true)
  const workspaceElement = useRef<HTMLElement>(null), focusAfterHunk = useRef<string | null>(null)
  const [details, setDetails] = useState<{ key: string; value: string; error: string; token: string } | null>(null)
  const [stats, setStats] = useState<{ key: string; value?: ChangeStats; error?: string } | null>(null)
  const [statsRetry, setStatsRetry] = useState(0)
  const statsKey = `${repo.path}/${repo.token}/${statsRetry}`
  useEffect(() => {
    if (!active || tab.view !== 'changes') return
    let live = true
    api.changeStats(repo.path, repo.token).then(value => { if (live) setStats({ key: statsKey, value }) }).catch(e => { if (live) setStats({ key: statsKey, error: e.message }) })
    return () => { live = false }
  }, [api, active, tab.view, repo.path, repo.token, statsKey])
  const [data, setData] = useState<{ key: string; value: Worktree[]; error: string } | null>(null)
  const [page, setPage] = useState({ scope, offset: 0 })
  const offset = page.scope === scope ? page.offset : 0
  if (page.scope !== scope) setPage({ scope, offset: 0 })
  function setOffset(offset: number) { setPage({ scope, offset }) }
  const [amendSha, setAmendSha] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [reviewCommit, setReviewCommit] = useState<{ branch: string | null; sha: string | null } | null>(null)
  const canPrepareReview = !!repo.branch && !!repo.head && reviewCommit?.branch === repo.branch && reviewCommit.sha === repo.head
  const hasRemote = !!repo.remoteNames?.length
  const [notice, setNotice] = useState('')
  const [conflictNotice, setConflictNotice] = useState('')
  const [noticeScope, setNoticeScope] = useState(scope)
  if (noticeScope !== scope) { setNoticeScope(scope); setNotice('') }
  const [error, setError] = useState('')
  const [dialogKind, setDialogKind] = useState<'branch' | 'worktree' | 'confirm' | 'rename' | 'tracking' | 'choose-tracking'>('branch')
  const [pending, setPending] = useState<Partial<Mutation>>({})
  const [name, setName] = useState('')
  const [commitPushHost, setCommitPushHost] = useState<HTMLDivElement | null>(null)
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null)
  const remoteActions = useRef<RemoteActions>(null)
  const fileActions = useRef<FileActionsHandle>(null)
  const workingActions = useRef<WorkingFilesActions>(null)
  const [target, setTarget] = useState('')
  const [worktreeMode, setWorktreeMode] = useState<'new' | 'existing' | 'detached'>('new')
  const [worktreeRef, setWorktreeRef] = useState('')
  const [formError, setFormError] = useState('')
  const nameError = branchNameError(name.trim())
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (active && tab.view === 'conflicts') heading.current?.focus() }, [active, tab.view])
  // In the single-column layout the diff sits under the file list; bring it into view so a file click visibly responds.
  const selectedFile = tab.view === 'changes' && selected?.file ? `${selected.staged ? 's' : 'w'}:${selected.file}` : ''
  useEffect(() => {
    if (!active || !selectedFile || !matchMedia('(max-width:1050px)').matches) return
    const inspector = heading.current?.closest('.bl-repository')?.querySelector<HTMLElement>('.bl-work-columns > .bl-inspector')
    const box = inspector?.getBoundingClientRect()
    if (inspector && box && (box.top > innerHeight - 80 || box.bottom < 0)) inspector.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [active, selectedFile])
  const modal = useRef<HTMLDialogElement>(null)
  const nameField = useRef<HTMLInputElement>(null)
  const searchField = useRef<HTMLInputElement>(null)
  const [composing, setComposing] = useState(false)
  const request = JSON.stringify({ view: tab.view, query: tab.query, author: tab.author, ref: tab.ref, file: tab.file, after: tab.after, before: tab.before, a: tab.a, b: tab.b, mode: tab.mode, diffMode: tab.diffMode, offset, token: repo.token, checkedAt: repo.checkedAt })
  useEffect(() => {
    if (!active || composing || ['history', 'compare', 'changes', 'sync', 'stashes', 'conflicts'].includes(tab.view)) return
    let live = true
    const timer = setTimeout(async () => {
      try {
      const input = JSON.parse(request)
      let task: Promise<Worktree[]>
      if (input.view === 'worktrees') task = api.worktrees(repo.path)
      else return
      const value = await task; if (live) setData({ key: request, value, error: '' })
      } catch (e) { if (live) setData({ key: request, value: [], error: (e as Error).message }) }
    }, 300)
    return () => { live = false; clearTimeout(timer) }
  }, [api, active, composing, repo.path, request, tab.view])
  const viewingStash = tab.view === 'history' && !!stashSelection
  const detailKey = JSON.stringify(selected?.sha ? { sha: selected.sha, stash: !!stashSelection, visit: stashSelection ? tab.stashVisit : undefined } : { ...selected, token: repo.token, checkedAt: repo.checkedAt })
  useEffect(() => {
    if (!selected || !active) return
    let live = true
    const task = viewingStash && stashSelection ? api.stashDiff(repo.path, stashSelection.sha) : api.diff(repo.path, selected)
    task.then(value => { if (live) setDetails({ key: detailKey, value, error: '', token: repo.token }) }).catch(e => { if (live) setDetails({ key: detailKey, value: '', error: e.message, token: repo.token }) })
    return () => { live = false }
  }, [api, repo.path, repo.token, selected, active, detailKey, stashSelection, viewingStash])
  useEffect(() => {
    if (!focusAfterHunk.current || !active || busy || (selected && details?.key !== detailKey)) return
    const buttons = [...(workspaceElement.current?.querySelectorAll<HTMLButtonElement>('.bl-change-file') || [])]
    const matches = buttons.filter(button => button.title === focusAfterHunk.current)
    ;(matches.find(button => button.getAttribute('aria-pressed') === 'true') || matches[0] || buttons[0])?.focus()
    focusAfterHunk.current = null
  }, [active, busy, selected, details, detailKey])
  function revealHead() {
    if (!repo.head) return
    const branchRef = repo.branch ? `refs/heads/${repo.branch}` : ''
    const inGraph = workspaceElement.current?.querySelector('.bl-commit-graph[data-has-head=true]')
    const scope = inGraph ? {} : { ref: branchRef || 'HEAD', query: '', author: '', file: '', after: '', before: '' }
    onTab({ ...scope, focusRef: branchRef, focusSha: repo.head, focusVisit: (tab.focusVisit || 0) + 1, stashSha: '', stashLabel: '' })
  }
  function change(patch: Partial<Tab>) { onTab(patch); setSelected(null); setOffset(0) }
  async function mutate(input: Partial<Mutation>) {
    if (inFlight.current) return false
    if (input.action?.startsWith('worktree-remove') && openPaths.includes(input.target || '')) { setFormError('열려 있는 Worktree 탭을 먼저 닫으세요.'); return false }
    inFlight.current = true
    if (['stage-hunk', 'unstage-hunk'].includes(input.action || '')) focusAfterHunk.current = input.file || null
    setBusy(true); onBusy(true); setNotice(''); setError(''); setFormError(''); setConflictNotice('')
    try { const next = await api.mutate(repo.path, { ...input, action: input.action!, expected: input.expected || repo.token }); onRepo(next); if (!['stage-hunk', 'unstage-hunk'].includes(input.action || '') || !next.files.some(file => file.path === selected?.file && (selected.staged ? file.index : file.working) === 'M')) setSelected(null); if (input.action === 'branch-rename' || input.action === 'branch-delete') onTab({ ref: tab.ref === input.ref ? input.action === 'branch-rename' ? `refs/heads/${input.name}` : '' : tab.ref, focusRef: '', focusSha: '' }); setNotice(['switch', 'switch-remote'].includes(input.action || '') ? repo.files.length ? '작업 변경을 유지하며 브랜치를 전환했습니다.' : '브랜치를 전환했습니다.' : input.action === 'continue' ? next.operation ? `${next.operation} 작업이 계속 진행 중입니다. 남은 단계를 확인하세요.` : 'Git 작업을 완료했습니다.' : doneMessage(input, next)); if (input.action === 'commit') {
        onTab({ commitMessage: '' })
        setReviewCommit({ branch: next.branch, sha: next.head })
      }
      if (input.action === 'branch-switch' && next.branch) {
        onTab({ a: `refs/heads/${next.branch}`, b: input.ref || (repo.branch && input.base === repo.head ? `refs/heads/${repo.branch}` : ''), ref: '', focusRef: '', focusSha: '' })
        setNotice(`${next.branch} 브랜치를 만들고 체크아웃했습니다.`)
      }
      if (input.action === 'abort' || input.action === 'skip') { onEditor({ snapshot: null, draft: '', file: '' }); onTab({ view: 'history' }) } modal.current?.close(); return true }
    catch (e) { const message = (e as Error).message; setError(message); if (input.action?.startsWith('worktree-') || ['stage-hunk', 'unstage-hunk', 'continue', 'merge', 'rebase', 'abort', 'cherry-pick', 'skip', 'switch', 'switch-remote', 'branch-switch'].includes(input.action || '')) { try { const next = await api.state(repo.path); onRepo(next); if (['switch', 'switch-remote'].includes(input.action || '')) modal.current?.close(); if (next.files.some(file => file.conflict)) { modal.current?.close(); onTab({ view: 'conflicts' }); if (['merge', 'rebase', 'cherry-pick', 'continue'].includes(input.action || '')) { setError(''); setConflictNotice(`${next.operation || input.action} 중 충돌 ${next.files.filter(file => file.conflict).length}개가 발생했습니다. 충돌 해결 화면에서 파일을 정리한 뒤 계속하거나 작업을 중단하세요.`) } } } catch { /* Preserve the operation error; manual refresh remains available. */ } } return false }
    finally { inFlight.current = false; setBusy(false); onBusy(false) }
  }
  // A new worktree started from an unchanged remote-tracking branch tracks it.
  const worktreeUpstream = dialogKind === 'worktree' && worktreeMode === 'new' && pending.ref?.startsWith('refs/remotes/') && repo.refs.find(item => item.ref === pending.ref)?.sha === pending.base ? pending.ref : ''
  function dialog(kind: typeof dialogKind, command: Partial<Mutation> = {}) { if (kind === 'confirm' && ['switch', 'commit', 'continue'].includes(command.action || '')) { void mutate(command); return } setDialogKind(kind); setPending({ ...command, expected: repo.token }); setName(''); setTarget(''); setWorktreeMode('new'); setWorktreeRef(''); setFormError(''); modal.current?.showModal() }
  function checkoutLocal(branch: Branch, upstream?: string) {
    modal.current?.close()
    if (branch.worktreePath && branch.worktreePath !== repo.path) { openWorktree(branch.worktreePath); return }
    if (branch.ref === `refs/heads/${repo.branch}`) { setNotice(`${repo.branch} 브랜치는 현재 체크아웃되어 있습니다.`); return }
    void mutate({ action: 'switch', ref: branch.ref, base: branch.sha, upstream })
  }
  async function copyCommitSha(sha: string) {
    setNotice(''); setError('')
    try {
      await api.copyCommitSha(repo.path, sha)
      setNotice('커밋 SHA를 복사했습니다.')
    } catch (error) { setError(`SHA 복사 실패: ${(error as Error).message}`) }
  }

  function historyCommitRow(commit: Pick<Commit, 'sha' | 'message' | 'parents'>, row: ReactElement) {
    const { sha, message, parents } = commit
    const pickReason = repo.operation ? `${operationLabel(repo.operation)} 작업을 먼저 마치세요.`
      : !repo.branch || !repo.head ? '반영할 로컬 브랜치를 체크아웃하세요.'
      : repo.files.length ? '작업 변경을 커밋하거나 Stash에 보관하세요.'
      : sha === repo.head ? '현재 HEAD와 같은 커밋입니다.' : ''
    return <div className="bl-commit-actions-row">
      <ContextMenu label={`커밋 ${sha.slice(0, 8)}`} description={message} disabled={busy}
        showButton={historySha === sha} groups={[
          [{ label: '전체 SHA 복사', onClick: () => void copyCommitSha(sha) }],
          [{ label: '이 커밋에서 브랜치 만들기…', onClick: () => dialog('branch', { action: 'branch', base: sha, message }) },
           { label: '현재 브랜치로 Cherry-pick…', disabled: !!pickReason, hint: pickReason || `반영할 브랜치: ${repo.branch}`,
             onClick: () => dialog('confirm', { action: 'cherry-pick', base: sha, message, parents }) }],
        ]}>{row}</ContextMenu>
    </div>
  }
  function branchAction(action: BranchAction, branch: Branch) {
    if (busy || !active) return
    if (action === 'fetch' || action === 'pull') { remoteActions.current?.prepareBranch(action, branch); return }
    const clear = { view: 'history' as const, stashSha: '', stashLabel: '', query: '', author: '', file: '', after: '', before: '' }
    if (action === 'locate' || action === 'solo' || action === 'all') {
      setPickedCommit(null)
      onTab({ ...clear, ref: action === 'solo' ? branch.ref : '', focusRef: action === 'all' ? '' : branch.ref, focusSha: action === 'all' ? '' : branch.sha, focusVisit: (tab.focusVisit || 0) + 1 })
    } else if (action === 'compare') { change({ view: 'compare', stashSha: '', focusSha: '', a: branch.ref, b: repo.branch ? `refs/heads/${repo.branch}` : repo.head || '', mode: 'a', diffMode: 'introduced' }) }
    else if (action === 'copy-sha') { void copyCommitSha(branch.sha) }
    else if (action === 'copy-name') {
      setNotice(''); setError('')
      api.copyBranchName(repo.path, branch.ref).then(() => setNotice('브랜치 이름을 복사했습니다.')).catch(error => setError(error.message))
    } else if (action === 'branch' || action === 'worktree') { dialog(action, { base: branch.sha, ref: branch.ref }); if (action === 'worktree' && branch.remote && branch.ref.startsWith('refs/remotes/')) setName(branch.ref.slice(14 + branch.remote.length)) }
    else if (action === 'rename') { dialog('rename', { action: 'branch-rename', ref: branch.ref, base: branch.sha }); setName(branch.ref.slice(11)) }
    else if (action === 'switch') {
      if (branch.ref.startsWith('refs/heads/')) { checkoutLocal(branch); return }
      const candidates = repo.refs.filter(item => item.ref.startsWith('refs/heads/') && item.tracking?.ref === branch.ref)
      if (candidates.length === 1) { checkoutLocal(candidates[0], branch.ref); return }
      if (candidates.length) { dialog('choose-tracking', { ref: branch.ref }); return }
      if (!branch.remote) { setError('원격 저장소 설정을 확인하세요.'); return }
      dialog('tracking', { action: 'switch-remote', ref: branch.ref, base: branch.sha })
      setName(branch.ref.slice(14 + branch.remote.length))
    }
    else { dialog('confirm', { action: action === 'delete' ? 'branch-delete' : action, ref: branch.ref, base: branch.sha }) }
  }
  function openWorktree(path: string, replace?: string) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); onBusy(true); setError('')
    api.openWorktree(repo.path, path).then(next => onOpen(next, replace)).catch(e => setError(e.message)).finally(() => { inFlight.current = false; setBusy(false); onBusy(false) })
  }
  function worktreeAction(action: WorktreeAction, worktree: Worktree) {
    if (busy || !active || inFlight.current) return
    if (action === 'open' || action === 'open-new') openWorktree(worktree.path, action === 'open' ? repo.path : undefined)
    else if (action.startsWith('worktree-remove')) dialog('confirm', { action, target: worktree.path, base: worktree.head, ref: worktree.branch ? `refs/heads/${worktree.branch}` : '' })
    else void mutate({ action, target: worktree.path })
  }
  useImperativeHandle(ref, () => ({ branchAction, worktreeAction, stashAction: (action, stash) => remoteActions.current?.prepareStash(action, stash) }))
  async function fileNavigate(action: FileMenuAction, file: GitFile, staged: boolean) {
    if (action === 'diff') { setSelected({ file: file.path, staged }); return }
    if (action === 'conflicts') { change({ view: 'conflicts' }); return }
    if (action === 'history') { change({ view: 'history', file: file.originalPath || file.path, ref: '', query: '', author: '', after: '', before: '', focusSha: '', stashSha: '' }); return }
    if (action === 'edit') {
      const dirty = workingEditor.snapshot && workingEditor.draft !== workingEditor.snapshot.current.replaceAll('\r\n', '\n')
      if (dirty && workingEditor.snapshot?.file !== file.path) throw new Error('다른 파일에 저장하지 않은 편집이 있습니다. 폴더에서 보기에서 먼저 저장하거나 편집을 취소하세요.')
      const snapshot = dirty ? workingEditor.snapshot! : await api.workingRead(repo.path, file.path)
      onWorkingEditor({ open: true, visit: workingEditor.visit + 1, snapshot, draft: dirty ? workingEditor.draft : snapshot.current.replaceAll('\r\n', '\n') }); change({ view: 'history' })
    }
  }
  function fileRow(file: GitFile, staged: boolean) {
    return <FileMenuRow key={`${file.path}/${staged}`} path={file.path} originalPath={file.originalPath} menuDisabled={busy} repo={repo} file={file} onAction={action => { if (action === 'stage' || action === 'unstage') void mutate({ action, file: file.path }); else fileActions.current?.open(action, file, staged) }} status={file.conflict ? '!' : file.untracked ? '?' : staged ? file.index : file.working} selected={selected?.file === file.path && selected?.staged === staged} staged={staged} disabled={busy || file.conflict} stats={file.conflict ? { added: null, deleted: null, reason: '충돌 해결 필요' } : stats?.key === statsKey ? stats.error ? { added: null, deleted: null, reason: '조회 실패' } : stats.value?.[staged ? 'staged' : 'working'][file.path] || { added: 0, deleted: 0 } : undefined} onSelect={() => setSelected({ file: file.path, staged })} onToggle={() => void mutate({ action: staged ? 'unstage' : 'stage', file: file.path })} />
  }
  const hasConflictEdits = edited(editor) || Array.from(editor.parked?.values() || []).some(edited)
  function bulkAction(staging: boolean, paths: string[] | null, total: number) {
    const count = paths?.length ?? total
    const label = staging ? '스테이징' : '스테이징 해제'
    return <Button disabled={busy || !count || repo.files.some(f => f.conflict)} onClick={() => void mutate(paths
      ? { action: staging ? 'stage' : 'unstage', files: paths }
      : { action: staging ? 'stage-all' : 'unstage-all' })}>{paths ? `검색 결과 ${count}개 ${label}` : `모두 ${label}`}</Button>
  }
  const staged = repo.files.filter(f => !f.untracked && f.index !== ' ')
  const unstaged = repo.files.filter(f => f.untracked || f.working !== ' ')
  const canCommit = !busy && !!staged.length && !!tab.commitMessage.trim() && !repo.operation && !repo.files.some(f => f.conflict)
  const loading = tab.view !== 'changes' && data?.key !== request
  const branchFromCommit = dialogKind === 'branch' && pending.action === 'branch'
  const needsMainline = pending.action === 'cherry-pick' && (pending.parents?.length || 0) > 1 && !pending.mainline
  const branches = [...repo.refs.map(r => ({ value: r.ref, label: r.name })), ...(!repo.branch && repo.head ? [{ value: repo.head, label: `Detached HEAD · ${repo.head.slice(0, 8)}` }] : [])]
  return <section ref={workspaceElement} className={`bl-repository ${tab.view === 'history' ? 'bl-repository-graph' : ''}`} hidden={!active} onKeyDown={event => {
    if (tab.view !== 'history' || event.key !== '/' || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return
    if (!(event.target instanceof Element) || !event.target.closest('.bl-commit-graph, .bl-content-tabpanel[role=region]') || event.target.closest('[role="menu"]')) return
    event.preventDefault()
    searchField.current?.focus()
    searchField.current?.select()
  }}>
    <header className="bl-repository-header">
      <nav className="bl-workspace-views" aria-label="저장소 보기">
        {Object.entries(viewNames).filter(([view]) => !['worktrees', 'stashes', 'sync'].includes(view) && (view !== 'conflicts' || tab.view === view || repo.operation || hasConflictEdits || repo.files.some(file => file.conflict))).map(([view, label]) =>
          <Button key={view} variant="ghost" disabled={busy} aria-current={tab.view === view ? 'page' : undefined} onClick={() => onTab({ view: view as Tab['view'] })}>
            {label}{view === 'changes' && <> <Badge>{repo.files.length}</Badge></>}
          </Button>)}
      </nav>
      <div className="bl-repository-toolbar" ref={setToolbarHost} />
    </header>
    <div className={['history', 'compare'].includes(tab.view) ? 'sr-only' : 'bl-page-heading'}>
      <h1 ref={heading} tabIndex={-1}>{viewNames[tab.view]}</h1>
    </div>
    {(tab.view !== 'history' || repo.operation || repo.shallow) && <div className="bl-context"><span>현재 <code>{repo.branch || 'Detached HEAD'}</code></span><span>HEAD <code>{repo.head?.slice(0, 8) || '첫 커밋 전'}</code></span>{repo.shallow && <strong>Shallow · 이력이 불완전합니다</strong>}</div>}
    {repo.operation && <Notice><div className="bl-row-between"><span><strong>{operationLabel(repo.operation)} 진행 중</strong> · 미해결 {repo.files.filter(f => f.conflict).length}개{hasConflictEdits ? ' · 저장하지 않은 충돌 편집이 있습니다.' : ''}</span><div className="bl-actions">{repo.operation === 'cherry-pick' && <Button disabled={busy} onClick={() => dialog('confirm', { action: 'skip', operation: repo.operation! })}>현재 Cherry-pick 건너뛰기</Button>}<Button disabled={busy} onClick={() => dialog('confirm', { action: 'abort', operation: repo.operation! })}>작업 중단</Button><Button disabled={busy || repo.files.some(f => f.conflict || (!f.untracked && f.working !== ' ')) || hasConflictEdits} onClick={() => dialog('confirm', { action: 'continue', operation: repo.operation! })}>{operationLabel(repo.operation)} 계속</Button></div></div></Notice>}

    {active && <><ToastMessage scope={repo.name} tone="error" message={error} /><ToastMessage scope={repo.name} tone="warning" message={repo.operation ? conflictNotice : ''} /><ToastMessage scope={repo.name} tone={notice === '패치 저장을 취소했습니다.' ? 'info' : notice.includes('계속 진행 중') ? 'warning' : 'success'} message={notice} /></>}
    <div hidden={tab.view !== 'conflicts'}><ConflictWorkspace active={active && tab.view === 'conflicts'} editor={editor} onEditor={onEditor} api={api} repo={repo} onRepo={onRepo} onBusy={value => { setBusy(value); onBusy(value) }} /></div>
    {(tab.view === 'conflicts' || tab.view === 'sync' || tab.view === 'stashes') ? null : tab.view === 'changes' ? <div className="bl-work-columns"><div className="bl-file-panel"><ScrollArea className="bl-file-lists">{stats?.key === statsKey && stats.error && <Notice tone="error">{stats.error}<Button onClick={() => { setStatsRetry(value => value + 1); api.state(repo.path).then(onRepo).catch(e => setError(e.message)) }}>줄 수 다시 조회</Button></Notice>}<ChangeFileList label="작업 파일" paths={unstaged.map(file => file.path)} actions={paths => bulkAction(true, paths, unstaged.length)} renderFile={index => fileRow(unstaged[index], false)} empty="작업 파일이 깨끗합니다." /><ChangeFileList label="스테이징" paths={staged.map(file => file.path)} actions={paths => bulkAction(false, paths, staged.length)} renderFile={index => fileRow(staged[index], true)} empty="커밋할 변경을 + 버튼으로 선택하세요." />{repo.files.some(f => f.conflict) && <Notice>미해결 충돌이 있습니다. <Button disabled={busy} onClick={() => change({ view: 'conflicts' })}>충돌 파일 해결하기</Button></Notice>}</ScrollArea><div className="bl-commit-form"><TextArea className="resize-none" label="커밋 메시지" value={tab.commitMessage} rows={3} placeholder="변경한 내용과 이유를 적어 주세요 · ⌘/Ctrl+Enter로 커밋" onChange={e => onTab({ commitMessage: e.target.value })} onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) { event.preventDefault(); if (canCommit) dialog('confirm', { action: 'commit', message: tab.commitMessage }) } }} /><small>{repo.identity.name || '작성자 미설정'} · {repo.identity.email || '이메일 미설정'}</small><div className="bl-commit-actions"><Button variant="primary" aria-keyshortcuts="Meta+Enter Control+Enter" disabled={!canCommit} onClick={() => dialog('confirm', { action: 'commit', message: tab.commitMessage })}>{repo.branch ? `${repo.branch}에 커밋` : '현재 HEAD에 커밋'}</Button><Button disabled={busy || !repo.head || !repo.branch || !!repo.operation || repo.files.some(file => file.conflict)} onClick={() => setAmendSha(repo.head)}>최근 커밋 수정 · Amend</Button></div>{canPrepareReview && !hasRemote && <Button disabled={busy} onClick={() => change({ view: 'sync' })}>원격 추가 후 게시</Button>}{canPrepareReview && hasRemote && <div ref={setCommitPushHost} className="bl-commit-push" />}{canPrepareReview && hasRemote && <Button disabled={busy} onClick={() => {
          const source = `refs/heads/${repo.branch}`
          change({ view: 'compare', a: source, b: tab.b !== source && repo.refs.some(ref => ref.ref === tab.b) ? tab.b : '', mode: 'a', diffMode: 'introduced' })
        }}>PR/MR 준비</Button>}</div></div><InspectorPanel title={selected?.file || "파일 변경"} integratedToolbar={!!selected && details?.key === detailKey && !details.error}>{(_expanded, actions) => selected ? details?.key === detailKey ? details.error ? <Notice tone="error">{details.error}</Notice> : <CodeDiff value={details.value} filename={selected.file} actions={actions} hunkAction={!repo.operation && repo.files.some(file => file.path === selected.file && !file.conflict && !file.untracked && !file.originalPath && (selected.staged ? file.index : file.working) === 'M') && /^index [a-f0-9]+\.\.[a-f0-9]+ 100(?:644|755)$/m.test(details.value) && !/^(old mode|new mode|new file|deleted file|rename |copy |Binary files|GIT binary patch)/m.test(details.value) ? { label: selected.staged ? '구간 스테이징 해제' : '구간 스테이징', disabled: busy, onApply: hunk => { void mutate({ action: selected.staged ? 'unstage-hunk' : 'stage-hunk', file: selected.file, hunk, preview: details.value, expected: details.token }) } } : undefined} /> : <Notice>변경 내용을 읽고 있습니다…</Notice> : <EmptyState title="변경 파일을 선택하세요">작업 파일과 스테이징된 변경을 나눠 검토할 수 있습니다.</EmptyState>}</InspectorPanel></div>
      : tab.view === 'compare' ? <ComparisonWorkspace onPush={(...args) => remoteActions.current?.pushForReview(...args) ?? Promise.resolve(false)} api={api} repo={repo} tab={tab} busy={busy} active={active} reviewAfterCommit={canPrepareReview && tab.a === `refs/heads/${repo.branch}`} onTab={onTab} onAction={command => dialog('confirm', command)} /> : tab.view === 'worktrees' ? <><div className="bl-row-between"><p className="bl-muted">같은 저장소의 다른 브랜치를 별도 폴더에서 동시에 작업합니다.</p><Button disabled={busy || !repo.head} onClick={() => dialog('worktree')}>Worktree 만들기</Button></div>{loading ? <Notice>Worktree를 읽고 있습니다…</Notice> : data?.error ? <Notice tone="error">{data.error}</Notice> : Array.isArray(data?.value) && <div className="bl-worktree-list">{data.value.map((w, i) => <WorktreeMenu key={w.path} worktree={w} primary={i === 0} openPaths={openPaths} disabled={busy} onAction={worktreeAction}><article className="bl-worktree" tabIndex={0}><div><h2>{w.branch || 'Detached HEAD'}</h2><p className="bl-path" title={w.path}>{compactPath(w.path)}</p><small>{i === 0 ? '기본 worktree' : '추가 worktree'} · {w.locked ? '잠김' : '잠금 없음'}{w.prunable ? ' · 경로 확인 필요' : ''}</small></div><div className="bl-actions"><Button disabled={busy || w.prunable} onClick={() => worktreeAction('open-new', w)}>탭에서 열기</Button>{i > 0 && w.path !== repo.path && <><Button disabled={busy} onClick={() => worktreeAction(w.locked ? 'worktree-unlock' : 'worktree-lock', w)}>{w.locked ? '잠금 해제' : '잠금'}</Button><Button disabled={busy || w.locked || w.prunable || openPaths.includes(w.path)} onClick={() => worktreeAction('worktree-remove', w)}>삭제</Button></>}</div></article></WorktreeMenu>)}</div>}</>
        : <FilterBar label="커밋 필터" count={[tab.ref, tab.author, tab.file, tab.after, tab.before].filter(Boolean).length}
          context={<div className="bl-graph-context">
            <Button className="bl-head-locator" aria-label="HEAD 위치로 이동"
              aria-description={repo.head ? `${repo.branch || 'Detached HEAD'} · ${repo.head}` : '첫 커밋 전'}
              title={repo.head ? `HEAD 위치로 이동 · ${repo.branch || 'Detached HEAD'} · ${repo.head}` : '첫 커밋 전'}
              disabled={busy || !repo.head} onClick={revealHead}>
              <Icon name="locate" /><strong>{repo.branch || !repo.head ? 'HEAD' : 'Detached HEAD'}</strong>
              {repo.branch && <span>{repo.branch}</span>}<code>{repo.head?.slice(0, 8) || '첫 커밋 전'}</code>
            </Button>
            {!repo.branch && repo.head && <Button disabled={busy} onClick={() => dialog('branch', { base: repo.head! })}><Icon name="branch" />이 커밋에서 브랜치 만들기</Button>}
            <p className="bl-history-scope" title={tab.ref || undefined}>{tab.ref ? 'Solo · ' : ''}{tab.ref.replace(/^refs\/(heads|remotes)\//, '') || '전체 브랜치'}</p>
            {tab.ref && <Button variant="ghost" disabled={busy} onClick={() => change({ ref: '', focusRef: '', focusSha: '' })}>Solo 해제</Button>}
            {tab.ref.startsWith('refs/heads/') && tab.ref !== `refs/heads/${repo.branch}` && <Button disabled={busy || !!repo.operation || repo.files.some(file => file.conflict)} onClick={() => dialog('confirm', { action: 'switch', ref: tab.ref })}>조회한 브랜치로 전환</Button>}
            {tab.ref.startsWith('refs/remotes/') && <small>마지막 Fetch 기준 원격 추적 이력</small>}
          </div>}
          search={<div className="bl-commit-search">
            <Icon name="search" />
            <TextField ref={searchField} label="커밋 검색" hideLabel aria-keyshortcuts="/" value={tab.query} placeholder="커밋 검색 · 메시지, SHA, 링크"
              onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} onChange={event => change({ query: event.target.value })} />
            {tab.query ? <IconButton icon="close" label="커밋 검색 지우기" onClick={() => { change({ query: '' }); searchField.current?.focus() }} /> : <kbd aria-hidden="true">/</kbd>}
          </div>}>
          <div className="bl-filter-grid">
            <SelectField label="조회 브랜치" value={tab.ref} onChange={ref => change({ ref })} options={[{ value: '', label: '전체 브랜치' }, ...(tab.ref === 'HEAD' ? [{ value: 'HEAD', label: 'HEAD' }] : []), ...branches]} />
            <TextField label="작성자" value={tab.author} onChange={event => change({ author: event.target.value })} />
            <TextField label="파일·폴더 경로" value={tab.file} onChange={event => change({ file: event.target.value })} />
            <TextField label="시작일" hint="커미터 날짜 기준, 로컬 시간으로 비교합니다." type="date" value={tab.after} onChange={event => change({ after: event.target.value })} />
            <TextField label="종료일" hint="커미터 날짜 기준, 로컬 시간으로 비교합니다." type="date" value={tab.before} onChange={event => change({ before: event.target.value })} />
            <Button variant="ghost" disabled={![tab.ref, tab.author, tab.file, tab.after, tab.before].some(Boolean)}
              onClick={() => { change({ author: '', file: '', ref: '', after: '', before: '' }); searchField.current?.focus() }}><Icon name="reset" />필터 초기화</Button>
          </div>
        </FilterBar>
    }
    {visitedHistory && <CommitReview hidden={tab.view !== 'history'} working={workingEditor.open ? { visit: workingEditor.visit, dirty: !!workingEditor.snapshot && workingEditor.draft !== workingEditor.snapshot.current.replaceAll('\r\n', '\n'), onClose: () => workingActions.current?.close(), content: <WorkingFiles ref={workingActions} api={api} path={repo.path} editor={workingEditor} onEditor={onWorkingEditor} onBusy={value => { setBusy(value); onBusy(value) }} onSaved={() => { api.state(repo.path).then(onRepo).catch(e => setError(`파일 저장 후 상태 확인 실패: ${e.message}`)) }} /> } : undefined} sha={historySha} visit={stashSelection ? tab.stashVisit : tab.focusVisit} title={stashSelection ? 'Stash 상세' : '커밋 상세'} graph={<HistoryGraph key={historyScope} onStartCommit={() => change({ view: 'changes' })} initialPosition={!tab.focusSha && !tab.stashSha && bookmark.value.sha ? bookmark.value : undefined} onPosition={position => { if (!tab.stashSha) bookmark.update(position, true) }} api={api} repo={repo} tab={tab} paused={composing} stash={!!stashSelection} focusSha={stashSelection?.sha || tab.focusSha} focusKey={stashSelection ? tab.stashVisit : tab.focusVisit} renderRow={historyCommitRow} renderRef={(ref, badge) => { const branch = repo.refs.find(branch => branch.ref === ref.ref); return branch ? <BranchMenu branch={branch} repo={repo} solo={tab.ref} disabled={busy} onAction={branchAction}>{badge}</BranchMenu> : badge }} selected={historySha || null} onSelect={sha => setSelected(sha ? { sha } : null)} />} summary={selected?.sha && <div>{stashSelection && <p>{tab.stashLabel || '보관한 변경'}</p>}<div className="bl-actions bl-commit-sha-row"><code title={selected.sha}>{selected.sha.slice(0, 12)}</code><IconButton icon="copy" label="전체 커밋 SHA 복사" onClick={() => void copyCommitSha(selected.sha!)} />{!stashSelection && selected.sha === repo.head && <Button disabled={busy || selected.sha !== repo.head || !repo.branch || !!repo.operation || repo.files.some(file => file.conflict)} title={selected.sha !== repo.head ? '현재 HEAD 커밋만 Amend할 수 있습니다.' : '메시지 또는 스테이징 변경을 기존 커밋에 반영'} onClick={() => setAmendSha(selected.sha!)}>Amend</Button>}</div></div>} details={details?.key === detailKey ? details : undefined} onClose={() => { setSelected(null) }} />}
    <FileActions ref={fileActions} api={api} repo={repo} onRepo={next => { onRepo(next); setSelected(null) }} onBusy={value => { if (value) { setNotice(''); setError('') } setBusy(value); onBusy(value) }} onNavigate={fileNavigate} onFeedback={(message, isError) => { setError(isError ? message : ''); setNotice(isError ? '' : message) }} />
    {amendSha && <AmendCommit key={amendSha} api={api} repo={repo} sha={amendSha} onRepo={onRepo} onAmended={next => { onRepo(next); if (next.head !== amendSha) { setSelected({ sha: next.head || undefined }); onTab({ view: 'history', ref: '', query: '', author: '', file: '', after: '', before: '', focusRef: '', focusSha: next.head || '', focusVisit: (tab.focusVisit || 0) + 1 }); setNotice('Amend를 완료했습니다. 새 커밋을 확인하세요. 원격에는 Push하지 않았습니다.') } }} onClose={() => setAmendSha(null)} onBusy={value => { setBusy(value); onBusy(value) }} />}
    <RemoteWorkspace onStashRemoved={(sha, ref, message) => { if (tab.stashSha === sha && (!tab.stashRef || tab.stashRef === ref) && tab.stashLabel === message) setSelected(null) }} ref={remoteActions} api={api} repo={repo} active={active} toolbarHost={toolbarHost} commitPushHost={commitPushHost} onRemoteSettings={() => change({ view: 'sync' })} onCompare={(a, b) => change({ view: 'compare', a, b, mode: 'different', diffMode: 'introduced' })} onIntegrate={(action, ref, sha) => { if (!busy && repo.branch) dialog('confirm', { action, ref, base: sha }) }} expanded={tab.view === 'sync' || tab.view === 'stashes'} section={tab.view === 'stashes' ? 'stash' : 'remote'} stashSha={tab.stashSha} blocked={busy} onBranch={() => dialog('branch', { base: selected?.sha || (tab.view === 'history' && tab.ref ? repo.refs.find(ref => ref.ref === tab.ref)?.sha : null) || repo.head || 'HEAD' })} onRepo={onRepo} onBusy={value => { if (value) { setNotice(''); setError('') } setBusy(value); onBusy(value) }} onChanges={() => change({ view: 'changes' })} />
    <Dialog busy={busy} dialogRef={modal} title={dialogKind === 'rename' ? '브랜치 이름 변경' : dialogKind === 'choose-tracking' ? '추적 브랜치 선택' : dialogKind === 'tracking' ? '로컬 추적 브랜치 체크아웃' : dialogKind === 'branch' ? '브랜치 만들기' : dialogKind === 'worktree' ? 'Worktree 만들기' : pending.action === 'cherry-pick' ? 'Cherry-pick 검토' : pending.action === 'skip' ? 'Cherry-pick 건너뛰기' : pending.action === 'worktree-remove-branch' ? 'Worktree와 브랜치 제거' : pending.action === 'branch-delete' ? '로컬 브랜치 삭제' : pending.action === 'abort' ? `${operationLabel(pending.operation)} 중단` : pending.action === 'merge' ? 'Merge 검토' : pending.action === 'rebase' ? 'Rebase 검토' : 'Worktree 삭제'} onClose={() => setFormError('')}>
      <form noValidate onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault() }} onSubmit={event => { event.preventDefault(); if (dialogKind === 'choose-tracking') {
          const chosen = repo.refs.find(item => item.ref === worktreeRef && item.tracking?.ref === pending.ref)
          if (chosen) checkoutLocal(chosen, pending.ref)
          else setFormError('체크아웃할 로컬 브랜치를 선택하세요.')
          return
        } if ((['branch', 'rename', 'tracking'].includes(dialogKind) || (dialogKind === 'worktree' && worktreeMode === 'new')) && !name.trim()) { setFormError('이름을 입력하세요.'); nameField.current?.focus(); return } if (dialogKind === 'worktree' && worktreeMode === 'existing' && !worktreeRef) { setFormError('기존 로컬 브랜치를 선택하세요.'); return } if (dialogKind === 'worktree' && !target) { setFormError('새 worktree 위치를 선택하세요.'); return } void mutate(dialogKind === 'confirm' ? pending : { action: dialogKind === 'branch' && (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'checkout' ? 'branch-switch' : dialogKind === 'rename' ? 'branch-rename' : dialogKind === 'tracking' ? 'switch-remote' : dialogKind === 'worktree' ? 'worktree-add' : dialogKind, expected: pending.expected, name, target, worktreeMode, ref: dialogKind === 'worktree' ? worktreeRef : pending.ref, base: pending.base || repo.head || 'HEAD', ...(worktreeUpstream ? { upstream: worktreeUpstream } : {}) }) }}>
        {dialogKind === 'choose-tracking' ? <SelectField label={`${pending.ref?.slice(13)} 추적 브랜치`} value={worktreeRef} onChange={setWorktreeRef} options={[{ value: '', label: '로컬 브랜치 선택' }, ...repo.refs.filter(item => item.ref.startsWith('refs/heads/') && item.tracking?.ref === pending.ref).map(item => ({ value: item.ref, label: item.ref.slice(11) }))]} /> : dialogKind === 'confirm' ? <div className="bl-confirm"><p>{pending.action === 'cherry-pick' ? `선택 커밋의 변경을 현재 ${repo.branch}에 새 커밋으로 적용하고 원본 SHA를 메시지에 기록합니다. 충돌 시 해결 화면에서 계속하거나 중단할 수 있습니다.` : pending.action === 'skip' ? '현재 Cherry-pick을 건너뛰며 이 단계의 충돌 해결과 편집 내용을 버립니다. 다음 커밋이 있으면 이어서 적용합니다.' : pending.action === 'worktree-remove-branch' ? `Worktree 폴더와 ${pending.ref?.slice(11)} 로컬 브랜치를 제거합니다. 현재 HEAD에 병합되지 않았거나 변경·진행 중 작업이 있으면 제거하지 않습니다. 원격 브랜치는 유지합니다.` : pending.action === 'branch-delete' ? `${pending.ref?.slice(11)} 로컬 브랜치를 삭제합니다. 현재 HEAD에 병합되지 않았거나 다른 Worktree에서 사용 중이면 삭제하지 않습니다. 원격 브랜치는 유지됩니다.` : pending.action === 'abort' ? `${operationLabel(pending.operation)} 시작 전 상태로 돌아갑니다. 작업 중 저장한 충돌 해결 내용과 저장하지 않은 편집을 버립니다. 시작 전에 있던 변경의 복구는 Git 상태에 따라 달라질 수 있습니다.` : pending.action === 'merge' ? `${refName(pending.ref)}의 검토한 커밋을 현재 ${repo.branch}에 합칩니다. 가능한 경우 fast-forward하며 충돌이 발생하면 해결 화면으로 이동합니다.` : pending.action === 'rebase' ? `현재 ${repo.branch}의 커밋을 ${pending.ref ? `${refName(pending.ref)}의 검토한 커밋` : `선택한 커밋 ${pending.base?.slice(0, 12)}`} 위에 다시 적용합니다. 커밋 SHA가 바뀌므로 공유한 브랜치인지 확인하세요. 충돌 시 계속하거나 중단할 수 있습니다.` : '선택한 worktree 디렉터리를 삭제합니다. 브랜치와 커밋 이력은 유지합니다. 변경 사항이 있으면 삭제하지 않습니다.'}</p><pre title={pending.base}>{pending.message || pending.target || refName(pending.ref)}{pending.base && `\n대상 커밋 ${pending.base.slice(0, 8)}`}</pre>{pending.action === 'cherry-pick' && (pending.parents?.length || 0) > 1 && <SelectField label="Merge 커밋 적용 기준 부모" value={String(pending.mainline || '')} onChange={value => setPending(current => ({ ...current, mainline: Number(value) || undefined }))} options={[{ value: '', label: '부모를 선택하세요' }, ...pending.parents!.map((sha, i) => ({ value: String(i + 1), label: `부모 ${i + 1} · ${sha}` }))]} />}</div> : <>{dialogKind === 'rename' && <p><code>{pending.ref?.slice(11)}</code> 브랜치의 이름을 변경합니다. 원격 브랜치 이름은 바뀌지 않습니다.</p>}{dialogKind === 'tracking' && <p><code>{pending.ref?.slice(13)}</code>를 추적하는 로컬 브랜치를 만들고 체크아웃합니다. 같은 이름의 로컬 브랜치가 있으면 다른 이름을 입력하세요.</p>}{dialogKind === 'worktree' && <SelectField label="Worktree 생성 방식" value={worktreeMode} onChange={value => setWorktreeMode(value as typeof worktreeMode)} options={[{ value: 'new', label: '새 브랜치' }, { value: 'existing', label: '기존 로컬 브랜치' }, { value: 'detached', label: '커밋 살펴보기 · detached HEAD' }]} />}{dialogKind === 'worktree' && worktreeMode === 'existing' ? <SelectField label="Worktree 브랜치" value={worktreeRef} onChange={setWorktreeRef} options={[{ value: '', label: '로컬 브랜치 선택' }, ...branches.filter(item => item.value.startsWith('refs/heads/'))]} /> : (['branch', 'rename', 'tracking'].includes(dialogKind) || worktreeMode === 'new') && <TextField ref={nameField} label="새 브랜치 이름" value={name} onChange={e => setName(e.target.value)} error={nameError || (formError && !name.trim() ? formError : undefined)} />}{worktreeUpstream && <small className="bl-muted">{worktreeUpstream.slice(13)}을(를) 추적합니다. 받을·보낼 커밋 수가 툴바에 표시됩니다.</small>}{dialogKind === 'worktree' && worktreeMode !== 'existing' && <TextField label="Worktree 시작 커밋 또는 브랜치" value={pending.base || repo.head || 'HEAD'} onChange={event => setPending({ ...pending, base: event.target.value })} />}{dialogKind !== 'rename' && <p>시작 커밋 <code>{(pending.base || repo.head)?.slice(0, 12)}</code>{branchFromCommit && pending.message && ` · ${pending.message}`}</p>}{dialogKind === 'worktree' && <div><Button onClick={() => { api.destination().then(value => { if (value) setTarget(value) }).catch(e => setFormError(e.message)) }}>새 폴더 위치 선택</Button><p className="bl-path">{target || '아직 선택하지 않음'}</p></div>}</>}
        {dialogKind === 'tracking' && !!repo.files.length && <Notice>작업 중인 변경 {repo.files.length}개를 유지하며 전환합니다. 겹치는 변경은 자동 Stash 후 복원합니다.</Notice>}
        {formError && <Notice tone="error">{formError}</Notice>}<div className="bl-actions bl-dialog-actions"><Button disabled={busy} onClick={() => modal.current?.close()}>취소</Button>{dialogKind === 'branch' && <Button type="submit" variant={branchFromCommit ? 'primary' : 'secondary'} disabled={busy || !!nameError}>브랜치만 만들기</Button>}<Button type="submit" value={dialogKind === 'branch' ? 'checkout' : undefined} variant={branchFromCommit ? 'secondary' : 'primary'} loading={busy} disabled={!!nameError || needsMainline || (dialogKind === 'branch' && (!!repo.operation || repo.files.some(file => file.conflict)))}>{dialogKind === 'branch' ? '만들고 체크아웃' : dialogKind === 'confirm' ? pending.action === 'cherry-pick' ? 'Cherry-pick 실행' : pending.action === 'skip' ? '이 커밋 건너뛰기' : pending.action === 'worktree-remove-branch' ? 'Worktree와 브랜치 제거' : pending.action === 'branch-delete' ? '로컬 브랜치 삭제' : pending.action === 'abort' ? '작업 중단' : pending.action === 'merge' ? 'Merge 실행' : pending.action === 'rebase' ? 'Rebase 실행' : 'Worktree 삭제' : dialogKind === 'choose-tracking' ? '선택한 브랜치 열기' : '저장'}</Button></div>
      </form>
    </Dialog>
  </section>
}
