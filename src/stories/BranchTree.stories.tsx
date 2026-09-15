import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BranchTree } from '../design-system/Workspace'
import { exampleBranches } from '../design-system/examples'
const meta = { title: 'Patterns/BranchTree', component: BranchTree, args: { branches: exampleBranches, value: null, currentBranch: 'feature/branch-filter', onChange: fn() } } satisfies Meta<typeof BranchTree>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Nested: Story = {
  decorators: [Story => <div style={{ width: 184 }}><Story /></div>],
  args: { branches: ['main', 'feature/ui/buttons', 'feature/ui/긴-한글-브랜치-이름-가독성-확인', 'fix/keyboard'], value: 'feature/ui/buttons', currentBranch: 'main' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement), folder = canvas.getByText('ui', { selector: 'summary' })
    await userEvent.click(folder)
    await expect(canvas.getByRole('button', { name: '이력 조회: feature/ui/buttons', hidden: true })).not.toBeVisible()
    folder.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.click(canvas.getByRole('button', { name: '이력 조회: feature/ui/buttons' }))
    await expect(args.onChange).toHaveBeenCalledWith('feature/ui/buttons')
  },
}
export const Repository: Story = { args: { groups: [
  { id: 'local', label: 'LOCAL', items: [{ id: 'refs/heads/main', label: 'main', current: true }, { id: 'refs/heads/feature/한글', label: 'feature/한글' }] },
  { id: 'remote:origin', label: 'ORIGIN', items: [{ id: 'refs/remotes/origin/main', label: 'main' }] },
  { id: 'worktrees', label: 'WORKTREES', kind: 'worktree', items: [{ id: '/project', label: 'main', description: '/project', current: true }, { id: '/project-linked', label: 'feature/한글', description: '/project-linked' }, { id: '/missing', label: '경로 확인 필요', disabled: true }] },
], value: 'refs/remotes/origin/main' } }
export const NoRemote: Story = { args: { groups: [{ id: 'local', label: 'LOCAL', items: [] }, { id: 'remote:origin', label: 'ORIGIN', empty: 'Fetch 후 원격 추적 브랜치가 나타납니다.', items: [] }, { id: 'worktrees', label: 'WORKTREES', kind: 'worktree', items: [] }] } }

export const StashAndWorktrees: Story = {
  decorators: [Story => <div style={{ width: 220 }}><Story /></div>],
  args: { value: 'stash:abc', groups: [
    { id: 'stashes', label: 'STASH', kind: 'stash', action: { label: 'Stash 보관함 열기', onClick: fn() }, items: [{ id: 'stash:abc', label: 'On feature/ui: 한글 편집 중 보관한 변경', description: 'stash@{0} · 2026. 9. 14.' }] },
    { id: 'worktrees', label: 'WORKTREES', kind: 'worktree', action: { label: 'Worktree 관리', onClick: fn(), selected: false }, items: [{ id: '/project', label: 'feature/ui', current: true }] },
  ] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const stash = canvas.getByRole('button', { name: /^Stash 보기:/ })
    stash.focus(); await userEvent.keyboard('{Enter}')
    await expect(args.onChange).toHaveBeenCalledWith('stash:abc')
    await expect(stash).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(canvas.getByRole('button', { name: 'Worktree 관리' }))
    await expect(args.groups![1].action!.onClick).toHaveBeenCalled()
  },
}
export const StashEmpty: Story = { args: { groups: [{ id: 'stashes', label: 'STASH', kind: 'stash', action: { label: 'Stash 보관함 열기', onClick: fn() }, empty: '보관한 변경이 없습니다.', items: [] }] } }

export const SelectedFolders: Story = {
  decorators: [Story => <div style={{ width: 246 }}><Story /></div>],
  args: { value: 'refs/heads/feature/ui/current', groups: [
    { id: 'local', label: 'LOCAL', items: [
      { id: 'refs/heads/main', label: 'main', tracking: { ahead: 0, behind: 0 } },
      { id: 'refs/heads/feature/ui/current', label: 'feature/ui/current', current: true, tracking: { ahead: 3, behind: 12 } },
      { id: 'refs/heads/feature/api/other', label: 'feature/api/other', tracking: { ahead: null, behind: null } },
      { id: 'refs/heads/fix/한글-긴-이름', label: 'fix/한글-긴-이름' },
    ] },
    { id: 'remote:origin', label: 'ORIGIN', items: [{ id: 'refs/remotes/origin/feature/ui/current', label: 'feature/ui/current' }] },
  ] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: '이력 조회: feature/ui/current' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: '이력 조회: feature/api/other', hidden: true })).not.toBeVisible()
    await expect(canvas.getByRole('button', { name: '이력 조회: origin/feature/ui/current', hidden: true })).not.toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'LOCAL 전체 펼치기' }))
    await expect(canvas.getByRole('button', { name: '이력 조회: feature/api/other' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'LOCAL 전체 접기' }))
    await expect(canvas.getByRole('button', { name: '이력 조회: feature/ui/current', hidden: true })).not.toBeVisible()
    await expect(canvas.getByRole('button', { name: '이력 조회: main' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'ORIGIN 전체 펼치기' }))
    await expect(canvas.getByRole('button', { name: '이력 조회: origin/feature/ui/current' })).toBeVisible()
  },
}
