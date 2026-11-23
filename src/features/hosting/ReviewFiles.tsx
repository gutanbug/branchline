import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigationBookmark } from '../../app/useNavigationBookmark'
import type { DesktopAPI, HostAccount, HostItem, HostResult } from '../../app/types'
import { Badge, Button, ChangeFileList, Checkbox, CodeDiff, EmptyState, IconButton, InspectorPanel, Notice, Pagination, ToastMessage, type DiffLocation, type DiffReading } from '../../design-system'
import { stamp, status } from './queries'

export type ReviewJump = { from: 'review-inline' | 'review-comments' | 'review-approvals'; noteId: string; page: number; path: string; location: DiffLocation; version: string }
export type ReadingSession = { reading?: DiffReading }
const emptyPage = { page: 1, selected: '', pendingOnly: 0 }
type FilePage = { page: number; result: HostResult }
function loadMarks(key: string): Map<string, string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    return new Map(Array.isArray(saved) ? saved.filter(entry => Array.isArray(entry) && entry.length === 2 && entry.every(value => typeof value === 'string')) : [])
  } catch { return new Map() }
}

export function ReviewFiles({ repoPath, api, account, project, review, session, jump, refresh, onReturn }: {
  repoPath: string; api: DesktopAPI; account: HostAccount; project: string; review: HostItem
  session: ReadingSession; jump?: ReviewJump; refresh: () => void; onReturn: () => void
}) {
  const scope = JSON.stringify([account.key, project, review.id]), markKey = 'branchline.reviewed.v1:' + JSON.stringify([repoPath, scope])
  const legacy = useNavigationBookmark(repoPath && 'review-resource:' + repoPath, JSON.stringify([account.key, project, review.id, review.version, 'review-files', 'head']), emptyPage)
  const bookmark = useNavigationBookmark(repoPath && 'review-files:' + repoPath, scope, legacy.value)
  const [request, setRequest] = useState(() => ({ page: Math.min(10000, bookmark.value.page || 1), path: jump?.path || bookmark.value.selected }))
  const [selected, setSelected] = useState(request.path), [target, setTarget] = useState(jump)
  const [data, setData] = useState<FilePage>(), [error, setError] = useState('')
  const [marks, setMarks] = useState(() => loadMarks(markKey)), [pendingOnly, setPendingOnly] = useState(!jump && !!bookmark.value.pendingOnly)
  const [storageError, setStorageError] = useState(false)
  const [finding, setFinding] = useState(false), [message, setMessage] = useState('')
  const advance = useRef<AbortController | null>(null), section = useRef<HTMLElement>(null)
  const read = useCallback(async (page: number): Promise<FilePage> => ({
    page, result: await api.hostingRead({ kind: 'review-files', account: account.key, project, id: review.id, version: review.version, page }),
  }), [api, account.key, project, review.id, review.version])
  useEffect(() => () => advance.current?.abort(), [])
  useEffect(() => {
    let live = true
    async function locate() {
      const first = await read(request.page)
      if (!live || !request.path || first.result.items.some(row => row.id === request.path)) return first
      // Pages can shift after a push. Only search further when restoring or following a specific file.
      let page = 1
      while (live) {
        const next = page === first.page ? first : await read(page)
        if (next.result.items.some(row => row.id === request.path)) return next
        if (!next.result.hasMore || page >= 10000) break
        page++
      }
      return first
    }
    locate().then(value => {
      if (!live) return
      const saved = loadMarks(markKey)
      const changed = value.result.items.filter(row => saved.has(row.id) && saved.get(row.id) !== row.fingerprint)
      if (changed.length) {
        for (const row of changed) saved.delete(row.id)
        setMarks(saved)
        try { localStorage.setItem(markKey, JSON.stringify([...saved])) } catch { setStorageError(true) }
      }
      setData(value)
    }).catch(reason => { if (live) setError(reason.message) })
    return () => { live = false }
  }, [read, request, markKey])
  const items = data?.result.items || []
  const file = items.find(row => row.id === selected)
  useLayoutEffect(() => {
    if (data) bookmark.update({ page: data.page, selected: file?.id || '', pendingOnly: Number(pendingOnly) })
  }, [bookmark, data, file, pendingOnly])
  const done = (row: HostItem) => !!row.fingerprint && marks.get(row.id) === row.fingerprint
  function cancelAdvance() {
    advance.current?.abort(); advance.current = null
    setFinding(false); setMessage('')
  }
  function toggle(row: HostItem) {
    if (!row.fingerprint) return marks
    const next = new Map(marks)
    if (done(row)) next.delete(row.id)
    else next.set(row.id, row.fingerprint)
    setMarks(next)
    try { localStorage.setItem(markKey, JSON.stringify([...next])); setStorageError(false) } catch { setStorageError(true) }
    return next
  }
  async function nextUnreviewed() {
    if (!data || !file?.fingerprint || advance.current) return
    const checked = done(file) ? marks : toggle(file)
    const operation = new AbortController()
    advance.current = operation
    setFinding(true); setMessage('')
    function visit(candidate: FilePage, rows = candidate.result.items) {
      const next = rows.find(row => row.fingerprint && checked.get(row.id) !== row.fingerprint)
      if (!next || operation.signal.aborted) return false
      setTarget(undefined); setSelected(next.id); setData(candidate)
      return true
    }
    try {
      const index = data.result.items.indexOf(file)
      if (visit(data, data.result.items.slice(index + 1))) return
      let candidate = data
      while (candidate.result.hasMore && candidate.page < 10000) {
        candidate = await read(candidate.page + 1)
        if (operation.signal.aborted || visit(candidate)) return
      }
      for (let page = 1; page < data.page; page++) {
        candidate = await read(page)
        if (operation.signal.aborted || visit(candidate)) return
        if (!candidate.result.hasMore) break
      }
      if (!visit(data, data.result.items.slice(0, index))) setMessage('조회 가능한 변경 파일을 모두 검토했습니다.')
    } catch (reason) {
      if (!operation.signal.aborted) setError((reason as Error).message)
    } finally {
      if (!operation.signal.aborted) {
        advance.current = null
        setFinding(false)
        requestAnimationFrame(() => section.current?.querySelector<HTMLButtonElement>('[data-review-next]')?.focus({ preventScroll: true }))
      }
    }
  }
  function changePage(page: number) {
    cancelAdvance(); setSelected(''); setTarget(undefined); setData(undefined); setError(''); setRequest({ page, path: '' })
  }
  const visible = pendingOnly ? items.filter(row => !done(row)) : items
  const notice = file && <>{file.unavailable && <Notice>바이너리·대형·접힌 파일이거나 patch를 제공하지 않습니다. 제공자에서 전체 변경을 확인하세요.</Notice>}{file.truncated && <Notice>diff는 앞 200,000자만 표시합니다. 전체 변경은 제공자에서 확인하세요.</Notice>}</>
  const nextAction = file && <Button data-review-next="" disabled={!file.fingerprint || !!message} loading={finding} onClick={() => void nextUnreviewed()}>{message ? '모두 검토 완료' : done(file) ? '다음 미검토 파일' : '검토 완료 후 다음 파일'}</Button>
  return <section ref={section} className="bl-review-resource" aria-label="변경 파일">
    <div className="bl-row-between"><h4>변경 파일</h4><div className="bl-actions">{jump && <Button onClick={onReturn}>댓글로 돌아가기</Button>}<IconButton icon="refresh" label="변경 파일 새로고침" loading={!data && !error} onClick={refresh} /></div></div>
    <ToastMessage scope="파일 검토" tone="success" message={message} />
    {storageError && <Notice>검토 상태를 이 기기에 저장하지 못했습니다. 현재 화면에서는 계속 사용할 수 있습니다.</Notice>}
    {error ? <Notice tone="error">{error}</Notice> : !data ? <Notice>검토 버전과 변경 파일을 확인하고 있습니다…</Notice> : <>
      <small>조회 {stamp(data.result.checkedAt)} · 현재 페이지 {items.length}개 · 검토 완료 {items.filter(done).length}개</small>
      {data.result.warnings?.map(warning => <Notice key={warning}>{warning}</Notice>)}
      {selected && !file && <Notice>현재 리뷰의 변경 파일에서 {selected}을(를) 찾을 수 없습니다.</Notice>}
      <Checkbox label="미검토 파일만" checked={pendingOnly} onChange={event => setPendingOnly(event.target.checked)} />
      <div className="bl-review-files"><ChangeFileList label="현재 페이지 파일" paths={visible.map(row => row.title)} empty={pendingOnly && items.length ? '이 페이지의 파일을 모두 검토했습니다.' : '이 페이지에 변경 파일이 없습니다.'}
        renderFile={(index, view) => {
          const row = visible[index]
          return <div className="bl-review-file-row"><Button variant="ghost" className="bl-host-list-item" aria-pressed={selected === row.id} onClick={() => { cancelAdvance(); setTarget(undefined); setSelected(current => current === row.id ? '' : row.id) }}>
            <span><strong title={row.title}>{view === 'tree' ? row.title.split('/').at(-1) : row.title}</strong>{row.subtitle && row.subtitle !== row.title && <small>이전 경로 {row.subtitle}</small>}<small>{row.additions != null ? `+${row.additions} / -${row.deletions ?? '?'}` : '줄 수 미제공'}{row.generated ? ' · 생성된 파일' : ''}</small></span><Badge>{status(row.state)}</Badge>
          </Button><Checkbox label="검토 완료" aria-label={`${row.title} 검토 완료`} checked={done(row)} disabled={!row.fingerprint} onChange={() => { cancelAdvance(); toggle(row) }} /></div>
        }} />
        {file ? <section className="bl-review-patch" aria-label="리뷰 파일 diff">{!file.body && <div className="bl-row-between"><h4 className="bl-path">{file.title}</h4>{nextAction}</div>}{notice}{file.body && <InspectorPanel title={file.title} integratedToolbar summary={notice}>{(expanded, actions) =>
          <CodeDiff key={file.id} filename={file.title} value={file.body!} actions={<div className="bl-actions">{expanded && jump && <Button onClick={onReturn}>댓글로 돌아가기</Button>}{nextAction}{actions}</div>} location={target?.path === file.id ? target.location : undefined} reading={session.reading} onRemember={reading => { session.reading = reading }} />
        }</InspectorPanel>}</section> : items.length > 0 && <EmptyState title="변경 파일을 선택하세요">목록에서 검토할 파일을 선택하세요.</EmptyState>}
      </div>
      <Pagination label="변경 파일 페이지" page={data.page} hasMore={data.result.hasMore} busy={false} onChange={changePage} />
    </>}
  </section>
}
