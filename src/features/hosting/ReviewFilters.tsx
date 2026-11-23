import { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, IconButton, ModeSelector, TextField } from '../../design-system'
import { defaultReviewFilter, type ReviewFilter } from './queries'

export function ReviewFilters({ value, github, onChange, onOpenReview }: {
  value: ReviewFilter
  github: boolean
  onChange: (value: ReviewFilter) => void
  onOpenReview: (id: string, trigger: HTMLInputElement) => void
}) {
  const [draft, setDraft] = useState(value.titleSearch), [composing, setComposing] = useState(false)
  const field = useRef<HTMLInputElement>(null), latest = useRef({ value, onChange })
  useEffect(() => { latest.current = { value, onChange } }, [value, onChange])
  // Reject control characters and query syntax delimiters before remote search.
  // eslint-disable-next-line no-control-regex
  const invalid = /[\x00-\x1f\x7f"\\]/.test(draft)
  const prefix = github ? '#' : '!'
  const reference = draft.trim().startsWith(prefix) && /^\d*$/.test(draft.trim().slice(1))
  const number = reference && /^[1-9]\d{0,14}$/.test(draft.trim().slice(1)) ? draft.trim().slice(1) : ''
  useEffect(() => {
    if (composing || invalid || reference || draft === value.titleSearch) return
    const timer = setTimeout(() => latest.current.onChange({ ...latest.current.value, titleSearch: draft }), 300)
    return () => clearTimeout(timer)
  }, [draft, composing, invalid, reference, value.titleSearch])
  function openReview() {
    if (!number || !field.current || composing) return
    setDraft(value.titleSearch)
    onOpenReview(number, field.current)
  }
  const roles = [
    ['all', '전체 리뷰'], ['reviewer', github ? '내 직접 검토 요청' : '내 리뷰 요청'], ['author', '내가 작성'], ['assignee', '내 담당'],
  ] as const
  const filtered = draft || value.reviewRole !== 'all' || value.state !== 'open' || value.inactiveDays || value.ciFilter !== 'all'
  return <div className="bl-review-filter-panel">
    <div className="bl-review-filter-bar">
      <ModeSelector label="나와 관련된 리뷰" options={roles} value={value.reviewRole} onChange={reviewRole => onChange({ ...value, reviewRole })} />
      <div className="bl-review-search"><TextField ref={field} label="리뷰 검색" placeholder={`제목 또는 ${prefix}번호`} maxLength={200} value={draft}
        error={invalid ? '따옴표와 역슬래시를 제외하고 검색하세요.' : reference && draft.trim() !== prefix && !number ? '올바른 리뷰 번호를 입력하세요.' : undefined}
        onChange={event => setDraft(event.target.value)} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
        onKeyDown={event => { if (event.key === 'Enter' && number && !event.nativeEvent.isComposing) { event.preventDefault(); openReview() } }} />
        {number && <Button onClick={openReview}>{prefix}{number} 열기</Button>}
        {draft && <IconButton icon="close" label="리뷰 검색 지우기" onClick={() => { setDraft(''); onChange({ ...value, titleSearch: '' }); field.current?.focus() }} />}
      </div>
    </div>
    <div className="bl-review-filter-options">
      <div><small>리뷰 상태</small><ModeSelector label="리뷰 상태" value={value.state} onChange={state => onChange({ ...value, state })} options={[['open', '열림'], ['closed', github ? '닫힘 · 병합 포함' : '닫힘 · 병합 제외'], ['all', '전체']]} /></div>
      <div><small>마지막 업데이트</small><ModeSelector label="마지막 업데이트" value={String(value.inactiveDays)} onChange={days => onChange({ ...value, inactiveDays: Number(days) })} options={[['0', '전체 기간'], ['7', '7일 이상 전'], ['30', '30일 이상 전']]} /></div>
      <Checkbox label="CI 실패만" checked={value.ciFilter === 'failed'} onChange={event => onChange({ ...value, ciFilter: event.target.checked ? 'failed' : 'all' })} />
      {!!filtered && <IconButton icon="reset" label="필터 초기화" onClick={() => { setDraft(''); onChange(defaultReviewFilter); field.current?.focus() }} />}
    </div>
    {value.ciFilter === 'failed' && <small>현재 Head · 페이지당 30개 확인</small>}
  </div>
}
