import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { FileChangeRow } from '../design-system'
function Example() {
  const [staged, setStaged] = useState(false), [selected, setSelected] = useState(false)
  return <div style={{ width: 420, maxWidth: '100%' }}><FileChangeRow path="service-main/src/test/한글 폴더/아주긴테스트파일이름.java" status="A" staged={staged} selected={selected} disabled={false} stats={{ added: 128, deleted: 0 }} onSelect={() => setSelected(!selected)} onToggle={() => setStaged(!staged)} /><FileChangeRow path="deleted.txt" status="D" staged={false} selected={false} disabled={false} stats={{ added: 0, deleted: 7 }} onSelect={() => {}} onToggle={() => {}} /><FileChangeRow path="image.png" status="M" staged={false} selected={false} disabled stats={{ added: null, deleted: null, reason: '바이너리' }} onSelect={() => {}} onToggle={() => {}} /><FileChangeRow path="pending.txt" status="M" staged={false} selected={false} disabled onSelect={() => {}} onToggle={() => {}} /></div>
}
const meta = { title: 'Components/FileChangeRow', component: Example } satisfies Meta<typeof Example>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getByLabelText('추가 128줄, 삭제 0줄')).toBeVisible()
  await userEvent.click(canvas.getByRole('button', { name: /java 스테이징$/ }))
  await expect(canvas.getByRole('button', { name: /java 스테이징 해제$/ })).toBeVisible()
  await expect(canvas.getByText('바이너리')).toBeVisible()
  await expect(canvas.getByLabelText('변경 줄 수 조회 중')).toBeVisible()
} }
