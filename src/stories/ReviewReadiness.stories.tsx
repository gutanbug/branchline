import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ReviewReadiness } from '../features/hosting/ReviewReadiness'
import type { HostItem } from '../app/types'
const head = 'a'.repeat(40), old = 'b'.repeat(40)
const record = (id: string, values: Partial<HostItem>): HostItem => ({ id, title: id, date: '2026-09-14T00:00:00Z', subtitle: '', url: '', state: '', ...values })
const meta = { title: 'Patterns/ReviewReadiness', component: ReviewReadiness, args: {
  account: { key: 'fixture', provider: 'github', host: 'github.com', login: 'fixture', scope: '', persistent: false, expiresAt: null, reconnect: false }, project: 'fixture/repo',
  item: record('1', { sha: head, version: 'c'.repeat(64) }),
  api: { hostingRead: async query => ({ hasMore: query.kind === 'review-approvals', checkedAt: '2026-09-14T00:00:00Z', items: query.kind === 'review-approvals' ? [record('1', { title: 'old-user', state: 'APPROVED', sha: old }), record('2', { title: 'current-user', state: 'APPROVED', sha: head })] : query.kind === 'review-checks' ? [record('3', { state: 'completed', conclusion: 'success', sha: head }), record('4', { state: 'completed', conclusion: 'failure', sha: old }), record('5', { state: 'queued', sha: head })] : [] }) },
} } satisfies Meta<typeof ReviewReadiness>
export default meta
type Story = StoryObj<typeof meta>
export const CurrentHeadOnly: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(await canvas.findByText('1 성공 · 0 실패/취소 · 1 대기/기타')).toBeVisible()
  await expect(canvas.getByText('1명 · 조회 범위 내 마지막 리뷰 기준')).toBeVisible()
  await userEvent.click(canvas.getByText('판정 범위와 미확인 항목', { exact: true }))
  await expect(canvas.getByText(/추가 페이지가 있습니다/)).toBeVisible()
  await expect(canvas.getByText('제공자 정책 확인 필요')).toBeVisible()
} }
export const PartialFailure: Story = { args: { api: { hostingRead: async query => { if (query.kind === 'review-checks') throw new Error('검사 조회 권한이 없습니다.'); return { items: [], hasMore: false, checkedAt: '' } } } }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(await canvas.findByText('일부 조회 실패')).toBeVisible()
  await expect(canvas.getByRole('alert')).toHaveTextContent('검사 조회 권한이 없습니다.')
} }
