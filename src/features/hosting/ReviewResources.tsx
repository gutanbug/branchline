import { ReviewFiles, type ReviewJump, type ReadingSession } from './ReviewFiles'
import { useNavigationBookmark } from '../../app/useNavigationBookmark'
import { ToastMessage } from '../../design-system'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Badge, Button, IconButton, MarkdownContent, ContentTabs, EmptyState, Notice, Pagination, SelectField } from '../../design-system'
import type { DesktopAPI, HostAccount, HostItem, ReviewResource } from '../../app/types'
import { stamp, status, useHostRead } from './queries'

function Note({ item, baseUrl, onOpenLink, onJump, restoreFocus }: { restoreFocus?: boolean; onJump: (note: HostItem) => void; item: HostItem; baseUrl: string; onOpenLink: (url: string) => Promise<unknown> }) {
  const opener = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    if (!restoreFocus) return
    const frame = requestAnimationFrame(() => opener.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [restoreFocus])
  return <article className="bl-review-note"><div className="bl-row-between"><h4>{item.title}</h4>{item.state && <Badge>{status(item.state)}</Badge>}</div><small>{stamp(item.date)} · {item.subtitle} #{item.id}</small>
    {item.diffSide && item.path && item.line ? <Button ref={opener} onClick={() => onJump(item)}>{item.path} · {item.diffSide === 'LEFT' ? '이전' : '이후'} {item.line}행 보기</Button> : item.path && <p className="bl-path">{item.path} · {item.line != null ? `댓글 행 ${item.line}` : '댓글 행 위치 미제공'}{item.originalLine != null ? ` · 원래 행 ${item.originalLine}` : ''} {item.side}</p>}
    {item.sha && <p className="bl-path">{item.relation} · {item.sha}</p>}{item.originalSha && item.originalSha !== item.sha && <p className="bl-path">원래 커밋 {item.originalSha}</p>}
    {item.replyTo && <p>댓글 #{item.replyTo}의 답글</p>}<MarkdownContent value={item.body || ''} baseUrl={item.url || baseUrl} onOpenLink={onOpenLink} />{item.truncated && <Notice>본문은 앞 20,000자까지 표시합니다. 전체는 제공자에서 확인하세요.</Notice>}
  </article>
}
const emptyResource = { page: 1 }
function ResourcePage({ repoPath, api, account, project, item, kind, label, target, onJump, origin }: { origin?: ReviewJump; onJump: (note: HostItem, page: number) => void; repoPath: string; api: DesktopAPI; account: HostAccount; project: string; item: HostItem; kind: ReviewResource; label: string; target: 'head' | 'merge' }) {
  const bookmark = useNavigationBookmark(repoPath && 'review-resource:' + repoPath, JSON.stringify([account.key, project, item.id, item.version, kind, target]), emptyResource)
  const [page, setPage] = useState(() => Math.min(10000, origin?.page || bookmark.value.page || 1)), [linkError, setLinkError] = useState('')
  useLayoutEffect(() => { bookmark.update({ page }) }, [bookmark, page])
  const result = useHostRead(api, { account: account.key, project, id: item.id, kind, version: item.version, page, target })
  function open(url: string) { setLinkError(''); void api.hostingExternal(account.key, url).catch(e => setLinkError(e.message)) }
  return <section className="bl-review-resource" aria-label={label}><div className="bl-row-between"><h4>{label}</h4><IconButton icon="refresh" label={`${label} 새로고침`} loading={result.busy} onClick={result.refresh} /></div>
    {result.busy && <Notice>검토 버전과 데이터를 확인하고 있습니다…</Notice>}{result.error && <Notice tone="error">{result.error}</Notice>}<ToastMessage scope="외부 링크" tone="error" message={linkError} />
    {result.value && <><small>조회 {stamp(result.value.checkedAt)} · 현재 페이지 {result.value.items.length}개</small>{result.value.warnings?.map(w => <Notice key={w}>{w}</Notice>)}
      {!result.value.items.length && <EmptyState title="조회된 리뷰 항목이 없습니다">조회 범위에 항목이 없습니다. 검사 결과가 없다는 사실은 통과를 뜻하지 않습니다.</EmptyState>}
      <div>{result.value.items.map(row => <div key={row.id} className="bl-review-entry">
          {row.notes ? <><h4>{row.title} · {row.subtitle}</h4>{row.notes.map(note => <Note restoreFocus={origin?.noteId === note.id && origin.page === page} onJump={note => onJump(note, page)} key={note.id} item={note} baseUrl={item.url || `https://${account.host}/`} onOpenLink={url => api.hostingExternal(account.key, url)} />)}</> : kind === 'review-comments' || kind === 'review-inline' || kind === 'review-approvals' ? <Note restoreFocus={origin?.noteId === row.id && origin.page === page} onJump={note => onJump(note, page)} item={row} baseUrl={item.url || `https://${account.host}/`} onOpenLink={url => api.hostingExternal(account.key, url)} /> : <article className="bl-review-note"><div className="bl-row-between"><h4>{row.title}</h4><Badge>{status(row.state)}{row.conclusion ? ` / ${status(row.conclusion)}` : ''}</Badge></div><p>{row.relation}</p><p className="bl-path">{row.sha || 'SHA 미제공'} {row.source}</p><small>{row.subtitle} · {stamp(row.date)}</small>{row.body && <p className="bl-host-description">{row.body}</p>}</article>}
          {row.url && <IconButton icon="external" label="이 항목을 제공자에서 열기" onClick={() => open(row.url)} />}
        </div>)}</div>
    </>}
    <Pagination label={`${label} 페이지`} page={page} hasMore={!!result.value?.hasMore} busy={result.busy} onChange={setPage} />
  </section>
}
const emptyDetail = { kind: 'overview' as ReviewResource | 'overview', target: 'head' as 'head' | 'merge' }
export function ReviewResources({ repoPath = '', api, account, project, item, overview, session, refresh }: { session: ReadingSession; refresh: () => void; repoPath?: string; api: DesktopAPI; account: HostAccount; project: string; item: HostItem; overview?: ReactNode }) {
  const bookmark = useNavigationBookmark(repoPath && 'review-detail:' + repoPath, JSON.stringify([account.key, project, item.id]), emptyDetail)
  const [kind, setKind] = useState<ReviewResource | 'overview'>(overview ? bookmark.value.kind : 'review-files'), [target, setTarget] = useState(bookmark.value.target)
  useLayoutEffect(() => { bookmark.update({ kind, target }) }, [bookmark, kind, target])
  const [jump, setJump] = useState<ReviewJump>()
  function openComment(note: HostItem, page: number) {
    if ((kind !== 'review-inline' && kind !== 'review-comments' && kind !== 'review-approvals') || !note.path || !note.line || !note.diffSide || !item.version) return
    setJump({ from: kind, noteId: note.id, page, path: note.path, location: { side: note.diffSide === 'LEFT' ? 'old' : 'next', line: note.line }, version: item.version })
    setKind('review-files')
  }
  const options: { value: ReviewResource; label: string }[] = [
    { value: 'review-files', label: '변경 파일' }, { value: 'review-comments', label: account.provider === 'github' ? '일반 댓글' : '리뷰 대화' },
    ...(account.provider === 'github' ? [{ value: 'review-inline' as const, label: '행 댓글' }] : []),
    { value: 'review-approvals', label: account.provider === 'github' ? '리뷰 기록' : '승인 규칙' },
    ...(account.provider === 'github' ? [{ value: 'review-checks' as const, label: 'Checks' }, { value: 'review-statuses' as const, label: 'Commit Status' }] : [{ value: 'review-pipelines' as const, label: 'MR Pipelines' }]),
  ]
  return <section aria-label="리뷰 검토 자료" className="bl-review-resources"><h3 className="sr-only">변경과 검토 근거</h3>
    <ContentTabs variant="underline" label="리뷰 자료 선택" selected={kind} onSelect={value => { setJump(undefined); setKind(value as typeof kind) }} onClose={() => {}} tabs={[
      ...(overview ? [{ id: 'overview', label: '개요', content: overview }] : []),
      ...options.map(option => ({ id: option.value, label: option.label, content: kind === option.value && <>
        {!item.version ? <Notice>검토 버전이 아직 준비되지 않았습니다. 상세를 새로고침하세요.</Notice> : <>
          {kind === 'review-checks' || kind === 'review-statuses' ? <div className="bl-host-form"><SelectField label="검사 커밋" value={target} onChange={value => setTarget(value as typeof target)} options={[{ value: 'head', label: '현재 Head' }, { value: 'merge', label: '현재 Head + Base 테스트 병합 커밋' }]} /></div> : null}
          {kind === 'review-files' ? <ReviewFiles key={item.version} repoPath={repoPath} api={api} account={account} project={project} review={item} session={session} refresh={refresh} onReturn={() => { if (jump) setKind(jump.from) }} jump={jump?.version === item.version ? jump : undefined} />
            : <ResourcePage origin={jump?.from === kind && jump.version === item.version ? jump : undefined} onJump={openComment} repoPath={repoPath} key={`${item.version}:${kind}:${target}`} api={api} account={account} project={project} item={item} kind={option.value} label={option.label} target={target} />}
        </>}
      </> })),
    ]} />
  </section>
}
