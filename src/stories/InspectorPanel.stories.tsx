import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import { CodeDiff, EmptyState, InspectorPanel, Notice } from '../design-system'
const meta = { title: 'Patterns/InspectorPanel', component: InspectorPanel, decorators: [Story => <div style={{ height: 360, width: 300, display: 'flex' }}><Story /></div>], args: { title: '커밋 상세', summary: 'a12bc34 · 작성자', onClose: fn(), children: <CodeDiff value={'commit a12bc34\n작성자: 개발자\n\n긴 커밋 메시지와 실제 변경 내용\n' + '+ 한글 변경 내용\n'.repeat(60)} /> } } satisfies Meta<typeof InspectorPanel>
export default meta
type Story = StoryObj<typeof meta>
export const LongContent: Story = {}
export const Empty: Story = { args: { summary: '이력에서 커밋을 선택하세요', onClose: undefined, children: <EmptyState title="커밋을 선택하세요">선택한 기록이 여기에 유지됩니다.</EmptyState> } }
export const Loading: Story = { args: { children: <Notice>커밋을 읽고 있습니다…</Notice> } }
export const Error: Story = { args: { children: <Notice tone="error">커밋을 읽지 못했습니다. 저장소 상태를 새로고침하세요.</Notice> } }

export const Escape: Story = { play: async ({ canvasElement, args }) => {
  within(canvasElement).getByRole('button', { name: '커밋 상세 닫기' }).focus()
  await userEvent.keyboard('{Escape}')
  await expect(args.onClose).toHaveBeenCalled()
} }

export const ExpandAndReturn: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('checkbox', { name: '줄바꿈' }))
  await userEvent.click(canvas.getByRole('button', { name: '커밋 상세 크게 보기' }))
  await expect(await canvas.findByRole('checkbox', { name: '줄바꿈' })).toBeChecked()
  await expect(canvas.getByRole('dialog', { name: '커밋 상세 크게 보기' })).toBeVisible()
  await userEvent.click(within(canvas.getByRole('dialog')).getByRole('button', { name: '닫기' }))
  await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  await expect(canvas.getByRole('button', { name: '커밋 상세 크게 보기' })).toHaveFocus()
  await expect(await canvas.findByRole('checkbox', { name: '줄바꿈' })).toBeChecked()
  await waitFor(() => expect(canvas.getByRole('region', { name: '커밋 상세 본문' })).toHaveTextContent('commit a12bc34'))
} }

export const IntegratedDiffToolbar: Story = {
  args: { title: 'src/긴디렉터리/변경파일.ts', integratedToolbar: true, summary: undefined, onClose: undefined,
    children: (_expanded, actions) => <CodeDiff filename="src/긴디렉터리/변경파일.ts" value={'diff --git a/src/긴디렉터리/변경파일.ts b/src/긴디렉터리/변경파일.ts\n--- a/src/긴디렉터리/변경파일.ts\n+++ b/src/긴디렉터리/변경파일.ts\n@@ -1 +1 @@\n-before\n+after'} actions={actions} /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('src/긴디렉터리/변경파일.ts')).toHaveLength(1)
    await userEvent.click(canvas.getByRole('checkbox', { name: '줄바꿈' }))
    await userEvent.click(canvas.getByRole('button', { name: 'src/긴디렉터리/변경파일.ts 크게 보기' }))
    await expect(canvas.getByRole('dialog', { name: '파일 변경 크게 보기' })).toBeVisible()
    await expect(canvas.getByRole('checkbox', { name: '줄바꿈' })).toBeChecked()
    await userEvent.click(within(canvas.getByRole('dialog')).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(canvas.getByRole('button', { name: 'src/긴디렉터리/변경파일.ts 크게 보기' })).toHaveFocus()
    await expect(canvas.getByRole('checkbox', { name: '줄바꿈' })).toBeChecked()
  },
}
