import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import { FileMenuRow } from '../features/workspace/FileActions'
import type { GitFile, Repository } from '../app/types'
const action = fn(), file: GitFile = { path: 'service-main/src/test/한글 폴더/새로운파일.java', originalPath: null, untracked: true, conflict: false, index: '?', working: '?' }
const repo = { head: 'a'.repeat(40), files: [file], operation: null } as Repository
const meta = { title: 'Features/FileMenu', component: FileMenuRow, args: { path: file.path, file, repo, staged: false, status: '?', selected: false, disabled: false, stats: { added: 32, deleted: 0 }, onSelect: fn(), onToggle: fn(), onAction: action }, decorators: [Story => <div style={{ width: 520, maxWidth: '100%' }}><Story /></div>] } satisfies Meta<typeof FileMenuRow>
export default meta
type Story = StoryObj<typeof meta>
export const NewFile: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body), opener = canvas.getByRole('button', { name: `${file.path} 메뉴` })
  await userEvent.click(opener)
  await expect(await body.findByRole('menuitem', { name: '파일 이력 보기' })).toHaveAttribute('aria-disabled', 'true')
  const ignore = body.getByRole('menuitem', { name: '무시 규칙 추가' }); ignore.focus(); await userEvent.keyboard('{ArrowRight}')
  const submenu = await body.findByRole('menu', { name: '무시 규칙 추가' })
  await expect(within(submenu).getByRole('menuitem', { name: '같은 확장자 무시' })).not.toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(within(submenu).getByRole('menuitem', { name: '이 파일 무시' }))
  await expect(action).toHaveBeenCalledWith('ignore-file')
  await waitFor(() => expect(opener).toHaveFocus())
  const selection = canvas.getByRole('button', { name: /추가.*새로운파일/ }); selection.focus(); await userEvent.keyboard('{Shift>}{F10}{/Shift}')
  await expect(await body.findByRole('menuitem', { name: '변경 패치 저장' })).toBeVisible()
  await userEvent.keyboard('{Escape}'); await waitFor(() => expect(selection).toHaveFocus())
} }
export const StagedFile: Story = { args: { staged: true, status: 'M', file: { ...file, untracked: false, index: 'M', working: 'M' } } }
export const Conflict: Story = { args: { file: { ...file, untracked: false, conflict: true, index: 'U', working: 'U' }, status: '!', disabled: true, menuDisabled: false } }
