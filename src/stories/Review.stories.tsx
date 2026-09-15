import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import { Button, ContentTabs, ReviewDetailLayout, ReviewListRow } from '../design-system'
const select = fn()
const rows = [
  { identifier: '!2594', title: '[CMPTEAM-5726] 수집 실패 시 기존 데이터 유지와 정상 종료 처리 수정', source: 'fix/CMPTEAM-5726-preserve-data-on-failure', draft: false },
  { identifier: '!2586', title: '배포 설정 분리 및 인증 실패 후 연결 복구', source: 'site/production/develop', draft: true },
  { identifier: '!2580', title: '변경 파일 탐색과 작업 공간 상태 유지', source: 'feature/한글-경로와-아주-긴-브랜치-이름을-포함하는-프로젝트-작업', draft: true },
]
function Example() {
  const [detail, setDetail] = useState(false), [tab, setTab] = useState('overview')
  return <div><h1>프로젝트 검토</h1>{detail ? <><Button onClick={() => setDetail(false)}>목록으로</Button><ReviewDetailLayout title={rows[0].title} identifier="!2594" status="열림" author="김개발" updated="2026. 9. 15. 10:30" source={rows[0].source} target="feature/cloud-collection" actions={<Button onClick={() => select('refresh')}>새로고침</Button>} facts={[{ label: '담당자', value: '김개발' }, { label: '리뷰어', value: '박리뷰' }, { label: '서버 병합 상태', value: '확인 중' }, { label: '현재 Head', value: <code>85e2f3e08a71</code> }]}><ContentTabs variant="underline" label="검토 항목" selected={tab} onSelect={setTab} onClose={() => {}} tabs={[{ id: 'overview', label: '개요', content: <section><h3>작업 내용</h3><p>수집 실패 시 기존 데이터가 유지되도록 수정했습니다.</p><p>전체 재시도 결과를 확인하고 실패 상태를 표시합니다.</p></section> }, { id: 'changes', label: '변경 파일', content: <p>선택한 버전의 변경 파일</p> }]} /></ReviewDetailLayout></> : rows.map(row => <ReviewListRow key={row.identifier} {...row} author="김개발" target="develop" status="열림" updated="2026. 9. 15. 10:30" onClick={() => { select(row.identifier); setDetail(true) }} />)}</div>
}
const meta = { title: 'Patterns/Review', component: Example } satisfies Meta<typeof Example>
export default meta
type Story = StoryObj<typeof meta>
export const ListAndDetail: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.tab()
  await userEvent.click(canvas.getByRole('button', { name: `${rows[0].identifier} ${rows[0].title}` }))
  await expect(select).toHaveBeenCalledWith('!2594')
  await expect(canvas.getByRole('complementary', { name: '리뷰 정보' })).toHaveTextContent('박리뷰')
  await userEvent.click(canvas.getByRole('tab', { name: '개요' }))
  await userEvent.keyboard('{ArrowRight}')
  await waitFor(() => expect(canvas.getByRole('tab', { name: '변경 파일' })).toHaveFocus())
  await expect(canvas.getByRole('tabpanel', { name: '변경 파일' })).toBeVisible()
  await userEvent.click(canvas.getByRole('button', { name: '목록으로' }))
  await expect(canvas.getByRole('button', { name: `${rows[2].identifier} ${rows[2].title}` })).toBeVisible()
} }
