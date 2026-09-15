import { useRef } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Button, Dialog, TextField } from '../design-system/components'
const meta = { title: 'Components/Dialog', component: Dialog, parameters: { docs: { description: { component: '네이티브 dialog: 포커스 제한, Escape 닫기, 호출 버튼으로 포커스 복귀. 제목을 필수로 제공합니다.' } } } } satisfies Meta<typeof Dialog>
export default meta
function Example({ size = 'default' }: { size?: 'default' | 'wide' }) { const ref = useRef<HTMLDialogElement>(null); return <><Button onClick={() => ref.current?.showModal()}>브랜치 만들기</Button><Dialog dialogRef={ref} title="브랜치 만들기" size={size}><p>예제 다이얼로그입니다. 실제 브랜치를 생성하지 않습니다.</p><TextField label="새 브랜치 이름" placeholder="feature/new-work" /><div className="row"><Button onClick={() => ref.current?.close()}>취소</Button><Button variant="primary" onClick={() => ref.current?.close()}>예제 생성</Button></div></Dialog></> }
export const Default: StoryObj = { render: () => <Example /> }
export const OpenAndClose: StoryObj = { render: () => <Example />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const trigger = canvas.getByRole('button', { name: '브랜치 만들기' })
  await userEvent.click(trigger)
  const dialog = canvas.getByRole('dialog', { name: '브랜치 만들기' })
  await expect(dialog).toBeVisible()
  await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toHaveFocus()
} }

export const Wide: StoryObj = { render: () => <Example size="wide" />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole("button", { name: "브랜치 만들기" }))
  await expect(canvas.getByRole("dialog")).toHaveClass("bl-dialog-wide")
} }
