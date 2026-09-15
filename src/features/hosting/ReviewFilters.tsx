import { useEffect, useRef, useState } from 'react'
import { Button, SelectField, TextField } from '../../design-system'
import { defaultReviewFilter, type ReviewFilter } from './queries'
export function ReviewFilters({ value, github, onChange }: { value: ReviewFilter; github: boolean; onChange: (value: ReviewFilter) => void }) {
  const [draft, setDraft] = useState(value.titleSearch), [composing, setComposing] = useState(false)
  const field = useRef<HTMLInputElement>(null), latest = useRef({ value, onChange })
  useEffect(() => { latest.current = { value, onChange } }, [value, onChange])
  // Reject control characters and query syntax delimiters before remote search.
  // eslint-disable-next-line no-control-regex
  const invalid = /[\x00-\x1f\x7f"\\]/.test(draft)
  useEffect(() => {
    if (composing || invalid || draft === value.titleSearch) return
    const timer = setTimeout(() => latest.current.onChange({ ...latest.current.value, titleSearch: draft }), 300)
    return () => clearTimeout(timer)
  }, [draft, composing, invalid, value.titleSearch])
  function clear() { setDraft(''); onChange({ ...value, titleSearch: '' }); field.current?.focus() }
  return <div className="bl-review-filter-panel">
    <div className="bl-review-filter-fields">
      <SelectField label="리뷰 상태" value={value.state} onChange={state => onChange({ ...value, state })} options={[{ value: 'open', label: '열림' }, { value: 'closed', label: github ? '닫힘 · 병합 포함' : '닫힘 · 병합 제외' }, { value: 'all', label: '전체 · 병합 포함' }]} />
      <SelectField label="나와 관련된 리뷰" value={value.reviewRole} onChange={reviewRole => onChange({ ...value, reviewRole: reviewRole as ReviewFilter['reviewRole'] })} options={[{ value: 'all', label: '모든 리뷰' }, { value: 'reviewer', label: github ? '내 직접 검토 요청' : '내가 리뷰어인 MR' }, { value: 'assignee', label: '내 담당' }, { value: 'author', label: '내 작성' }]} />
      <SelectField label="업데이트 경과" value={String(value.inactiveDays)} onChange={days => onChange({ ...value, inactiveDays: Number(days) })} options={[{ value: '0', label: '전체 기간' }, { value: '7', label: '7일 이상 업데이트 없음' }, { value: '30', label: '30일 이상 업데이트 없음' }]} />
      <SelectField label="CI 결과" value={value.ciFilter} onChange={ciFilter => onChange({ ...value, ciFilter: ciFilter as ReviewFilter['ciFilter'] })} options={[{ value: 'all', label: '전체 CI' }, { value: 'failed', label: 'CI 실패만 · 현재 Head' }]} />
      <div className="bl-review-search"><TextField ref={field} label="리뷰 제목 검색" placeholder="제목의 단어 또는 문구" maxLength={200} value={draft} error={invalid ? '따옴표와 역슬래시를 제외하고 검색하세요.' : undefined} onChange={event => setDraft(event.target.value)} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} />{draft && <Button aria-label="리뷰 제목 검색 지우기" onClick={clear}>×</Button>}</div>
    </div>
    <div className="bl-row-between"><small>{value.ciFilter === 'failed' ? '다른 조건에 맞는 리뷰를 페이지당 30개씩 확인해 현재 Head의 CI 실패만 표시합니다. 다음 페이지도 확인하세요. 취소·대기·테스트 병합 커밋은 포함하지 않습니다.' : '현재 프로젝트 전체에서 조건에 맞는 결과를 30개씩 조회합니다. 경과 기간은 마지막 업데이트 기준입니다.'}</small>{(draft || value.reviewRole !== 'all' || value.inactiveDays || value.state !== 'open' || value.ciFilter !== 'all') ? <Button onClick={() => { setDraft(''); onChange(defaultReviewFilter); field.current?.focus() }}>필터 초기화</Button> : null}</div>
  </div>
}
