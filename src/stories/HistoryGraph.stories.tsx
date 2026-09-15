import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import { HistoryGraph } from '../features/workspace/HistoryGraph'
import '../app/desktop.css'

const commits = Array.from({ length: 101 }, (_, index) => ({ sha: String(index).padStart(40, '0'), parents: index < 100 ? [String(index + 1).padStart(40, '0')] : [], author: '개발자', email: 'fixture@example.invalid', date: '2026-09-14T00:00:00Z', message: `기록 ${index}` }))
const history = fn(async (_path: string, input: { offset?: number }) => ({ commits: commits.slice(input.offset || 0, (input.offset || 0) + 100), hasMore: !input.offset, offset: input.offset || 0, revisions: [commits[0].sha] }))
const meta = { title: 'Patterns/HistoryGraph', component: HistoryGraph, decorators: [Story => <div className="bl-graph-columns" style={{ height: 360, width: 600, display: 'flex' }}><div style={{ flex: 1 }}><Story /></div></div>], args: { api: { history }, repo: { path: '/fixture', branch: 'main', head: commits[0].sha, refs: [], shallow: false }, tab: { ref: '', query: '', author: '', file: '', after: '', before: '' }, selected: commits[0].sha, onSelect: fn(), paused: false } } satisfies Meta<typeof HistoryGraph>
export default meta
type Story = StoryObj<typeof meta>
export const RetryAppend: Story = { beforeEach: () => {
  history.mockClear()
  history.mockResolvedValueOnce({ commits: commits.slice(0, 100), hasMore: true, offset: 0, revisions: [commits[0].sha] }).mockRejectedValueOnce(new Error('검증용 추가 조회 실패'))
}, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await canvas.findByRole('button', { name: /기록 0 / })
  const scroller = canvasElement.querySelector<HTMLElement>('.bl-commit-graph')!
  scroller.scrollTop = scroller.scrollHeight
  await expect(canvas.queryByRole('button', { name: '이전 기록 더 불러오기' })).not.toBeInTheDocument()
  await expect(canvas.queryByRole('button', { name: '최신 이력' })).not.toBeInTheDocument()
  await expect(await canvas.findByRole('alert')).toHaveTextContent('검증용 추가 조회 실패')
  await expect(canvas.getAllByRole('button', { name: /기록 \d+ / })).toHaveLength(100)
  await userEvent.click(canvas.getByRole('button', { name: '이력 다시 시도' }))
  await waitFor(() => expect(canvas.getAllByRole('button', { name: /기록 \d+ / })).toHaveLength(101))
  await expect(history.mock.calls[2][1]).toMatchObject({ offset: 100, revisions: [commits[0].sha] })
} }
