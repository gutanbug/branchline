import { createRef, useEffect, useState, type ReactElement } from 'react'
import { Badge, BranchComparison, Button, ChangeFileList, CodeDiff, CommitMetadata, ContextMenu, Disclosure, EmptyState, IconButton, InspectorPanel, type GraphScrollPeer, ModeSelector, Notice, Pagination, SelectField } from '../../design-system'
import { ComparisonReview } from '../hosting/ComparisonReview'
import type { ReviewPush } from './RemoteWorkspace'
import { HistoryGraph } from './HistoryGraph'
import type { Commit, ComparedFile, Comparison, DesktopAPI, Mutation, Repository, Tab } from '../../app/types'
import { operationLabel } from './operation'
const label = (ref: string) => ref.replace(/^refs\/(heads|remotes)\//, '')
const membershipLabels = { common: '양쪽 공통', source: '가져올 쪽에만', target: '반영할 쪽에만', neither: '비교 범위 밖' } as const
const fileStatus: Record<string, string> = { A: '추가', D: '삭제', M: '수정', R: '이름 변경', C: '복사', T: '유형 변경' }

function ComparedFilePreview({ api, path, from, to, file }: { api: DesktopAPI; path: string; from: string; to: string; file: ComparedFile }) {
  const [result, setResult] = useState<Awaited<ReturnType<DesktopAPI['compareFile']>>>(), [error, setError] = useState('')
  useEffect(() => {
    let live = true
    api.compareFile(path, { from, to, file: file.path, originalPath: file.originalPath }).then(result => { if (live) setResult(result) }).catch(error => { if (live) setError(error.message) })
    return () => { live = false }
  }, [api, path, from, to, file.path, file.originalPath])
  return <section className="bl-review-patch" aria-label="선택한 파일 변경">
    {result?.patch ? <InspectorPanel title={file.path} integratedToolbar>{(_expanded, actions) => <CodeDiff filename={file.path} value={result.patch} actions={actions} />}</InspectorPanel>
      : <><h4 className="bl-path">{file.path}</h4><Notice tone={error ? 'error' : 'info'}>{error || result?.notice || (result ? '표시할 변경 내용이 없습니다.' : '파일 변경을 불러오는 중…')}</Notice></>}
  </section>
}

function ComparisonFiles({ api, path, files, from, to }: { api: DesktopAPI; path: string; files: ComparedFile[]; from: string; to: string }) {
  const [selected, setSelected] = useState('')
  const file = files.find(file => file.path === selected)
  return <div className="bl-review-files"><ChangeFileList label="변경 파일" paths={files.map(file => file.path)} empty="파일 차이가 없습니다." renderFile={(index, view) => {
    const row = files[index]
    return <Button variant="ghost" className="bl-host-list-item" aria-label={row.path} aria-pressed={selected === row.path} onClick={() => setSelected(row.path)}><span><strong title={row.path}>{view === 'tree' ? row.path.split('/').at(-1) : row.path}</strong>{row.originalPath && <small>이전 경로 {row.originalPath}</small>}</span><Badge>{fileStatus[row.status] || row.status}</Badge></Button>
  }} />{file ? <ComparedFilePreview key={file.path} api={api} path={path} from={from} to={to} file={file} /> : files.length > 0 && <EmptyState title="변경 파일을 선택하세요">선택한 파일의 변경 내용을 여기에 표시합니다.</EmptyState>}</div>
}

export function ComparisonWorkspace({ api, repo, tab, busy, active, reviewAfterCommit, onTab, onAction, onPush }: { onPush: ReviewPush; reviewAfterCommit?: boolean; api: DesktopAPI; repo: Repository; tab: Tab; busy: boolean; active: boolean; onTab: (value: Partial<Tab>) => void; onAction: (input: Partial<Mutation>) => void }) {
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0), [selected, setSelected] = useState<string | null>(null), [focus, setFocus] = useState({ sha: '', visit: 0 })
  const [result, setResult] = useState<{ key: string; scope: string; fileMode?: string; value?: Comparison; error?: string } | null>(null)
  const [detail, setDetail] = useState<{ key: string; value?: Awaited<ReturnType<DesktopAPI['compareCommit']>>; error?: string } | null>(null)
  const [scrollLinks] = useState(() => {
    const source = createRef<GraphScrollPeer>(), target = createRef<GraphScrollPeer>()
    return { source: { self: source, peer: target }, target: { self: target, peer: source } }
  })
  const scope = JSON.stringify([repo.path, tab.a, tab.b])
  const key = JSON.stringify([tab.a, tab.b, tab.mode, tab.diffMode, page, repo.token, retry])
  const value = result?.scope === scope ? result.value : undefined, error = result?.key === key ? result.error : ''
  useEffect(() => {
    if (!active || !tab.a || !tab.b) return
    let live = true
    api.compare(repo.path, { a: tab.a, b: tab.b, mode: tab.mode, diffMode: tab.diffMode, offset: (page - 1) * 100 }).then(value => { if (live) setResult({ key, scope, fileMode: tab.diffMode, value }) }).catch(error => { if (live) setResult(previous => ({ ...(previous?.scope === scope ? previous : null), key, scope, error: error.message })) })
    return () => { live = false }
  }, [api, active, repo.path, key, scope, tab.a, tab.b, tab.mode, tab.diffMode, page])
  const a = value?.a, b = value?.b
  const detailKey = JSON.stringify([repo.path, selected, a, b])
  useEffect(() => {
    if (!selected || !active || !a || !b) return
    let live = true
    api.compareCommit(repo.path, selected, { a, b }).then(value => { if (live) setDetail({ key: detailKey, value }) }).catch(error => { if (live) setDetail({ key: detailKey, error: error.message }) })
    return () => { live = false }
  }, [api, active, repo.path, selected, a, b, detailKey])
  function change(patch: Partial<Tab>) { setPage(1); setSelected(null); setFocus({ sha: '', visit: 0 }); onTab(patch) }
  const options = [{ value: '', label: '브랜치 선택' }, ...repo.refs.map(ref => ({ value: ref.ref, label: ref.name })), ...(!repo.branch && repo.head ? [{ value: repo.head, label: `detached HEAD · ${repo.head.slice(0, 8)}` }] : [])]
  const selectedDetail = detail?.key === detailKey ? detail : null, picked = selectedDetail?.value
  const blocked = busy ? 'Git 작업이 진행 중입니다.' : result?.key !== key || error ? '비교 결과를 새로고침하세요.' : repo.operation ? `${operationLabel(repo.operation)} 작업을 먼저 마치세요.` : repo.files.length ? '변경 사항을 커밋하거나 Stash에 보관하세요.' : !repo.branch || !repo.head ? '로컬 브랜치를 체크아웃하세요.' : ''
  const badge = picked?.membership && <Badge variant={picked.membership === 'common' ? 'neutral' : 'branch'}>{value?.shallow ? '로컬 이력 · ' : ''}{membershipLabels[picked.membership]}</Badge>
  const targetCheckedOut = !!repo.branch && tab.b === `refs/heads/${repo.branch}` && value?.b === repo.head
  const sameTip = value?.a === repo.head ? '현재 HEAD와 같은 커밋입니다.' : ''
  const rebaseReason = blocked || sameTip
  const mergeReason = blocked || (!targetCheckedOut ? '반영할 로컬 브랜치를 체크아웃하세요.' : sameTip)
  function commitRow(commit: Pick<Commit, 'sha' | 'message' | 'parents'>, row: ReactElement) {
    const reason = blocked || (commit.sha === repo.head ? '현재 HEAD와 같은 커밋입니다.' : '')
    return <div className="bl-commit-actions-row" key={commit.sha}>
      <ContextMenu label={`커밋 ${commit.sha.slice(0, 8)}`} onOpen={() => setSelected(commit.sha)} showButton={selected === commit.sha} groups={[[
        { label: 'Cherry-pick…', hint: reason || `현재 ${repo.branch}에 이 커밋의 변경 적용`, disabled: !!reason,
          onClick: () => onAction({ action: 'cherry-pick', base: commit.sha, message: commit.message, parents: commit.parents }) },
        { label: '이 커밋 위로 Rebase…', hint: reason || `현재 ${repo.branch}의 커밋을 다시 적용`, disabled: !!reason,
          onClick: () => onAction({ action: 'rebase', base: commit.sha, message: commit.message }) },
      ]]}>{row}</ContextMenu>
    </div>
  }
  function graph(sha: string, name: string, side: 'source' | 'target') {
    const base = value?.bases.includes(focus.sha) ? focus.sha : value?.bases[0]
    return <HistoryGraph label={name} overview={false} key={sha} api={api} repo={{ ...repo, refs: value ? [{ ref: tab.a, name: label(tab.a), sha: value.a }, { ref: tab.b, name: label(tab.b), sha: value.b }, ...value.bases.map(sha => ({ ref: sha, name: '공통 조상', sha }))] : [] }} tab={{ ref: sha, query: '', author: '', file: '', after: '', before: '' }} selected={selected} onSelect={setSelected} renderRow={commitRow} selectedBadge={badge} paused={!active} scrollLink={base ? scrollLinks[side] : undefined} focusSha={base} focusKey={focus.visit} />
  }
  return <section className="bl-comparison-workspace" aria-label="브랜치 비교 작업">
    <div className="bl-comparison-controls">
      <SelectField label="가져올 브랜치" value={tab.a} onChange={a => change({ a })} options={options} />
      <Button aria-label="가져올 브랜치와 반영할 브랜치 교환" onClick={() => change({ a: tab.b, b: tab.a })}>방향 교환 ⇄</Button>
      <SelectField label="반영할 브랜치" value={tab.b} onChange={b => change({ b })} options={options} />
      <IconButton icon="refresh" label="비교 새로고침" disabled={busy || !tab.a || !tab.b || !result || result.key !== key} onClick={() => setRetry(value => value + 1)} />
    </div>
    {value && <div className="bl-comparison-actions" role="group" aria-label="브랜치 작업">
      <Button disabled={!!mergeReason} title={mergeReason || `${label(tab.a)} → ${label(tab.b)} Merge`} onClick={() => onAction({ action: 'merge', ref: tab.a, base: value.a })}>현재 브랜치에 Merge…</Button>
      <Button disabled={!!rebaseReason} title={rebaseReason || `현재 브랜치를 ${label(tab.a)} 위로 Rebase`} onClick={() => onAction({ action: 'rebase', ref: tab.a, base: value.a })}>현재 브랜치를 Rebase…</Button>
      {tab.b.startsWith('refs/heads/') && tab.b !== `refs/heads/${repo.branch}` && <Button disabled={busy || !!repo.operation || repo.files.some(file => file.conflict)} title={`${label(tab.b)} 체크아웃`} onClick={() => onAction({ action: 'switch', ref: tab.b })}>반영할 브랜치 체크아웃</Button>}
      {(mergeReason || rebaseReason) && <small className="bl-muted">{mergeReason && rebaseReason === mergeReason ? mergeReason : [mergeReason && `Merge: ${mergeReason}`, rebaseReason && `Rebase: ${rebaseReason}`].filter(Boolean).join(' · ')}</small>}
    </div>}
    {!tab.a || !tab.b ? <EmptyState decorated title="비교할 두 브랜치를 선택하세요">가져올 변경과 반영할 위치를 선택하면 두 그래프와 파일 차이를 함께 볼 수 있습니다.</EmptyState> : !value ? <>{error ? <Notice tone="error">{error}<Button onClick={() => setRetry(value => value + 1)}>비교 다시 시도</Button></Notice> : <Notice>두 브랜치의 이력과 파일 차이를 확인하고 있습니다…</Notice>}</> : <>
      {error && <Notice tone="error">{error}<Button onClick={() => setRetry(value => value + 1)}>비교 다시 시도</Button></Notice>}{result?.key !== key && <Notice compact>비교 갱신 중 · 이전 조회 결과를 표시하고 있습니다.</Notice>}
      <Disclosure title="PR/MR 만들기" initiallyOpen={reviewAfterCommit} lazy><ComparisonReview api={api} path={repo.path} repoToken={repo.token} blocked={busy || !active} onPush={onPush} source={tab.a} target={tab.b} sourceSha={value.a} targetSha={value.b} /></Disclosure>
      <BranchComparison source={{ name: label(tab.a), sha: value.a, count: value.aOnly, graph: graph(value.a, '가져올 이력', 'source') }} target={{ name: label(tab.b), sha: value.b, count: value.bOnly, graph: graph(value.b, '반영할 이력', 'target') }} bases={value.bases} shallow={value.shallow} onBase={sha => { setSelected(sha); setFocus({ sha, visit: Date.now() }) }} />
      {tab.a === tab.b && <Notice>같은 브랜치를 선택했습니다. 다른 브랜치를 선택하면 차이를 확인할 수 있습니다.</Notice>}
      {selected && <InspectorPanel title="선택 커밋 변경" summary={<div className="bl-actions"><code title={selected}>{selected.slice(0, 12)}</code>{badge}</div>} onClose={() => setSelected(null)}>{!selectedDetail ? <Notice>선택 커밋을 확인하고 있습니다…</Notice> : selectedDetail.error ? <Notice tone="error">{selectedDetail.error}</Notice> : picked && <><CommitMetadata value={picked.metadata} /><ComparisonFiles key={selected} api={api} path={repo.path} from={picked.diffBase} to={selected} files={picked.files} /></>}</InspectorPanel>}
      <Disclosure title="브랜치 파일 변경" initiallyOpen><ModeSelector label="파일 차이 계산" value={tab.diffMode} onChange={diffMode => change({ diffMode })} options={[['endpoints', '두 브랜치 끝 비교'], ['introduced', '공통 조상 이후 변경']]} />{result?.fileMode !== tab.diffMode ? (!error && <Notice compact>파일 차이를 불러오는 중…</Notice>) : value.diffBase && !value.diffError ? <ComparisonFiles key={JSON.stringify([repo.path, value.diffBase, value.a])} api={api} path={repo.path} from={value.diffBase} to={value.a} files={value.files} /> : <Notice>{value.diffError}</Notice>}</Disclosure>
      <Disclosure title="커밋 범위별 목록" lazy><ModeSelector label="표시할 커밋" value={tab.mode} onChange={mode => change({ mode })} options={[['a', '가져올 쪽에만'], ['b', '반영할 쪽에만'], ['different', '한쪽에만'], ['common', '양쪽 공통'], ['all', '전체 이력']]} /><div className="bl-real-commits">{value.commits.map(commit => commitRow(commit, <Button variant="ghost" className="bl-real-commit" key={commit.sha} aria-pressed={selected === commit.sha} onClick={() => setSelected(selected === commit.sha ? null : commit.sha)}><Badge>{commit.sha.slice(0, 8)}</Badge><span><strong>{commit.message}</strong><small>{commit.author} {selected === commit.sha && badge}</small></span></Button>))}</div>{!value.commits.length && <EmptyState title="선택한 범위에 커밋이 없습니다">다른 범위를 선택해 이력을 확인하세요.</EmptyState>}<Pagination label="비교 커밋 페이지" page={page} busy={busy} hasMore={value.hasMore} onChange={page => { setPage(page); setSelected(null) }} /></Disclosure>
    </>}
  </section>
}
