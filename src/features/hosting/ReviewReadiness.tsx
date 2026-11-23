import { useEffect, useState } from 'react'
import { ActionSummary, IconButton, Disclosure, Notice } from '../../design-system'
import type { DesktopAPI, HostAccount, HostItem, HostResult, ReviewResource } from '../../app/types'

export function ReviewReadiness({ api, account, project, item }: { api: Pick<DesktopAPI, 'hostingRead'>; account: HostAccount; project: string; item: HostItem }) {
  const [revision, setRevision] = useState(0)
  const key = JSON.stringify([account.key, project, item.id, item.version, revision])
  const [data, setData] = useState<{ key: string; results: PromiseSettledResult<HostResult>[] } | null>(null)
  useEffect(() => {
    if (!item.version) return
    let live = true
    const kinds: ReviewResource[] = account.provider === 'github' ? ['review-approvals', 'review-checks', 'review-statuses'] : ['review-approvals', 'review-pipelines']
    Promise.allSettled(kinds.map(kind => api.hostingRead({ account: account.key, project, id: item.id, version: item.version, kind, target: 'head', page: 1 }))).then(results => { if (live) setData({ key, results }) })
    return () => { live = false }
  }, [api, account.key, account.provider, project, item.id, item.version, key])
  if (!item.version) return null
  const results = data?.key === key ? data.results : null
  const value = (index: number) => { const result = results?.[index]; return result?.status === 'fulfilled' ? result.value : null }
  const approvals = value(0), checks = results?.slice(1).flatMap(result => result.status === 'fulfilled' ? result.value.items : []) || []
  const current = checks.filter(check => check.sha === item.sha)
  const failed = current.filter(check => ['failure', 'failed', 'timed_out', 'action_required', 'cancelled', 'canceled', 'error', 'startup_failure'].includes(check.conclusion || check.state)).length
  const passed = current.filter(check => (check.conclusion || check.state) === 'success').length
  const pending = current.length - failed - passed
  const rules = approvals?.items.filter(rule => rule.state === 'approval_required').length || 0
  const latest = new Map<string, HostItem>()
  for (const review of [...(approvals?.items || [])].sort((a, b) => a.date.localeCompare(b.date) || Number(a.id) - Number(b.id))) latest.set(review.title, review)
  const approved = [...latest.values()].filter(review => review.sha === item.sha && review.state === 'APPROVED').length
  const errors = results?.flatMap(result => result.status === 'rejected' ? [String(result.reason?.message || result.reason)] : []) || []
  return <section aria-label="현재 커밋 검토 요약"><div className="bl-row-between"><h3>현재 커밋 검토 요약</h3><IconButton icon="refresh" label="검토 요약 새로고침" loading={!results} onClick={() => setRevision(value => value + 1)} /></div>
    {!results ? <Notice>현재 Head의 승인·검사를 조회하고 있습니다…</Notice> : <><ActionSummary title={`Head ${item.sha?.slice(0, 12) || '미제공'}`} status={failed || rules ? '조치 필요' : errors.length ? '일부 조회 실패' : '검토 필요'} facts={[
      { label: '현재 Head 검사', value: `${passed} 성공 · ${failed} 실패/취소 · ${pending} 대기/기타` },
      { label: account.provider === 'github' ? '조회된 현재 Head 승인자' : '승인 규칙', value: !approvals ? '조회 실패' : account.provider === 'github' ? `${approved}명 · 조회 범위 내 마지막 리뷰 기준` : `${rules}개 미충족 · ${approvals.items.filter(rule => rule.state === 'unknown').length}개 확인 필요` },
      { label: '필수 검사·최종 병합', value: '제공자 정책 확인 필요' },
    ]} next={failed || rules ? '실패한 검사와 미충족 승인 규칙을 먼저 확인하세요.' : '조회 결과가 모두 성공해도 필수 검사, 병합 큐와 보호 규칙을 확인한 뒤 병합하세요.'} />
    <p className="bl-muted">현재 Head · 각 자료의 첫 페이지 기준{results.some(result => result.status === 'fulfilled' && result.value.hasMore) ? ' · 추가 결과 있음' : ''}{!current.length ? ' · 현재 Head 검사 결과 없음' : ''}</p>
    <Disclosure title="판정 범위와 미확인 항목"><p className="bl-muted">각 자료의 첫 페이지 기준입니다. 이전 커밋의 검사·승인은 현재 Head 결과에 포함하지 않습니다. 승인 규칙과 필수 여부가 미제공인 항목을 통과로 처리하지 않습니다.{results.some(result => result.status === 'fulfilled' && result.value.hasMore) ? ' 추가 페이지가 있습니다. 검토 자료 탭에서 이어서 확인하세요.' : ''}{!current.length ? ' 현재 Head 검사 결과가 없습니다.' : ''}</p></Disclosure>
    {errors.map((error, index) => <Notice tone="error" key={index}>{error}</Notice>)}</>}
  </section>
}
