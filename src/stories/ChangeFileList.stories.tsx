import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button, ChangeFileList, FileChangeRow } from '../design-system'
const paths = ['src/한글/수정.ts', 'src/api/index.ts', 'src/ui/index.ts', 'README.md', 'docs/guide.md', 'docs/setup.md']
const meta = { title: 'Components/ChangeFileList', component: ChangeFileList, args: { label: '작업 파일', paths, actions: <Button onClick={fn()}>모두 스테이징</Button>, empty: '작업 파일이 깨끗합니다.', renderFile: (index: number) => <FileChangeRow path={paths[index]} status="M" selected={false} staged={false} disabled={false} onToggle={() => {}} onSelect={() => {}} /> }, decorators: [Story => <div style={{ maxWidth: 460 }}><Story /></div>] } satisfies Meta<typeof ChangeFileList>
export default meta
type Story = StoryObj<typeof meta>
export const SearchTreeResize: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement), search = canvas.getByRole('textbox', { name: '작업 파일 검색' })
  await userEvent.type(search, '한글')
  await expect(canvas.getByText('수정.ts', { exact: true })).toBeVisible()
  await expect(canvas.queryByText('README.md', { exact: true })).toBeNull()
  await userEvent.clear(search); await userEvent.type(search, 'missing')
  await expect(canvas.getByText('일치하는 파일이 없습니다')).toBeVisible()
  await userEvent.click(canvas.getByRole('button', { name: '검색 지우기' }))
  await userEvent.click(canvas.getByRole('button', { name: '트리' }))
  const folder = canvas.getByText('src', { exact: true }); await userEvent.click(folder)
  await expect(canvas.getByText('수정.ts', { exact: true })).not.toBeVisible()
  await userEvent.click(folder)
  const handle = canvas.getByRole('separator'); handle.focus(); await userEvent.keyboard('{ArrowDown}')
  await expect(handle).toHaveAttribute('aria-valuenow', '376')
  await userEvent.keyboard('{Home}{ArrowUp}'); await expect(handle).toHaveAttribute('aria-valuenow', '160')
} }
export const Empty: Story = { args: { paths: [] } }
