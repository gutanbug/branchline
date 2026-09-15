import { useState, type ReactNode } from 'react'
import { Badge, Button, MarkdownContent, CodeDiff, ContentTabs, EmptyState, Notice, Pagination, SelectField } from '../../design-system'
import type { DesktopAPI, HostAccount, HostItem, ReviewResource } from '../../app/types'
import { stamp, status, useHostRead } from './queries'

function Note({ item, baseUrl, onOpenLink }: { item: HostItem; baseUrl: string; onOpenLink: (url: string) => Promise<unknown> }) {
  return <article className="bl-review-note"><div className="bl-row-between"><h4>{item.title}</h4>{item.state && <Badge>{status(item.state)}</Badge>}</div><small>{stamp(item.date)} · {item.subtitle} #{item.id}</small>
    {item.path && <p className="bl-path">{item.path} · {item.line != null ? `댓글 행 ${item.line}` : '댓글 행 위치 미제공'}{item.originalLine != null ? ` · 원래 행 ${item.originalLine}` : ''} {item.side}</p>}
    {item.sha && <p className="bl-path">{item.relation} · {item.sha}</p>}{item.originalSha && item.originalSha !== item.sha && <p className="bl-path">원래 커밋 {item.originalSha}</p>}
    {item.replyTo && <p>댓글 #{item.replyTo}의 답글</p>}<MarkdownContent value={item.body || ''} baseUrl={item.url || baseUrl} onOpenLink={onOpenLink} />{item.truncated && <Notice>본문은 앞 20,000자까지 표시합니다. 전체는 제공자에서 확인하세요.</Notice>}
  </article>
}
function ResourcePage({ api, account, project, item, kind, label, target }: { api: DesktopAPI; account: HostAccount; project: string; item: HostItem; kind: ReviewResource; label: string; target: 'head' | 'merge' }) {
  const [page, setPage] = useState(1), [selected, setSelected] = useState(''), [linkError, setLinkError] = useState('')
  const result = useHostRead(api, { account: account.key, project, id: item.id, kind, version: item.version, page, target })
  const file = result.value?.items.find(row => row.id === selected)
  function open(url: string) { setLinkError(''); void api.hostingExternal(account.key, url).catch(e => setLinkError(e.message)) }
  return <section className="bl-review-resource" aria-label={label}><div className="bl-row-between"><h4>{label}</h4><Button disabled={result.busy} onClick={() => { setSelected(''); result.refresh() }}>{label} 새로고침</Button></div>
    {result.busy && <Notice>검토 버전과 데이터를 확인하고 있습니다…</Notice>}{result.error && <Notice tone="error">{result.error}</Notice>}{linkError && <Notice tone="error">{linkError}</Notice>}
    {result.value && <><small>조회 {stamp(result.value.checkedAt)} · 현재 페이지 {result.value.items.length}개</small>{result.value.warnings?.map(w => <Notice key={w}>{w}</Notice>)}
      {!result.value.items.length && <EmptyState title="조회된 리뷰 항목이 없습니다">조회 범위에 항목이 없습니다. 검사 결과가 없다는 사실은 통과를 뜻하지 않습니다.</EmptyState>}
      {kind === 'review-files' ? <div className="bl-review-files"><div className="bl-host-list">{result.value.items.map(row => <Button key={row.id} variant="ghost" className="bl-host-list-item" aria-pressed={selected === row.id} onClick={() => setSelected(current => current === row.id ? '' : row.id)}><span><strong>{row.title}</strong>{row.subtitle && row.subtitle !== row.title && <small>이전 경로 {row.subtitle}</small>}<small>{row.additions != null ? `+${row.additions} / -${row.deletions ?? '?'}` : '줄 수 미제공'}{row.generated ? ' · 생성된 파일' : ''}</small></span><Badge>{status(row.state)}</Badge></Button>)}</div>
        {file ? <section className="bl-review-patch" aria-label="리뷰 파일 diff"><h4 className="bl-path">{file.title}</h4>{file.unavailable && <Notice>바이너리·대형·접힌 파일이거나 patch를 제공하지 않습니다. 제공자에서 전체 변경을 확인하세요.</Notice>}{file.truncated && <Notice>diff는 앞 200,000자만 표시합니다. 전체 변경은 제공자에서 확인하세요.</Notice>}{file.body && <CodeDiff filename={file.title} value={file.body} />}</section> : <EmptyState title="변경 파일을 선택하세요">왼쪽 목록에서 검토할 파일을 선택하세요.</EmptyState>}</div>
        : <div>{result.value.items.map(row => <div key={row.id} className="bl-review-entry">
          {row.notes ? <><h4>{row.title} · {row.subtitle}</h4>{row.notes.map(note => <Note key={note.id} item={note} baseUrl={item.url || `https://${account.host}/`} onOpenLink={url => api.hostingExternal(account.key, url)} />)}</> : kind === 'review-comments' || kind === 'review-inline' || kind === 'review-approvals' ? <Note item={row} baseUrl={item.url || `https://${account.host}/`} onOpenLink={url => api.hostingExternal(account.key, url)} /> : <article className="bl-review-note"><div className="bl-row-between"><h4>{row.title}</h4><Badge>{status(row.state)}{row.conclusion ? ` / ${status(row.conclusion)}` : ''}</Badge></div><p>{row.relation}</p><p className="bl-path">{row.sha || 'SHA 미제공'} {row.source}</p><small>{row.subtitle} · {stamp(row.date)}</small>{row.body && <p className="bl-host-description">{row.body}</p>}</article>}
          {row.url && <Button onClick={() => open(row.url)}>이 항목을 제공자에서 열기 ↗</Button>}
        </div>)}</div>}
    </>}
    <Pagination label={`${label} 페이지`} page={page} hasMore={!!result.value?.hasMore} busy={result.busy} onChange={value => { setPage(value); setSelected('') }} />
  </section>
}
export function ReviewResources({ api, account, project, item, overview }: { api: DesktopAPI; account: HostAccount; project: string; item: HostItem; overview?: ReactNode }) {
  const [kind, setKind] = useState<ReviewResource | 'overview'>(overview ? 'overview' : 'review-files'), [target, setTarget] = useState<'head' | 'merge'>('head')
  const options: { value: ReviewResource; label: string }[] = [
    { value: 'review-files', label: '변경 파일' }, { value: 'review-comments', label: account.provider === 'github' ? '일반 댓글' : '리뷰 대화' },
    ...(account.provider === 'github' ? [{ value: 'review-inline' as const, label: '행 댓글' }] : []),
    { value: 'review-approvals', label: account.provider === 'github' ? '리뷰 기록' : '승인 규칙' },
    ...(account.provider === 'github' ? [{ value: 'review-checks' as const, label: 'Checks' }, { value: 'review-statuses' as const, label: 'Commit Status' }] : [{ value: 'review-pipelines' as const, label: 'MR Pipelines' }]),
  ]
  return <section aria-label="리뷰 검토 자료" className="bl-review-resources"><h3 className="sr-only">변경과 검토 근거</h3>
    <ContentTabs variant="underline" label="리뷰 자료 선택" selected={kind} onSelect={value => setKind(value as typeof kind)} onClose={() => {}} tabs={[
      ...(overview ? [{ id: 'overview', label: '개요', content: overview }] : []),
      ...options.map(option => ({ id: option.value, label: option.label, content: kind === option.value && <>
        {!item.version ? <Notice>검토 버전이 아직 준비되지 않았습니다. 상세를 새로고침하세요.</Notice> : <>
          {kind === 'review-checks' || kind === 'review-statuses' ? <div className="bl-host-form"><SelectField label="검사 커밋" value={target} onChange={value => setTarget(value as typeof target)} options={[{ value: 'head', label: '현재 Head' }, { value: 'merge', label: '현재 Head + Base 테스트 병합 커밋' }]} /></div> : null}
          <ResourcePage key={`${item.version}:${kind}:${target}`} api={api} account={account} project={project} item={item} kind={option.value} label={option.label} target={target} />
        </>}
      </> })),
    ]} />
  </section>
}
