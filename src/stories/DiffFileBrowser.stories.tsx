import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DiffFileBrowser, InspectorPanel } from '../design-system'
const value = ['src/api/config.ts', 'src/ui/config.ts', 'README.md'].map(path => `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+${path} updated`).join('\n')
const meta = { title: 'Components/DiffFileBrowser', component: DiffFileBrowser, args: { value, preview: false, onOpen: fn() } } satisfies Meta<typeof DiffFileBrowser>
export default meta
type Story = StoryObj<typeof meta>
export const Inline: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: '트리' }))
  await userEvent.click(canvas.getByRole('button', { name: 'src/ui/config.ts 변경 열기' }))
  await expect(args.onOpen).toHaveBeenCalledWith(expect.objectContaining({ path: 'src/ui/config.ts', id: '1' }))
  await expect(canvas.queryByRole('region', { name: '변경 내용' })).toBeNull()
} }
export const Expanded: Story = {
  render: args => <InspectorPanel title="커밋 상세">{expanded => <DiffFileBrowser {...args} preview={expanded} />}</InspectorPanel>,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: '커밋 상세 크게 보기' }))
    const dialog = within(canvas.getByRole('dialog'))
    await userEvent.click(dialog.getByRole('button', { name: '트리' }))
    const folder = dialog.getByText('api', { exact: true })
    await userEvent.click(folder)
    await expect(dialog.getByRole('button', { name: 'src/api/config.ts 변경 열기' })).not.toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'src/ui/config.ts 변경 열기' }))
    await expect(dialog.getByText('src/ui/config.ts updated')).toBeVisible()
    await expect(args.onOpen).not.toHaveBeenCalled()
    await expect(dialog.getByRole('button', { name: '← 변경 파일 목록' })).toHaveFocus()
    await userEvent.click(dialog.getByRole('button', { name: '← 변경 파일 목록' }))
    await expect(dialog.getByRole('button', { name: 'src/ui/config.ts 변경 열기' })).toHaveFocus()
    await expect(dialog.getByRole('button', { name: '트리' })).toHaveAttribute('aria-pressed', 'true')
    await expect(dialog.getByRole('button', { name: 'src/api/config.ts 변경 열기' })).not.toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'src/ui/config.ts 변경 열기' }))
    await userEvent.click(dialog.getByRole('button', { name: '닫기' }))
    await expect(canvas.queryByRole('dialog')).toBeNull()
    await expect(canvas.getByRole('button', { name: '커밋 상세 크게 보기' })).toHaveFocus()
  },
}
export const Narrow: Story = { ...Expanded, decorators: [Story => <div style={{ width: 280 }}><Story /></div>], play: undefined }
