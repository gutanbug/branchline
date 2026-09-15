import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { CodeDiff, DiffFileList } from '../design-system'
import { parseDiff } from '../design-system/diff-model'
const patch = 'commit 1234\nAuthor: 개발자\n\n    변경 요약\n\ndiff --git a/한글 파일.txt b/한글 파일.txt\nnew file mode 100644\n--- /dev/null\n+++ b/한글 파일.txt\n@@ -0,0 +1 @@\n+실제 변경 내용\ndiff --git a/old.png b/new.png\nsimilarity index 100%\nrename from old.png\nrename to new.png\nBinary files a/old.png and b/new.png differ'
function Example({ value = patch }: { value?: string }) {
  const [opened, setOpened] = useState<{ id: string; path: string; value: string } | null>(null)
  return <><DiffFileList value={value} selected={opened?.id} onOpen={setOpened} />{opened && <CodeDiff value={opened.value} filename={opened.path} />}</>
}
const meta = { title: 'Components/DiffFileList', component: Example } satisfies Meta<typeof Example>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.queryByText('실제 변경 내용')).toBeNull()
  await expect(canvas.getByText('이름 변경')).toBeVisible()
  await userEvent.click(canvas.getByRole('button', { name: '한글 파일.txt 변경 열기' }))
  await expect(canvas.getByText('실제 변경 내용')).toBeVisible()
  await expect(canvas.getByRole('button', { name: '한글 파일.txt 변경 열기' })).toHaveAttribute('aria-pressed', 'true')
  await expect(parseDiff('diff --git a/old.png b/a/new.png\nrename from old.png\nrename to a/new.png').files[0].path).toBe('a/new.png')
  await expect(parseDiff('diff --git a/a/image.png b/a/image.png\nBinary files differ').files[0].path).toBe('a/image.png')
  await expect(parseDiff('diff --git "a/tab\\tname.png" "b/tab\\tname.png"\nBinary files differ').files[0].path).toBe('tab\tname.png')
} }
export const Empty: Story = { args: { value: 'commit 1234\n\n    내용 변경 없는 커밋' } }
export const Narrow: Story = { decorators: [Story => <div style={{ width: 280, maxWidth: '100%' }}><Story /></div>] }
