import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Button, FileEditor } from '../design-system'
function Example() {
  const [expanded, setExpanded] = useState<string[]>([]), [filename, setFilename] = useState<string>(), [value, setValue] = useState('export const label = "한글"\n'), [saved, setSaved] = useState(value)
  return <div style={{ height: 420, display: 'flex' }}><FileEditor filename={filename} value={value} dirty={value !== saved} busy={false} onChange={setValue} expanded={expanded} onFolder={(path, open) => setExpanded(open ? [...expanded, path] : expanded.filter(p => p !== path))} onFile={setFilename} directories={{ '': { entries: [{ name: 'src', path: 'src', directory: true }, { name: 'linked', path: 'linked', directory: false, disabled: true }] }, src: { entries: [{ name: '설정.ts', path: 'src/설정.ts', directory: false }] } }} actions={<Button disabled={value === saved} onClick={() => setSaved(value)}>파일 저장</Button>} /></div>
}
const meta = { title: 'Components/FileEditor', component: Example } satisfies Meta<typeof Example>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getByText('오른쪽에서 파일을 선택하세요')).toBeVisible()
  await userEvent.click(canvas.getByText('src', { exact: true }))
  await userEvent.click(canvas.getByRole('button', { name: 'src/설정.ts 파일 열기' }))
  const editor = canvas.getByRole('textbox', { name: '파일 내용' })
  await userEvent.clear(editor); await userEvent.type(editor, 'const updated = true')
  await expect(canvas.getByText('저장하지 않음')).toBeVisible()
  await userEvent.click(canvas.getByRole('button', { name: '파일 저장' }))
  await expect(canvas.getByText('저장됨')).toBeVisible()
  await expect(canvas.getByRole('button', { name: 'linked 파일 열기' })).toBeDisabled()
} }
export const Narrow: Story = { decorators: [Story => <div style={{ width: 440, maxWidth: '100%' }}><Story /></div>] }
