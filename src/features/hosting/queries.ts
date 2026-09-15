import { useEffect, useState } from 'react'
import type { DesktopAPI, HostQuery, HostResult } from '../../app/types'

export function useHostRead(api: DesktopAPI, query: HostQuery) {
  const [revision, setRevision] = useState(0)
  const key = JSON.stringify({ ...query, revision })
  const [state, setState] = useState<{ key: string; value?: HostResult; error?: string }>({ key: '' })
  useEffect(() => {
    let live = true
    api.hostingRead(JSON.parse(key)).then(value => { if (live) setState({ key, value }) }).catch(e => { if (live) setState({ key, error: e.message }) })
    return () => { live = false }
  }, [api, key])
  const current = state.key === key ? state : null
  return { value: current?.value, error: current?.error, busy: !current, refresh: () => setRevision(v => v + 1) }
}
export function stamp(value?: string) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('ko-KR') : '제공되지 않음' }
export function status(value?: string) {
  const labels: Record<string, string> = { clean: '충돌 없음', dirty: '충돌 해결 필요', unstable: '검사 확인 필요', behind: '대상 브랜치보다 뒤처짐', has_conflicts: '충돌 있음', mergeable: '서버 기준 병합 가능', not_approved: '승인 필요', ci_must_pass: '파이프라인 성공 필요', ci_still_running: '파이프라인 실행 중', discussions_not_resolved: '미해결 논의 있음', unchecked: '병합 상태 미확인', cannot_be_merged: '서버에서 병합 불가', open: '열림', opened: '열림', closed: '닫힘', merged: '병합됨', unknown: '확인되지 않음', checking: '확인 중', queued: '실행 대기', pending: '대기', waiting: '대기', in_progress: '실행 중', running: '실행 중', completed: '완료', success: '성공', failure: '실패', failed: '실패', cancelled: '취소됨', canceled: '취소됨', skipped: '건너뜀', manual: '수동 실행 대기', timed_out: '시간 초과', action_required: '조치 필요', blocked: '차단됨', draft: '초안', added: '추가', removed: '삭제', modified: '수정', renamed: '이름 변경', resolved: '해결됨', unresolved: '미해결', APPROVED: '승인 기록', CHANGES_REQUESTED: '변경 요청', COMMENTED: '의견', DISMISSED: '철회됨', PENDING: '임시 리뷰', approved: '규칙 충족', approval_required: '승인 필요' }
  return value ? labels[value] ? `${labels[value]} (${value})` : value : '미제공'
}

export type ReviewFilter = { ciFilter: NonNullable<HostQuery['ciFilter']>; state: string; reviewRole: NonNullable<HostQuery['reviewRole']>; inactiveDays: number; titleSearch: string }
export const defaultReviewFilter: ReviewFilter = { ciFilter: 'all', state: 'open', reviewRole: 'all', inactiveDays: 0, titleSearch: '' }
