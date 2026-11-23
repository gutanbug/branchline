import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { GitToolbar } from '../design-system'
const meta = { title: 'Patterns/GitToolbar', component: GitToolbar, args: { onAction: fn() } } satisfies Meta<typeof GitToolbar>
export default meta
type Story = StoryObj<typeof meta>
export const Actions: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getAllByRole('button')).toHaveLength(6)
  canvas.getByRole('button', { name: 'Fetch · 원격 이력 가져오기' }).focus()
  await userEvent.keyboard('{Enter}')
  await expect(args.onAction).toHaveBeenCalledWith('fetch')
  await userEvent.click(canvas.getByRole('button', { name: 'Branch · 브랜치 만들기' }))
  await expect(args.onAction).toHaveBeenCalledWith('branch')
} }
export const Unavailable: Story = { args: { disabled: { fetch: true, pull: true, push: true, 'stash-save': true, 'stash-pop': true }, reasons: { fetch: '원격 저장소를 등록하세요.' } }, play: async ({ canvasElement }) => {
  await expect(within(canvasElement).getByRole('button', { name: 'Fetch · 원격 이력 가져오기' })).toBeDisabled()
} }
export const Diverged: Story = { args: { counts: { incoming: 12, outgoing: 3 } }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getAllByLabelText('받을 커밋 12개')).toHaveLength(2)
  await expect(canvas.getByLabelText('보낼 커밋 3개')).toBeVisible()
} }
export const UnknownTracking: Story = { args: { counts: { incoming: null, outgoing: null, incomingReason: '추적 브랜치 없음 · 첫 Push 때 설정하거나 Upstream 설정', outgoingReason: '추적 브랜치 없음 · 첫 Push 때 설정하거나 Upstream 설정' } }, play: async ({ canvasElement }) => {
  await expect(within(canvasElement).getByLabelText('보낼 커밋 확인 불가 · 추적 브랜치 없음 · 첫 Push 때 설정하거나 Upstream 설정')).toBeVisible()
} }
export const UpToDate: Story = { args: { counts: { incoming: 0, outgoing: 0 } } }
