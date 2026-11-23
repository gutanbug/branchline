import { useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Button, Dialog, TextField, ToastMessage } from '../design-system'
const meta = { title: 'Components/Toast', component: ToastMessage, args: { scope: 'branchline · develop', message: 'Fetch를 완료했습니다.', tone: 'success', duration: 0 } } satisfies Meta<typeof ToastMessage>
export default meta
type Story = StoryObj<typeof meta>
export const Success: Story = {}
export const Info: Story = { args: { tone: 'info', message: '변경된 내용이 없습니다.' } }
export const Warning: Story = { args: { tone: 'warning', message: 'Pull은 완료했지만 변경 복원이 필요합니다. Stash 보관함에서 원본을 확인하세요.' } }
export const Error: Story = { args: { tone: 'error', message: `자동 Stash 원본을 유지했습니다.\n${'config/긴-폴더-이름/'.repeat(20)}설정.json\n충돌 해결 화면에서 변경을 검토하세요.` } }
export const DeduplicationAndKeyboard: Story = { render: () => <><TextField label="이전 작업" /><ToastMessage message="작업에 실패했습니다. 다시 시도하세요." tone="error" scope="저장소 A" /><ToastMessage message="작업에 실패했습니다. 다시 시도하세요." tone="error" scope="저장소 A" /></>, play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body)
  await waitFor(() => expect(body.getAllByRole('alert')).toHaveLength(1))
  await userEvent.click(within(canvasElement).getByRole('textbox', { name: '이전 작업' }))
  await userEvent.keyboard('{F6}')
  await expect(body.getByRole('region', { name: /작업 알림/ })).toHaveFocus()
  const toast = body.getByRole('alert')
  await userEvent.click(body.getByRole('button', { name: '알림 닫기' }))
  await waitFor(() => expect(toast).not.toBeInTheDocument())
} }
function DialogExample() {
  const dialog = useRef<HTMLDialogElement>(null), [message, setMessage] = useState('')
  return <><Button onClick={() => dialog.current?.showModal()}>설정 열기</Button><Dialog dialogRef={dialog} title="설정"><TextField label="이름" defaultValue="작업 초안" /><Button onClick={() => setMessage('설정을 저장하지 못했습니다. 초안은 유지했습니다.')}>저장</Button><ToastMessage message={message} tone="error" scope="앱 설정" /></Dialog></>
}
export const InsideDialog: Story = { render: () => <DialogExample />, play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body)
  await userEvent.click(within(canvasElement).getByRole('button', { name: '설정 열기' }))
  const dialog = body.getByRole('dialog', { name: '설정' })
  await userEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  await expect(await within(dialog).findByRole('alert')).toBeVisible()
  await expect(within(dialog).getByRole('button', { name: '저장' })).toHaveFocus()
  within(dialog).getByRole('button', { name: '알림 닫기' }).focus()
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(within(dialog).queryByRole('alert')).toBeNull())
  await expect(dialog).toBeVisible()
  await expect(within(dialog).getByRole('textbox')).toHaveValue('작업 초안')
  await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
} }
function ProgressExample() {
  const [running, setRunning] = useState(true)
  return <ToastMessage message={running ? 'Pull 실행 중…' : 'Pull을 취소했습니다.'} tone={running ? 'loading' : 'info'}>{running && <Button onClick={() => setRunning(false)}>작업 취소</Button>}</ToastMessage>
}
export const Progress: Story = { render: () => <ProgressExample />, play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body)
  const cancel = await body.findByRole('button', { name: '작업 취소' })
  cancel.focus()
  await userEvent.keyboard('{Escape}')
  await expect(body.getByText('Pull 실행 중…')).toBeVisible()
  await userEvent.click(cancel)
  await waitFor(() => expect(body.queryByText('Pull 실행 중…')).toBeNull())
  await expect(body.getByText('Pull을 취소했습니다.')).toBeVisible()
} }
export const TimerPausesOnHover: Story = { args: { duration: 800 }, play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body)
  const toast = await body.findByRole('status')
  await userEvent.hover(toast)
  await new Promise(resolve => setTimeout(resolve, 1100))
  await expect(toast).toBeVisible()
  await userEvent.unhover(toast)
  await waitFor(() => expect(body.queryByRole('status')).toBeNull(), { timeout: 3000 })
} }
