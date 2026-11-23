import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '../design-system'
import { BranchMenu } from '../features/workspace/BranchMenu'
import type { Repository } from '../app/types'
const branch = { ref: 'refs/heads/dev/local', name: 'dev/local', sha: 'a'.repeat(40), tracking: { ref: 'refs/remotes/team/upstream/server/topic', ahead: 0, behind: 2 } }
const repo: Repository = { path: '/example', name: 'example', head: branch.sha, branch: 'dev/local', token: 'fixture', refs: [branch], files: [], shallow: false, operation: null, checkedAt: '', identity: { name: null, email: null } }
const action = fn()
const meta = { title: 'Features/BranchMenu', component: BranchMenu, args: { branch, repo, solo: '', disabled: false, onAction: action, showButton: true, children: <Button onClick={() => action('locate', branch)}>dev/local</Button> } } satisfies Meta<typeof BranchMenu>
export default meta
type Story = StoryObj<typeof meta>
async function expectMenuClosed(opener: HTMLElement) {
  await waitFor(async () => {
    await expect(opener.ownerDocument.querySelector('[role="menu"]')).toBeNull()
    await expect(opener).toHaveFocus()
  })
}
export const Current: Story = { play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body)
  const opener = within(canvasElement).getByRole('button', { name: 'dev/local 메뉴' })
  await userEvent.click(opener)
  await userEvent.click(await body.findByRole('menuitem', { name: 'Fetch / Pull' }))
  await expect(await body.findByRole('menuitem', { name: 'Pull' })).not.toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(body.getByRole('menuitem', { name: 'Fetch' }))
  await expect(action).toHaveBeenCalledWith('fetch', branch)
  await expectMenuClosed(opener)
} }
export const OtherLocal: Story = { args: { repo: { ...repo, branch: 'main' } }, play: async ({ canvasElement }) => {
  const opener = within(canvasElement).getByRole('button', { name: 'dev/local 메뉴' })
  await userEvent.click(opener)
  await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole('menuitem', { name: 'Fetch / Pull' }))
  const pull = await within(canvasElement.ownerDocument.body).findByRole('menuitem', { name: 'Pull' })
  await expect(pull).not.toHaveAttribute('aria-disabled', 'true')
  await expect(pull).toHaveAccessibleDescription(/server\/topic → dev\/local.*체크아웃 없이 갱신/)
  await userEvent.click(pull)
  await expect(action).toHaveBeenCalledWith('pull', branch)
  await expectMenuClosed(opener)
} }
export const NoUpstream: Story = { args: { branch: { ...branch, tracking: undefined } } }
export const Remote: Story = { args: { branch: { ...branch, ref: branch.tracking.ref, name: 'team/upstream/server/topic', tracking: undefined } } }
export const DirtyPull: Story = { args: { repo: { ...repo, files: [{ path: 'draft.txt', originalPath: null, index: '?', working: '?', untracked: true, conflict: false }] } }, play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body)
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'dev/local 메뉴' }))
  await userEvent.click(await body.findByRole('menuitem', { name: 'Fetch / Pull' }))
  const pull = await body.findByRole('menuitem', { name: 'Pull' })
  await expect(pull).not.toHaveAttribute('aria-disabled', 'true')
  await expect(pull).toHaveAccessibleDescription(/변경 유지 · 필요 시 자동 Stash/)
} }
