import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CodeDiff } from '../design-system'
import { parseDiff, splitLines } from '../design-system/diff-model'
const patch = `diff --git a/config.yml b/config.yml
--- a/config.yml
+++ b/config.yml
@@ -1,3 +1,4 @@
 # 개발 환경
-old: true
+enabled: true
+endpoint: https://example.invalid/한국어/개발환경
 port: 3000
@@ -40 +41 @@ services
-image: old
+image: current
\\ No newline at end of file

diff --git a/new.txt b/new.txt
new file mode 100644
--- /dev/null
+++ b/new.txt
@@ -0,0 +1 @@
+새 파일
`
const meta = { title: 'Components/CodeDiff', component: CodeDiff, args: { value: patch } } satisfies Meta<typeof CodeDiff>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getByLabelText('이전 40행')).toHaveTextContent('40')
  await expect(canvas.getByLabelText('이후 41행')).toHaveTextContent('41')
  await userEvent.click(canvas.getByRole('button', { name: '좌우 비교' }))
  await expect(canvas.getByRole('table', { name: '이전과 이후 코드 비교' })).toBeVisible()
  await expect(canvasElement.querySelectorAll('.bl-diff-gap')).toHaveLength(1)
  await userEvent.click(canvas.getByRole('button', { name: '다음 변경 구간' }))
  await userEvent.click(canvas.getByRole('button', { name: '다음 변경 구간' }))
  await expect(canvas.getByText('변경 구간 2 / 2')).toBeVisible()
  await expect(canvas.getByRole('button', { name: '다음 변경 구간' })).toBeDisabled()
  await userEvent.click(canvas.getByRole('checkbox', { name: '줄바꿈' }))
  await expect(canvasElement.querySelector('.bl-diff-wrap')).not.toBeNull()
  await userEvent.click(canvas.getByRole('button', { name: '원본 diff' }))
  await expect(canvas.getByText('+++ b/config.yml')).toBeVisible()
  await userEvent.selectOptions(canvas.getByRole('combobox', { name: '변경 파일' }), '1')
  await userEvent.click(canvas.getByRole('button', { name: '통합 보기' }))
  await expect(canvas.getByText('새 파일', { exact: true })).toBeVisible()
  await expect(canvas.queryByLabelText('이전 0행')).toBeNull()
} }
export const Narrow: Story = { decorators: [Story => <div style={{ width: 310, maxWidth: '100%' }}><Story /></div>] }
export const PlainCode: Story = { args: { format: 'code', filename: '초안.txt', value: '+ 원문은 추가 줄이 아닙니다\n- 삭제 줄도 아닙니다\n@@ -1 +1 @@' }, play: async ({ canvasElement }) => { await expect(within(canvasElement).queryByRole('button', { name: '좌우 비교' })).toBeNull() } }
export const Empty: Story = { args: { value: '' } }
export const BinaryAndRename: Story = { args: { value: 'diff --git a/old.png b/new.png\nsimilarity index 100%\nrename from old.png\nrename to new.png\nBinary files a/old.png and b/new.png differ' } }
export const Unsupported: Story = { args: { value: 'diff --cc merge.txt\n@@@ -1 -1 +1 @@@\n++merged' }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByText(/병합 형식 또는 불완전한 diff/)).toBeVisible() } }
export const ParserCases: Story = { play: async () => {
  const parsed = parseDiff(patch)
  await expect(parsed.files.map(file => [file.path, file.added, file.deleted, file.unsupported])).toEqual([['config.yml', 3, 2, false], ['new.txt', 1, 0, false]])
  await expect(parsed.files[0].hunks[1].lines[1].noNewline).toBe(true)
  await expect(splitLines(parsed.files[0].hunks[0].lines).length).toBe(4)
  const signs = parseDiff('@@ -10,2 +20,2 @@\n---literal\n+++literal\n context\n', 'signs.txt').files[0]
  await expect(signs.hunks[0].lines.map(line => [line.text, line.old, line.next])).toEqual([['--literal',10,undefined],['++literal',undefined,20],['context',11,21]])
  await expect(signs.unsupported).toBe(false)
  await expect(parseDiff('@@ -1,2 +1,2 @@\n one').files[0].unsupported).toBe(true)
  await expect(parseDiff('@@ -1 +0,0 @@\n-removed').files[0].hunks[0].lines[0].next).toBeUndefined()
} }

export const StageHunks: Story = { args: { value: patch.split('diff --git a/new.txt')[0], hunkAction: { label: '구간 스테이징', onApply: fn() } }, play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: '변경 구간 2 구간 스테이징' }))
  await expect(args.hunkAction?.onApply).toHaveBeenCalledWith(1)
  await userEvent.click(canvas.getByRole('button', { name: '좌우 비교' }))
  await userEvent.click(canvas.getByRole('button', { name: '변경 구간 1 구간 스테이징' }))
  await expect(args.hunkAction?.onApply).toHaveBeenCalledWith(0)
} }
