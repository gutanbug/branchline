import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '../design-system'
import { StashMenu } from '../features/workspace/StashMenu'
import type { Repository } from '../app/types'
const stash = { ref: 'stash@{2}', sha: 'a'.repeat(40), message: 'On feature/ui: 한글 변경 보관', date: '2026-09-18T09:00:00Z' }
const repo: Repository = { path: '/example', name: 'example', head: stash.sha, branch: 'main', token: 'fixture', refs: [], files: [], shallow: false, operation: null, checkedAt: '', identity: { name: null, email: null } }
const meta = { title: 'Features/StashMenu', component: StashMenu, args: { stash, repo, disabled: false, onAction: fn(), showButton: true, children: <Button onClick={fn()}>보관한 변경</Button> } } satisfies Meta<typeof StashMenu>
export default meta
type Story = StoryObj<typeof meta>
export const Ready: Story = { play: async ({ canvasElement, args }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: /메뉴$/ }))
  const body = within(canvasElement.ownerDocument.body)
  await userEvent.click(await body.findByRole('menuitem', { name: 'Pop · 복원 성공 시 Stash 삭제' }))
  await expect(args.onAction).toHaveBeenCalledWith('stash-pop', stash)
} }
export const Dirty: Story = { args: { repo: { ...repo, files: [{ path: 'draft.txt', originalPath: null, index: '?', working: '?', untracked: true, conflict: false }] } }, play: async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: /메뉴$/ }))
  const body = within(canvasElement.ownerDocument.body)
  await expect(await body.findByRole('menuitem', { name: 'Apply · 복원하고 Stash 유지' })).not.toHaveAttribute('aria-disabled', 'true')
  await expect(body.getByRole('menuitem', { name: 'Pop · 복원 성공 시 Stash 삭제' })).not.toHaveAttribute('aria-disabled', 'true')
  await expect(body.getByRole('menuitem', { name: 'Stash 삭제…' })).not.toHaveAttribute('aria-disabled', 'true')
} }
export const Busy: Story = { args: { disabled: true } }
export const InProgress: Story = { args: { repo: { ...repo, operation: 'merge' } } }
