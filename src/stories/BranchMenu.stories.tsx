import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '../design-system'
import { BranchMenu } from '../features/workspace/BranchMenu'
import type { Repository } from '../app/types'
const branch = { ref: 'refs/heads/dev/local', name: 'dev/local', sha: 'a'.repeat(40), tracking: { ref: 'refs/remotes/team/upstream/server/topic', ahead: 0, behind: 2 } }
const repo: Repository = { path: '/example', name: 'example', head: branch.sha, branch: 'dev/local', token: 'fixture', refs: [branch], files: [], shallow: false, operation: null, checkedAt: '', identity: { name: null, email: null } }
const action = fn()
const meta = { title: 'Features/BranchMenu', component: BranchMenu, args: { branch, repo, solo: '', disabled: false, onAction: action, showButton: true, children: <Button onClick={() => action('locate', branch)}>dev/local</Button> } } satisfies Meta<typeof BranchMenu>
export default meta
type Story = StoryObj<typeof meta>
export const Current: Story = { play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body)
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'dev/local 메뉴' }))
  await userEvent.click(await body.findByRole('menuitem', { name: 'Fetch / Pull' }))
  await expect(await body.findByRole('menuitem', { name: 'Pull…' })).not.toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(body.getByRole('menuitem', { name: 'Fetch…' }))
  await expect(action).toHaveBeenCalledWith('fetch', branch)
} }
export const OtherLocal: Story = { args: { repo: { ...repo, branch: 'main' } }, play: async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'dev/local 메뉴' }))
  await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole('menuitem', { name: 'Fetch / Pull' }))
  await expect(await within(canvasElement.ownerDocument.body).findByRole('menuitem', { name: 'Pull…' })).toHaveAttribute('aria-disabled', 'true')
} }
export const NoUpstream: Story = { args: { branch: { ...branch, tracking: undefined } } }
export const Remote: Story = { args: { branch: { ...branch, ref: branch.tracking.ref, name: 'team/upstream/server/topic', tracking: undefined } } }
export const DirtyPull: Story = { args: { repo: { ...repo, files: [{ path: 'draft.txt', originalPath: null, index: '?', working: '?', untracked: true, conflict: false }] } }, play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body)
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'dev/local 메뉴' }))
  await userEvent.click(await body.findByRole('menuitem', { name: 'Fetch / Pull' }))
  const pull = await body.findByRole('menuitem', { name: 'Pull…' })
  await expect(pull).not.toHaveAttribute('aria-disabled', 'true')
  await expect(pull).toHaveAccessibleDescription(/자동 Stash 후 복원/)
} }
