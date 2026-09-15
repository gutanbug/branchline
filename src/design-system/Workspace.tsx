import { useRef, useState } from 'react'
import { Badge, Brand, BranchFilter, Button, Checkbox, Dialog, Disclosure, EmptyState, Notice, TextField, ToolbarButton } from './components'

import { SyncBadge } from './SyncBadge'
import { exampleBranches, exampleCommits } from './examples'
import type { Commit } from './examples'

export type BranchGroup = { id: string; label: string; kind?: 'worktree' | 'stash'; action?: { label: string; selected?: boolean; onClick: () => void }; flat?: boolean; empty?: string; items: { id: string; label: string; current?: boolean; tracking?: { ahead: number | null; behind: number | null }; description?: string; disabled?: boolean }[] }
export function BranchTree({ branches = [], value, currentBranch = '', onChange, groups, disabled = false, renderBranch, revealAll = false }: { revealAll?: boolean; branches?: string[]; value: string | null; currentBranch?: string; onChange: (branch: string | null) => void; groups?: BranchGroup[]; disabled?: boolean; renderBranch?: (id: string, button: React.ReactElement) => React.ReactNode }) {
  const sections: BranchGroup[] = groups || [{ id: 'local', label: 'LOCAL', items: branches.map(branch => ({ id: branch, label: branch, current: branch === currentBranch })) }]
  const selection = sections.filter(group => !group.kind).flatMap(group => group.items).find(item => item.id === value)?.id || currentBranch || sections.flatMap(group => group.items).find(item => item.current)?.id || ''
  const [expansion, setExpansion] = useState<{ selection: string; folders: Record<string, boolean> }>({ selection, folders: {} })
  const expanded = expansion.selection === selection ? expansion.folders : {}
  function setExpanded(patch: Record<string, boolean>) { setExpansion({ selection, folders: { ...expanded, ...patch } }) }
  function folderPaths(group: BranchGroup) { return [...new Set(group.items.flatMap(item => item.label.split('/').slice(0, -1).map((_, index) => item.label.split('/').slice(0, index + 1).join('/'))))] }
  function expandGroup(group: BranchGroup, open: boolean) { setExpanded({ [group.id]: true, ...Object.fromEntries(folderPaths(group).map(folder => [`${group.id}/${folder}`, open])) }) }
  function nodes(group: BranchGroup, prefix = ''): React.ReactNode {
    const items = group.items.filter(item => item.label.startsWith(prefix))
    const children = [...new Set(items.map(item => group.kind || group.flat ? item.id : item.label.slice(prefix.length).split('/')[0]))]
    return children.map(name => {
      const folder = prefix + name
      const descendants = !group.kind && !group.flat && items.some(item => item.label.startsWith(`${folder}/`))
      if (descendants) return <Disclosure key={folder} title={name} open={expanded[`${group.id}/${folder}`] ?? (revealAll || items.some(item => item.id === selection && item.label.startsWith(`${folder}/`)))} onOpenChange={open => setExpanded({ [`${group.id}/${folder}`]: open })}><div className="bl-tree-children">{nodes(group, `${folder}/`)}</div></Disclosure>
      const entries = items.filter(item => group.kind || group.flat ? item.id === name : item.label === folder)
      return entries.map(item => { const button = <Button variant="ghost" key={item.id} className="bl-repo-tree-item" disabled={disabled || item.disabled} aria-pressed={value === item.id} aria-label={`${group.kind === 'worktree' ? 'Worktree 열기' : group.kind === 'stash' ? 'Stash 보기' : '이력 조회'}: ${group.kind ? `${item.label} · ${item.id}` : item.id.replace(/^refs\/(heads|remotes)\//, '')}`} aria-description={item.tracking ? `추적 브랜치 기준 · 받을 커밋 ${item.tracking.behind ?? '확인 불가'} · 보낼 커밋 ${item.tracking.ahead ?? '확인 불가'}` : undefined} title={item.description || item.label} onClick={() => onChange(item.id)}><span aria-hidden="true">{group.kind === 'worktree' ? '▱' : group.kind === 'stash' ? '▣' : '⑂'}</span><span className="bl-repo-tree-label"><span>{group.kind || group.flat ? item.label : name}</span>{item.description && <small>{item.description}</small>}{item.tracking && <span className="bl-branch-sync"><SyncBadge direction="incoming" count={item.tracking.behind} /><SyncBadge direction="outgoing" count={item.tracking.ahead} /></span>}</span>{item.current && <Badge>{group.kind === 'worktree' ? '현재' : 'HEAD'}</Badge>}</Button>; return renderBranch && !group.kind ? <div className="bl-tree-branch-actions" key={item.id}>{renderBranch(item.id, button)}</div> : button })
    })
  }
  return <nav className="bl-branch-tree" aria-label="브랜치 트리"><Button variant="ghost" className="bl-repo-tree-all" disabled={disabled} aria-pressed={value === null} onClick={() => onChange(null)}>전체 브랜치 그래프</Button>{sections.map(group => <div className="bl-tree-group" key={group.id} data-folders={!group.kind && !group.flat}><Disclosure title={`${group.label} · ${group.items.length}`} open={expanded[group.id] ?? true} onOpenChange={open => setExpanded({ [group.id]: open })}>{group.action && <Button variant="ghost" className="bl-repo-tree-all" disabled={disabled} aria-pressed={group.action.selected} onClick={group.action.onClick}>{group.action.label}</Button>}{group.items.length ? <div className="bl-tree-children">{nodes(group)}</div> : <p className="bl-tree-empty">{group.empty || '브랜치가 없습니다.'}</p>}</Disclosure>{!group.kind && !group.flat && <div className="bl-tree-expand-tools"><Button variant="ghost" aria-label={`${group.label} 전체 펼치기`} title={`${group.label} 전체 펼치기`} disabled={!group.items.length} onClick={() => expandGroup(group, true)}><svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 8 5-5 5 5M7 16l5 5 5-5M4 12h16" /></svg></Button><Button variant="ghost" aria-label={`${group.label} 전체 접기`} title={`${group.label} 전체 접기`} disabled={!group.items.length} onClick={() => expandGroup(group, false)}><svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 3 5 5 5-5M7 21l5-5 5 5M4 12h16" /></svg></Button></div>}</div>)}</nav>
}

