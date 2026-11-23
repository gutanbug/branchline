import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '../design-system'
import { WorktreeMenu } from '../features/workspace/WorktreeMenu'
const worktree = { path: '/example/한글 worktree', branch: 'feature/review', head: 'a'.repeat(40), locked: false, prunable: false }
const meta = { title: 'Features/WorktreeMenu', component: WorktreeMenu, args: { worktree, primary: false, openPaths: [], disabled: false, onAction: fn(), showButton: true, children: <Button onClick={fn()}>feature/review</Button> } } satisfies Meta<typeof WorktreeMenu>
export default meta
type Story = StoryObj<typeof meta>
export const Ready: Story = { play: async ({ canvasElement, args }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: /메뉴$/ }))
  await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole('menuitem', { name: '현재 탭에서 열기' }))
  await expect(args.onAction).toHaveBeenCalledWith('open', worktree)
} }
export const Locked: Story = { args: { worktree: { ...worktree, locked: true } }, play: async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: /메뉴$/ }))
  const body = within(canvasElement.ownerDocument.body)
  await expect(await body.findByRole('menuitem', { name: 'Worktree 제거…' })).toHaveAttribute('aria-disabled', 'true')
  await expect(body.getByRole('menuitem', { name: 'Worktree 잠금 해제' })).not.toHaveAttribute('aria-disabled', 'true')
} }
export const Primary: Story = { args: { primary: true } }
export const OpenTab: Story = { args: { openPaths: [worktree.path] } }
export const Detached: Story = { args: { worktree: { ...worktree, branch: null } } }
export const Busy: Story = { args: { disabled: true } }
