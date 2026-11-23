import type { ReadingSession } from './ReviewFiles'
import { HostLink } from './HostLink'
import { useNavigationBookmark } from '../../app/useNavigationBookmark'
import { ToastMessage } from '../../design-system'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Badge, Button, IconButton, LinkedRow, MarkdownContent, ReviewListRow, ReviewDetailLayout, Disclosure, EmptyState, PageHeader, Notice, Pagination, SelectField } from '../../design-system'
import { ReviewFilters } from './ReviewFilters'
import { HostActions } from './HostActions'
import { headLabel } from '../../app/headLabel'
import { isLocalRemote, remoteProject } from './remoteProject'
import { AccountConnections } from './AccountConnections'
import { ReviewReadiness } from './ReviewReadiness'
import { ReviewResources } from './ReviewResources'
import { useHostRead, stamp, status, defaultReviewFilter } from './queries'
import type { DesktopAPI, HostAccount, HostAccounts, HostItem, HostWriteResult, Repository, SyncSnapshot } from '../../app/types'

function RunDetail({ item }: { item: HostItem }) {
  return <dl className="bl-facts"><dt>실행 상태</dt><dd>{status(item.state)}</dd><dt>결론</dt><dd>{item.conclusion ? status(item.conclusion) : '별도 값 미제공'}</dd><dt>실행 SHA</dt><dd><code>{item.sha || '미제공'}</code></dd><dt>브랜치 / ref</dt><dd>{item.source || '미제공'}</dd><dt>실행 원인</dt><dd>{item.event || '미제공'}</dd><dt>실행 회차</dt><dd>{item.attempt ?? '제공되지 않음'}</dd><dt>업데이트</dt><dd>{stamp(item.date)}</dd></dl>
}
function Jobs({ api, account, project, run }: { api: DesktopAPI; account: string; project: string; run: HostItem }) {
  const [page, setPage] = useState(1)
  const result = useHostRead(api, { account, project, kind: 'jobs', id: run.id, attempt: run.attempt ?? undefined, page })
  return <section aria-label="CI 작업 목록"><div className="bl-row-between"><h3>작업 / Jobs</h3><IconButton icon="refresh" label="작업 새로고침" loading={result.busy} onClick={result.refresh} /></div>
    {result.busy && <Notice>작업을 조회하고 있습니다…</Notice>}{result.error && <Notice tone="error">{result.error}</Notice>}
    {result.value && <><small>조회 {stamp(result.value.checkedAt)} · GitHub는 선택 회차, GitLab은 재시도 작업 포함</small>{!result.value.items.length && <EmptyState title="조회된 작업이 없습니다">아직 작업이 생성되지 않았거나 조회 범위에 작업이 없습니다.</EmptyState>}{result.value.items.map(job => <article className="bl-host-account" key={job.id}><div><h3>{job.title}</h3><p>{status(job.state)} · {job.conclusion ? status(job.conclusion) : '별도 결론 미제공'}{job.allowFailure ? ' · 실패 허용' : ''}</p><small>{job.subtitle} · #{job.id}</small></div>{job.url && <HostLink api={api} account={account} url={job.url} label={`${job.title} 로그·상세 열기`} />}</article>)}</>}
    <Pagination label="CI 작업 페이지" page={page} hasMore={!!result.value?.hasMore} busy={result.busy} onChange={setPage} />
  </section>
}
const emptyFeed = { ...defaultReviewFilter, page: 1, selected: '', list: 0, detail: 0 }
type FeedBookmark = ReturnType<typeof useNavigationBookmark<typeof emptyFeed>>

function useFeedScroll(container: RefObject<HTMLElement | null>, bookmark: FeedBookmark, slot: 'list' | 'detail', ready: boolean) {
  useLayoutEffect(() => {
    const root = container.current, scroller = root?.closest<HTMLElement>('.bl-desktop-main')
    if (!ready || !root || !scroller) return
    const top = bookmark.value[slot]
    let pending = true
    const restore = () => {
      if (!pending) return
      scroller.scrollTop = top
      pending = Math.abs(scroller.scrollTop - top) > 1
    }
    const remember = () => {
      if (!pending && scroller.clientHeight && root.getClientRects().length) bookmark.update({ [slot]: Math.round(scroller.scrollTop) }, true)
    }
    const saveOnExit = () => { remember(); bookmark.flush() }
    const interact = () => { pending = false }
    const observer = new ResizeObserver(restore)
    restore(); observer.observe(root); observer.observe(scroller)
    scroller.addEventListener('scroll', remember)
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) scroller.addEventListener(event, interact, { passive: true })
    window.addEventListener('beforeunload', saveOnExit)
    window.addEventListener('pagehide', saveOnExit)
    return () => {
      observer.disconnect(); scroller.removeEventListener('scroll', remember)
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) scroller.removeEventListener(event, interact)
      window.removeEventListener('beforeunload', saveOnExit)
      window.removeEventListener('pagehide', saveOnExit)
      // The DOM may already contain the short loading view. Only flush the last reading position.
      bookmark.flush()
      scroller.scrollTop = 0
    }
  }, [container, bookmark, slot, ready])
}
function Detail({ bookmark, repoPath, api, account, project, kind, id, merged, onMerge, active }: { bookmark: FeedBookmark; repoPath: string; active: boolean; api: DesktopAPI; account: HostAccount; project: string; kind: 'review' | 'run'; id: string; merged: boolean; onMerge: (result: HostWriteResult) => void }) {
  const result = useHostRead(api, { account: account.key, project, kind, id })
  const [readingSession] = useState<ReadingSession>(() => ({}))
  const current = result.value?.items[0]
  const item = current && merged && current.state !== 'merged' ? { ...current, state: 'merged' } : current
  const detail = useRef<HTMLElement>(null)
  useFeedScroll(detail, bookmark, 'detail', active && !!item)
  useEffect(() => { detail.current?.focus({ preventScroll: true }) }, [id])
  const refresh = <IconButton icon="refresh" label="상세 새로고침" loading={result.busy} onClick={result.refresh} />
  return <section ref={detail} tabIndex={-1} className="bl-host-detail" aria-label={kind === 'review' ? 'PR/MR 상세' : 'CI 실행 상세'}>
    {result.busy && <Notice>상세 정보를 조회하고 있습니다…</Notice>}{result.error && <Notice tone="error">{result.error}{refresh}</Notice>}
    {item && (kind === 'review' ? <ReviewDetailLayout title={item.title} identifier={`${account.provider === 'gitlab' ? '!' : '#'}${id}`} status={status(item.state).split(' (')[0]} draft={item.draft} author={item.subtitle || '작성자 미제공'} updated={stamp(item.date)} source={item.source} target={item.target} actions={<>{refresh}{item.url && <HostLink api={api} account={account.key} url={item.url} />}</>} facts={[
      { label: '담당자', value: item.assignees?.join(', ') || '미지정·미제공' },
      { label: '리뷰어', value: item.reviewers?.join(', ') || '미지정·미제공' },
      { label: '서버 병합 상태', value: status(item.merge) },
      { label: '현재 Head', value: <code title={item.sha}>{item.sha?.slice(0, 12) || '미제공'}</code> },
      { label: '조회 계정', value: `${account.host} / ${account.login}` },
      { label: '마지막 조회', value: stamp(result.value?.checkedAt) },
    ]}>
      <ReviewResources session={readingSession} refresh={result.refresh} repoPath={repoPath} api={api} account={account} project={project} item={item} overview={<>
        <section className="bl-review-overview" aria-label="리뷰 본문"><h3>설명</h3><MarkdownContent value={item.body || ''} baseUrl={item.url || `https://${account.host}/`} onOpenLink={url => api.hostingExternal(account.key, url)} />{item.truncated && <Notice>본문은 앞 20,000자만 표시했습니다. 전체 내용은 제공자에서 확인하세요.</Notice>}</section>
        <ReviewReadiness api={api} account={account} project={project} item={item} />
        <HostActions compact active={active} api={api} account={account} project={project} kind="review" item={item} onRefresh={result.refresh} onMerge={outcome => { onMerge(outcome); result.refresh() }} />
        <Disclosure title="커밋 SHA · 비교 기준"><dl className="bl-facts"><dt>Head SHA</dt><dd><code>{item.sha || '미제공'}</code></dd><dt>Base SHA</dt><dd><code>{item.baseSha || '미제공'}</code></dd></dl><p className="bl-muted">승인·검사 상태는 조회한 버전 기준입니다. 최종 병합 가능 여부는 제공자 정책을 확인하세요.</p></Disclosure>
      </>} />
    </ReviewDetailLayout> : <><div className="bl-row-between"><h3>#{id} {item.title}</h3>{refresh}</div><RunDetail item={item} />{item.url && <HostLink api={api} account={account.key} url={item.url} />}<HostActions active={active} api={api} account={account} project={project} kind="run" item={item} onRefresh={result.refresh} />{(account.provider === 'gitlab' || item.attempt) && <Jobs key={`${item.id}:${item.attempt}`} api={api} account={account.key} project={project} run={item} />}</>)}
  </section>
}
function ProjectFeed({ repoPath, api, account, project, kind, active }: { repoPath: string; active: boolean; api: DesktopAPI; account: HostAccount; project: string; kind: 'reviews' | 'runs' }) {
  const bookmark = useNavigationBookmark(kind === 'reviews' && repoPath ? 'review:' + repoPath : '', JSON.stringify([account.key, project]), emptyFeed)
  const [page, setPage] = useState(() => Math.min(10000, bookmark.value.page || 1)), [filter, setFilter] = useState(() => {
    const { ciFilter, state, reviewRole, inactiveDays, titleSearch } = bookmark.value
    return { ciFilter, state, reviewRole, inactiveDays, titleSearch }
  }), [selected, setSelected] = useState(() => /^\d+$/.test(bookmark.value.selected) ? bookmark.value.selected : '')
  useLayoutEffect(() => { bookmark.update({ ...filter, page, selected }) }, [bookmark, page, filter, selected])
  const [mergedIds, setMergedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [mergeFeedback, setMergeFeedback] = useState<{ id: string; result: HostWriteResult } | null>(null)
  if (!active && mergeFeedback) setMergeFeedback(null)
  const listHeading = useRef<HTMLHeadingElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const feedRoot = useRef<HTMLElement>(null)
  function openItem(id: string, trigger: HTMLElement) {
    returnFocus.current = trigger
    bookmark.update({ detail: 0 })
    setSelected(id)
  }
  const result = useHostRead(api, { account: account.key, project, kind, page, ...(kind === 'reviews' ? filter : {}) })
  useFeedScroll(feedRoot, bookmark, 'list', active && !selected && !!result.value)
  const items = result.value?.items || []
  // Hosting search can briefly return an open row after the provider has confirmed its merge.
  const visibleItems = mergedIds.size && filter.state === 'open' ? items.filter(item => !mergedIds.has(item.id)) : items
  const [linkFeedback, setLinkFeedback] = useState<{ label: string; message: string; tone: 'success' | 'error' } | null>(null)
  if ((!active || selected) && linkFeedback) setLinkFeedback(null)
  async function linkAction(action: 'copy' | 'open', label: string, url: string) {
    setLinkFeedback(null)
    try {
      if (action === 'copy') { await api.hostingCopyLink(account.key, url); setLinkFeedback({ label, tone: 'success', message: '링크를 복사했습니다.' }) }
      else await api.hostingExternal(account.key, url)
    } catch (error) { setLinkFeedback({ label, tone: 'error', message: (error as Error).message }) }
  }
  function afterMerge(id: string, outcome: HostWriteResult) {
    if (outcome.merged) setMergedIds(previous => new Set(previous).add(id))
    setMergeFeedback({ id, result: outcome })
    result.refresh()
  }
  const label = kind === 'reviews' ? account.provider === 'github' ? 'Pull Requests' : 'Merge Requests' : account.provider === 'github' ? 'GitHub Actions' : 'GitLab CI'
  return <section ref={feedRoot} className="bl-project-feed" aria-label={label}>
    {linkFeedback && <ToastMessage scope={linkFeedback.label} tone={linkFeedback.tone} message={linkFeedback.message} />}
    {mergeFeedback && <ToastMessage scope={`${project} · ${account.provider === 'gitlab' ? '!' : '#'}${mergeFeedback.id}`} tone={mergeFeedback.result.merged ? 'success' : 'info'} message={mergeFeedback.result.message} />}
    <div hidden={!!selected}>
      <div className="bl-row-between bl-review-feed-heading"><h2 ref={listHeading} tabIndex={-1}>{label}</h2><div className="bl-actions"><IconButton icon="refresh" label={`${label} 새로고침`} loading={result.busy} onClick={result.refresh} />{kind === 'reviews' && <HostActions compact active={active && !selected} api={api} account={account} project={project} kind="create" onRefresh={result.refresh} />}</div></div>
      {kind === 'reviews' && <ReviewFilters value={filter} github={account.provider === 'github'} onOpenReview={openItem} onChange={value => { setFilter(value); setPage(1); setSelected('') }} />}
      {result.value && <div className="bl-review-list-controls"><small>{result.value.ciSummary ? `현재 페이지 ${result.value.ciSummary.inspected}개 확인 · CI 실패 ${visibleItems.length}개 · 미확인 ${result.value.ciSummary.unknown}개` : `현재 페이지 ${visibleItems.length}개`} · 조회 {stamp(result.value.checkedAt)}</small></div>}
      {result.busy && <Notice>{kind === 'reviews' && filter.ciFilter === 'failed' ? '현재 페이지 리뷰의 CI 결과를 확인하고 있습니다…' : '목록을 조회하고 있습니다…'}</Notice>}{result.error && <Notice tone="error">{result.error}</Notice>}
      {result.value && <>{result.value.warnings?.map(warning => <Notice key={warning}>{warning}</Notice>)}{!visibleItems.length && <EmptyState title={result.value.ciSummary ? "이 페이지에서 확인된 CI 실패가 없습니다" : "조회된 항목이 없습니다"}>{result.value.hasMore ? "다음 페이지를 확인하거나 검색·필터를 변경하세요." : "검색·필터를 변경하거나 이전 페이지를 확인하세요."}</EmptyState>}
        <div className="bl-project-feed-list">{visibleItems.map(item => {
          const identifier = `${kind === 'reviews' && account.provider === 'gitlab' ? '!' : '#'}${item.id}`
          const label = `${kind === 'runs' ? 'CI' : account.provider === 'gitlab' ? 'MR' : 'PR'} ${identifier}`
          const row = kind === 'reviews'
            ? <ReviewListRow key={item.id} identifier={identifier} title={item.title} author={item.subtitle || '작성자 미제공'} source={item.source} target={item.target} status={status(mergedIds.has(item.id) ? 'merged' : item.state).split(' (')[0]} draft={item.draft} updated={stamp(item.date)} onClick={event => openItem(item.id, event.currentTarget)} />
            : <Button key={item.id} variant="ghost" className="bl-host-list-item" onClick={event => openItem(item.id, event.currentTarget)}><span><strong>#{item.id} {item.title}</strong><small>{item.subtitle} {item.source} · {stamp(item.date)}</small>{item.sha && <small>SHA {item.sha}</small>}</span><Badge>{status(item.state)}{item.conclusion ? ` / ${status(item.conclusion)}` : ''}</Badge></Button>
          const url = item.url
          return url ? <LinkedRow key={item.id} label={label} onCopy={() => void linkAction('copy', label, url)} onOpen={() => void linkAction('open', label, url)}>{row}</LinkedRow> : row
        })}</div>
      </>}
      <Pagination label={`${label} 페이지`} page={page} hasMore={!!result.value?.hasMore} busy={result.busy} onChange={value => { setPage(value); setSelected('') }} />
    </div>
    {selected && <><IconButton icon="back" label={kind === 'reviews' ? '리뷰 목록으로' : '실행 목록으로'} onClick={() => { setSelected(''); requestAnimationFrame(() => (returnFocus.current?.isConnected ? returnFocus.current : listHeading.current)?.focus({ preventScroll: true })) }} /><Detail bookmark={bookmark} repoPath={repoPath} key={selected} active={active} api={api} account={account} project={project} kind={kind === 'reviews' ? 'review' : 'run'} id={selected} merged={mergedIds.has(selected)} onMerge={outcome => afterMerge(selected, outcome)} /></>}
  </section>
}
function CurrentProject({ repoPath, api, account, project, active }: { repoPath: string; active: boolean; api: DesktopAPI; account: HostAccount; project: string }) {
  const result = useHostRead(api, { account: account.key, kind: 'project', project })
  const [feed, setFeed] = useState<'reviews' | 'runs'>('reviews')
  const item = result.value?.items[0]
  return <>
    {result.busy && <Notice>현재 저장소의 원격 프로젝트를 확인하고 있습니다…</Notice>}
    {result.error && <Notice tone="error">{result.error}<Button onClick={result.refresh}>프로젝트 다시 조회</Button></Notice>}
    {item && <><div className="bl-project-header"><section className="bl-sync-section bl-remote-context"><div className="bl-row-between"><div><h2 className="bl-path">{item.title}</h2><p className="bl-muted">{account.host} / {account.login} · {item.subtitle}</p></div>{item.url && <HostLink api={api} account={account.key} url={item.url} />}</div></section>
      <nav className="bl-view-nav" aria-label="프로젝트 자료"><Button aria-current={feed === 'reviews' ? 'page' : undefined} onClick={() => setFeed('reviews')}>PR / MR 검토</Button><Button aria-current={feed === 'runs' ? 'page' : undefined} onClick={() => setFeed('runs')}>CI 실행</Button></nav></div>
      <div hidden={feed !== 'reviews'}><ProjectFeed repoPath={repoPath} key={item.id} api={api} account={account} project={item.id} kind="reviews" active={active && feed === 'reviews'} /></div>
      {feed === 'runs' && <ProjectFeed repoPath={repoPath} key={item.id} api={api} account={account} project={item.id} kind="runs" active={active} />}
    </>}
  </>
}
const emptyRemote = { remote: '', account: '' }
function RepositoryProject({ persist, api, repo, accounts, revisions, active }: { persist: boolean; api: DesktopAPI; repo: Repository; accounts: HostAccount[]; revisions: Record<string, number>; active: boolean }) {
  const [snapshot, setSnapshot] = useState<SyncSnapshot | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const bookmark = useNavigationBookmark(persist ? 'review-remote:' + repo.path : '', '', emptyRemote)
  const [remoteName, setRemoteName] = useState(() => bookmark.value.remote), [selected, setSelected] = useState(() => bookmark.value.account)
  useLayoutEffect(() => { bookmark.update({ remote: remoteName, account: selected }) }, [bookmark, remoteName, selected])
  useEffect(() => {
    if (!active) return
    let live = true
    api.syncState(repo.path).then(value => { if (live) { setSnapshot(value); setError('') } }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [api, repo.path, repo.token, retry, active])
  const remotes = snapshot?.remotes || []
  const remote = remotes.find(r => r.name === remoteName) || remotes.find(r => r.name === 'origin') || remotes[0]
  const target = remote && remoteProject(remote.fetch)
  const matches = target ? accounts.filter(a => a.host === target.host && (a.provider !== 'github' || target.project.split('/').length === 2)) : []
  const account = matches.find(a => a.key === selected) || (matches.length === 1 ? matches[0] : undefined)
  return <>
    <div className="bl-host-local-context"><div><strong title={repo.path}>{repo.name}</strong><Badge>{headLabel(repo)}</Badge></div>{remotes.length > 1 && <SelectField label="조회할 원격" value={remote?.name || ''} disabled={!!error} onChange={value => { setRemoteName(value); setSelected('') }} options={remotes.map(r => ({ value: r.name, label: r.name }))} />}</div>
    {error ? <Notice tone="error">{error}<Button onClick={() => setRetry(value => value + 1)}>원격 다시 확인</Button></Notice> : !snapshot ? <Notice>저장소 원격을 확인하고 있습니다…</Notice> : !remote ? <EmptyState decorated title="연결된 원격 저장소가 없습니다">내 작업의 원격 설정에서 GitHub/GitLab 원격 주소를 추가하세요.</EmptyState> : <>
      {!target && isLocalRemote(remote.fetch) ? <EmptyState decorated title="호스팅 서비스가 아닌 원격입니다">{remote.name}은 이 컴퓨터의 폴더를 원격으로 사용합니다. PR/MR·CI 현황은 GitHub/GitLab 원격에서만 볼 수 있습니다.</EmptyState> : !target ? <Notice>원격 주소에서 프로젝트를 확인하지 못했습니다. 원격 설정에서 실제 GitHub/GitLab 호스트와 프로젝트 경로를 확인하세요. SSH 별칭은 자동으로 해석하지 않습니다.</Notice> : !matches.length ? <Notice>{target.host}에 연결된 계정이 없습니다. 계정 관리에서 해당 서버에 연결하세요. 회사 GitLab은 PAT 연결을 사용할 수 있습니다.</Notice> : <>
        {matches.length > 1 && <SelectField label="이 서버의 조회 계정" value={selected} onChange={setSelected} options={[{ value: '', label: '사용할 계정 선택' }, ...matches.map(a => ({ value: a.key, label: a.login }))]} />}
        {account?.reconnect ? <Notice>계정 인증이 만료되었습니다. 계정 관리에서 다시 연결하세요.</Notice> : account && <CurrentProject repoPath={persist ? repo.path : ''} active={active} key={`${account.key}:${target.project}:${revisions[account.key] || 0}`} api={api} account={account} project={target.project} />}
      </>}
    </>}
  </>
}
export function HostingWorkspace({ persist = false, api, repos, activePath, active, onOpenRepository, busy }: { onOpenRepository?: () => void; busy?: boolean; persist?: boolean; api: DesktopAPI; repos: Repository[]; activePath: string | null; active: boolean }) {
  const [accounts, setAccounts] = useState<HostAccounts>({ accounts: [], warning: '' }), [error, setError] = useState(''), [ready, setReady] = useState(false), [revisions, setRevisions] = useState<Record<string, number>>({})
  const onChange = useCallback((next: HostAccounts, key?: string) => { setAccounts(next); if (key) setRevisions(current => ({ ...current, [key]: (current[key] || 0) + 1 })) }, [])
  useEffect(() => { let live = true; api.hostingAccounts().then(value => { if (live) { setAccounts(value); setReady(true); setError('') } }).catch(e => { if (live) { setError(e.message); setReady(true) } }); return () => { live = false } }, [api, active])
  const repo = repos.find(r => r.path === activePath)
  return <section className="bl-settings bl-hosting"><div className="bl-hosting-heading"><PageHeader title="프로젝트 현황" description="열린 저장소의 PR/MR과 CI 현황을 연결한 GitHub·GitLab 계정으로 확인합니다." />
    {ready && active && <Disclosure key={accounts.accounts.length ? 'connected' : repo ? 'connect-project' : 'empty'} title={`계정 관리 · ${accounts.accounts.length}개 연결`} initiallyOpen={!!repo && !accounts.accounts.length}><AccountConnections embedded api={api} accounts={accounts} onChange={onChange} /></Disclosure>}
    </div>{error && <Notice tone="error">{error}</Notice>}{!ready && <Notice>계정 설정을 불러오고 있습니다…</Notice>}
    {repos.map(open => <div key={open.path} hidden={open.path !== activePath}><RepositoryProject persist={persist} api={api} repo={open} accounts={accounts.accounts} revisions={revisions} active={active && open.path === activePath} /></div>)}
    {!repo && active && <EmptyState decorated title="열린 저장소가 없습니다" action={onOpenRepository && <Button variant="primary" disabled={busy} onClick={onOpenRepository}>저장소 열기</Button>}>PR/MR을 확인할 로컬 저장소를 선택하세요.</EmptyState>}
  </section>
}