export function CommitList({ commits, selectedHash, onSelect }: { commits: Commit[]; selectedHash: string | null; onSelect: (commit: Commit) => void }) {
  if (!commits.length) return <EmptyState title="일치하는 커밋이 없습니다">검색어나 조회 브랜치를 변경해 보세요.</EmptyState>
  return <div className="bl-commits"><div className="commit-head" aria-hidden="true"><span>이력</span><span>커밋 메시지 / SHA</span><span>날짜</span></div><div aria-label="예제 커밋 목록">{commits.map(commit => <button key={commit.hash} type="button" className={`commit-row ${selectedHash === commit.hash ? 'selected current' : ''}`} aria-pressed={selectedHash === commit.hash} onClick={() => onSelect(commit)}><span className="bl-lane" aria-hidden="true"><span className="graph-dot" /></span><span><span className="commit-title">{commit.message}</span><span className="commit-meta"><code>{commit.hash}</code><Badge variant="branch">{commit.branch}</Badge></span></span><time className="date" dateTime={commit.date}>{commit.date}</time></button>)}</div></div>
}

export function DetailPanel({ commit }: { commit: Commit | null }) {
  return <aside className="detail" aria-label="커밋 상세"><div className="detail-kicker">커밋 상세 <Badge>예제</Badge></div>{commit ? <><h2>{commit.message}</h2><div className="person"><span className="avatar" aria-hidden="true">예</span>{commit.author}</div><dl><dt>SHA</dt><dd>{commit.hash}</dd><dt>브랜치</dt><dd>{commit.branch}</dd><dt>날짜</dt><dd>{commit.date}</dd></dl><h3 className="detail-sub">변경 파일 <span className="num">1</span></h3><div className="file-item"><span className="file-status">M</span>{commit.file}</div><div className="diff-small" aria-label="예제 코드 변경"><div className="diff-del">− // 이전 UI</div><div className="diff-add">+ // {commit.message}</div></div></> : <EmptyState />}</aside>
}

export function ApplyTray({ count, onApply, disabled = false }: { count: number; onApply: () => void; disabled?: boolean }) {
  return <div className="apply-tray"><div><strong><span className="num">{count}</span>개 변경 선택</strong><small>예제 · 실제 저장소에 반영되지 않습니다</small></div><Button variant="primary" disabled={disabled || count === 0} onClick={onApply}>변경 사항 적용</Button></div>
}

export function Workspace({ loading = false, error = false }: { loading?: boolean; error?: boolean }) {
  const [viewBranch, setViewBranch] = useState<string | null>(null)
  const currentBranch = 'feature/branch-filter'
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Commit | null>(null)
  const [includeChange, setIncludeChange] = useState(false)
  const [notice, setNotice] = useState('')
  const [branchError, setBranchError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const visible = exampleCommits.filter(commit => (!viewBranch || commit.branch === viewBranch) && `${commit.message} ${commit.hash} ${commit.author} ${commit.file}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  function changeBranch(branch: string | null) { setViewBranch(branch); setSelected(null); setIncludeChange(false) }
  return <div className="bl-app">
    <header className="appbar"><Brand /><div className="repo-tab"><code>branchline-desktop</code><Badge>예제</Badge></div><div className="bl-toolbar" aria-label="예제 저장소 도구"><ToolbarButton icon={<svg className="ico" viewBox="0 0 24 24"><path d="M12 3v11m0 0-4-4m4 4 4-4M4 19h16" /></svg>} onClick={() => setNotice('예제 · 원격 이력을 확인했습니다. 실제 fetch는 실행하지 않습니다.')}>Fetch</ToolbarButton><ToolbarButton icon={<svg className="ico" viewBox="0 0 24 24"><path d="M12 20V9m0 0-4 4m4-4 4 4M4 4h16" /></svg>} disabled title="디자인 검토 단계에서는 Push를 사용할 수 없습니다">Push</ToolbarButton><ToolbarButton icon={<svg className="ico" viewBox="0 0 24 24"><path d="M6 3v18M18 3v5c0 5-12 3-12 9" /></svg>} onClick={() => dialog.current?.showModal()}>Branch</ToolbarButton></div></header>
    <div className="shell"><aside className="sidebar"><div><p className="bl-kicker">WORKSPACE</p><div className="current-branch-indicator"><code>{currentBranch}</code></div><small>현재 체크아웃</small></div><BranchTree branches={exampleBranches} value={viewBranch} currentBranch={currentBranch} onChange={changeBranch} /><div className="sidebar-footer">Design system <span className="num">0.1</span><br />탐색 / 작업 / 상세</div></aside>
      <main className="workspace"><div className="workspace-head"><div className="bl-kicker">BRANCHLINE / HISTORY</div><div className="bl-row"><h1>커밋 그래프</h1><Badge>예제</Badge></div><p>브랜치의 흐름을 살펴보고, 커밋을 선택해 변경 내용을 확인하세요.</p></div>
        {notice && <Notice>{notice}</Notice>}
        <div className="work-split"><section className="history" aria-label="커밋 탐색"><div className="filterbar"><TextField label="커밋 검색" type="search" placeholder="메시지, 해시, 작성자, 파일" value={query} onChange={event => { setQuery(event.target.value); setSelected(null); setIncludeChange(false) }} /><BranchFilter branches={exampleBranches} value={viewBranch} onChange={changeBranch} /></div><p className="result-meta"><span className="num">{visible.length}</span>개 커밋 · 조회: <code>{viewBranch ?? '전체 브랜치'}</code></p>
          {loading ? <Notice>예제 · 커밋 이력을 불러오는 중입니다…</Notice> : error ? <EmptyState title="커밋 이력을 불러오지 못했습니다">예제 오류 상태입니다. 실제 앱에서는 저장소 연결을 확인하고 다시 시도합니다.</EmptyState> : <CommitList commits={visible} selectedHash={selected?.hash ?? null} onSelect={commit => { setSelected(commit); setIncludeChange(false) }} />}
          <div className="bl-preview-note">예제 이력 레인 · 실제 Git 부모 관계를 계산하는 그래프는 후속 구현 대상입니다.</div>
          <div className="bl-preview-note"><Checkbox label="선택한 커밋의 예제 변경 포함" checked={includeChange} disabled={!selected} onChange={event => setIncludeChange(event.target.checked)} /></div>
          <ApplyTray count={includeChange ? 1 : 0} onApply={() => { setNotice('예제 변경을 적용했습니다. 실제 파일은 변경되지 않았습니다.'); setIncludeChange(false) }} />
        </section><DetailPanel commit={selected} /></div>
      </main></div><footer className="statusbar"><span>로컬 예제 데이터</span><span>HEAD <code>{currentBranch}</code></span><span className="right">React 컴포넌트 프리뷰</span></footer>
    <Dialog dialogRef={dialog} title="브랜치 만들기"><form noValidate onSubmit={event => { event.preventDefault(); const name = String(new FormData(event.currentTarget).get('branch') || ''); if (!/^[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(name)) { setBranchError('브랜치 이름 형식을 확인하세요.'); event.currentTarget.querySelector('input')?.focus(); return } setBranchError(''); setNotice(`예제 · ${name} 브랜치 생성 요청을 확인했습니다. 실제 브랜치는 생성하지 않습니다.`); dialog.current?.close(); event.currentTarget.reset() }}><p>폼과 다이얼로그 동작을 검토하는 예제입니다.</p><TextField name="branch" error={branchError || undefined} label="새 브랜치 이름" placeholder="feature/new-work" required pattern={String.raw`[A-Za-z0-9][A-Za-z0-9\/_\-]*`} hint="예제 입력 형식: 영문, 숫자, /, _, -" /><div className="row"><Button onClick={() => dialog.current?.close()}>취소</Button><Button type="submit" variant="primary">예제 생성</Button></div></form></Dialog>
  </div>
}
