import { useEffect, useState } from 'react'
import { Badge, BranchComparison, Button, CodeDiff, Disclosure, EmptyState, InspectorPanel, Notice, Pagination, SelectField } from '../../design-system'
import { ComparisonReview } from '../hosting/ComparisonReview'
import { HistoryGraph } from './HistoryGraph'
import type { Commit, Comparison, DesktopAPI, Mutation, Repository, Tab } from '../../app/types'
const label = (ref: string) => ref.replace(/^refs\/(heads|remotes)\//, '')
export function ComparisonWorkspace({ api, repo, tab, busy, active, onTab, onAction }: { api: DesktopAPI; repo: Repository; tab: Tab; busy: boolean; active: boolean; onTab: (value: Partial<Tab>) => void; onAction: (input: Partial<Mutation>) => void }) {
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0), [selected, setSelected] = useState<string | null>(null), [focus, setFocus] = useState({ sha: '', visit: 0 })
  const [result, setResult] = useState<{ key: string; scope: string; value?: Comparison; error?: string } | null>(null)
  const [detail, setDetail] = useState<{ sha: string; diff: string; commit?: Commit; error?: string } | null>(null)
  const scope = JSON.stringify([tab.a, tab.b])
  const key = JSON.stringify([tab.a, tab.b, tab.mode, tab.diffMode, page, repo.token, retry])
  const value = result?.scope === scope ? result.value : undefined, error = result?.key === key ? result.error : ''
  useEffect(() => {
    if (!active || !tab.a || !tab.b) return
    let live = true
    api.compare(repo.path, { a: tab.a, b: tab.b, mode: tab.mode, diffMode: tab.diffMode, offset: (page - 1) * 100 }).then(value => { if (live) setResult({ key, scope, value }) }).catch(error => { if (live) setResult(previous => ({ key, scope, value: previous?.scope === scope ? previous.value : undefined, error: error.message })) })
    return () => { live = false }
  }, [api, active, repo.path, key, scope, tab.a, tab.b, tab.mode, tab.diffMode, page])
  useEffect(() => {
    if (!selected || !active) return
    let live = true
    Promise.all([api.diff(repo.path, { sha: selected }), api.history(repo.path, { ref: selected })]).then(([diff, history]) => { if (live) setDetail({ sha: selected, diff, commit: history.commits[0] }) }).catch(error => { if (live) setDetail({ sha: selected, diff: '', error: error.message }) })
    return () => { live = false }
  }, [api, active, repo.path, selected])
  function change(patch: Partial<Tab>) { setPage(1); setSelected(null); setFocus({ sha: '', visit: 0 }); onTab(patch) }
  const options = [{ value: '', label: '브랜치 선택' }, ...repo.refs.map(ref => ({ value: ref.ref, label: ref.name })), ...(!repo.branch && repo.head ? [{ value: repo.head, label: `detached HEAD · ${repo.head.slice(0, 8)}` }] : [])]
  const selectedDetail = detail?.sha === selected ? detail : null
  const canApply = result?.key === key && !error && !!repo.branch && !!repo.head && !repo.operation && !repo.files.length && !busy
  const targetCheckedOut = !!repo.branch && tab.b === `refs/heads/${repo.branch}` && value?.b === repo.head
  function graph(sha: string, name: string) {
    return <HistoryGraph label={name} overview={false} key={sha} api={api} repo={{ ...repo, refs: value ? [{ ref: tab.a, name: label(tab.a), sha: value.a }, { ref: tab.b, name: label(tab.b), sha: value.b }, ...value.bases.map(sha => ({ ref: sha, name: '공통 조상', sha }))] : [] }} tab={{ ref: sha, query: '', author: '', file: '', after: '', before: '' }} selected={selected} onSelect={setSelected} paused={!active} focusSha={focus.sha} focusKey={focus.visit} />
  }
  return <section className="bl-comparison-workspace" aria-label="브랜치 비교 작업">
    <div className="bl-comparison-controls"><SelectField label="가져올 브랜치" value={tab.a} onChange={a => change({ a })} options={options} /><Button aria-label="가져올 브랜치와 반영할 브랜치 교환" onClick={() => change({ a: tab.b, b: tab.a })}>방향 교환 ⇄</Button><SelectField label="반영할 브랜치" value={tab.b} onChange={b => change({ b })} options={options} /><Button disabled={busy || !tab.a || !tab.b || !result || result.key !== key} onClick={() => setRetry(value => value + 1)}>비교 새로고침</Button></div>
    <p className="bl-muted">{label(tab.a) || '가져올 브랜치'} → {label(tab.b) || '반영할 브랜치'} · 비교만으로 체크아웃하지 않습니다.</p>
    {!tab.a || !tab.b ? <EmptyState title="비교할 두 브랜치를 선택하세요">가져올 변경과 반영할 위치를 선택하면 두 그래프와 파일 차이를 함께 볼 수 있습니다.</EmptyState> : !value ? <>{error ? <Notice tone="error">{error}<Button onClick={() => setRetry(value => value + 1)}>비교 다시 시도</Button></Notice> : <Notice>두 브랜치의 이력과 파일 차이를 확인하고 있습니다…</Notice>}</> : <>
      {error && <Notice tone="error">{error}<Button onClick={() => setRetry(value => value + 1)}>비교 다시 시도</Button></Notice>}{result?.key !== key && <Notice compact>비교 갱신 중 · 이전 조회 결과를 표시하고 있습니다.</Notice>}
      <BranchComparison source={{ name: label(tab.a), sha: value.a, count: value.aOnly, graph: graph(value.a, "가져올 이력") }} target={{ name: label(tab.b), sha: value.b, count: value.bOnly, graph: graph(value.b, "반영할 이력") }} bases={value.bases} shallow={value.shallow} onBase={sha => { setSelected(sha); setFocus({ sha, visit: Date.now() }) }} />
      {tab.a === tab.b && <Notice>같은 브랜치를 선택했습니다. 다른 브랜치를 선택하면 차이를 확인할 수 있습니다.</Notice>}
      <div className="bl-comparison-actions"><strong>로컬 적용 위치: {repo.branch || 'detached HEAD'}</strong><Button disabled={!canApply || !targetCheckedOut || value.a === repo.head} onClick={() => onAction({ action: 'merge', ref: tab.a, base: value.a })}>{label(tab.a)} → {label(tab.b)} Merge</Button><Button disabled={!canApply || value.a === repo.head} onClick={() => onAction({ action: 'rebase', ref: tab.a, base: value.a })}>현재 브랜치를 {label(tab.a)} 위로 Rebase</Button></div>
      {!targetCheckedOut && <Notice compact>Merge는 반영할 로컬 브랜치를 체크아웃한 뒤 실행하세요.{tab.b.startsWith('refs/heads/') && tab.b !== `refs/heads/${repo.branch}` && <Button disabled={busy || !!repo.operation || repo.files.some(file => file.conflict)} onClick={() => onAction({ action: 'switch', ref: tab.b })}>{label(tab.b)} 체크아웃</Button>}</Notice>}
      {!canApply && <Notice compact>{repo.operation ? `${repo.operation} 작업을 먼저 마치세요.` : repo.files.length ? 'Merge·Rebase·Cherry-pick 전에는 변경 사항을 커밋하거나 Stash에 보관하세요. 체크아웃은 자동 Stash 후 복원합니다.' : !repo.branch ? '로컬 적용에는 브랜치 체크아웃이 필요합니다.' : 'Git 작업 결과를 기다리고 있습니다.'}</Notice>}
      {selected && <InspectorPanel title="선택 커밋 변경" summary={<div className="bl-actions"><code title={selected}>{selected.slice(0, 12)}</code><Button disabled={!canApply || !selectedDetail?.commit || selected === repo.head} onClick={() => onAction({ action: 'cherry-pick', base: selected, message: selectedDetail?.commit?.message, parents: selectedDetail?.commit?.parents })}>현재 {repo.branch || '브랜치'}에 Cherry-pick</Button></div>} onClose={() => setSelected(null)}>{!selectedDetail ? <Notice>선택 커밋을 확인하고 있습니다…</Notice> : selectedDetail.error ? <Notice tone="error">{selectedDetail.error}</Notice> : <CodeDiff value={selectedDetail.diff} />}</InspectorPanel>}
      <Disclosure title="PR/MR 만들기"><ComparisonReview api={api} path={repo.path} source={tab.a} target={tab.b} sourceSha={value.a} targetSha={value.b} /></Disclosure>
      <Disclosure title="브랜치 파일 변경" initiallyOpen><SelectField label="파일 차이 계산" value={tab.diffMode} onChange={diffMode => change({ diffMode })} options={[{ value: 'endpoints', label: '반영할 브랜치 → 가져올 브랜치의 현재 파일 차이' }, { value: 'introduced', label: '공통 조상 이후 가져올 브랜치의 변경' }]} />{value.diffError ? <Notice>{value.diffError}</Notice> : <CodeDiff value={value.diff || '파일 차이가 없습니다.'} />}</Disclosure>
      <Disclosure title="커밋 범위별 목록"><SelectField label="표시할 커밋" value={tab.mode} onChange={mode => change({ mode })} options={[{ value: 'a', label: '가져올 브랜치에만 있는 커밋' }, { value: 'b', label: '반영할 브랜치에만 있는 커밋' }, { value: 'different', label: '양쪽에서 서로 다른 커밋' }, { value: 'common', label: '두 브랜치의 공통 이력' }, { value: 'all', label: '두 브랜치의 전체 이력' }]} /><div className="bl-real-commits">{value.commits.map(commit => <Button variant="ghost" className="bl-real-commit" key={commit.sha} aria-pressed={selected === commit.sha} onClick={() => setSelected(selected === commit.sha ? null : commit.sha)}><Badge>{commit.sha.slice(0, 8)}</Badge><span><strong>{commit.message}</strong><small>{commit.author}</small></span></Button>)}</div>{!value.commits.length && <EmptyState title="선택한 범위에 커밋이 없습니다">다른 범위를 선택해 이력을 확인하세요.</EmptyState>}<Pagination label="비교 커밋 페이지" page={page} busy={busy} hasMore={value.hasMore} onChange={page => { setPage(page); setSelected(null) }} /></Disclosure>
    </>}
  </section>
}
