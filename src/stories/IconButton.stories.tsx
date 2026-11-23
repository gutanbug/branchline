import { useRef } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Button, ContextMenu, Dialog, IconButton } from '../design-system'
const meta = { title: 'Components/IconButton', component: IconButton, args: { icon: 'refresh', label: '상세 새로고침', onClick: fn() }, parameters: { layout: 'centered' } } satisfies Meta<typeof IconButton>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body)
  const button = canvas.getByRole('button', { name: '상세 새로고침' })
  await userEvent.hover(button)
  await expect(await body.findByRole('tooltip')).toHaveTextContent('상세 새로고침')
  await userEvent.unhover(button)
  button.focus()
  await userEvent.keyboard('{Enter}')
  await expect(meta.args.onClick).toHaveBeenCalled()
} }
export const Loading: Story = { args: { loading: true } }
export const Disabled: Story = { args: { disabled: true } }
export const Settings: Story = { args: { icon: 'settings', label: '앱 설정', 'aria-current': 'page' } }
function RepositoryMenu() {
  const dialog = useRef<HTMLDialogElement>(null)
  return <><ContextMenu menuOnly label="저장소 추가" groups={[[
    { label: '저장소 열기', onClick: fn() },
    { label: '새 저장소', onClick: fn(), disabled: true },
    { label: '저장소 복제', onClick: () => dialog.current?.showModal() },
  ]]}><IconButton icon="plus" label="저장소 추가" tooltip={false} /></ContextMenu>
    <Dialog dialogRef={dialog} title="저장소 복제"><Button onClick={() => dialog.current?.close()}>취소</Button></Dialog></>
}
export const RepositoryAdd: Story = { render: () => <RepositoryMenu />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body)
  const opener = canvas.getByRole('button', { name: '저장소 추가' })
  await expect(opener.querySelector('svg')).not.toBeNull()
  opener.focus(); await userEvent.keyboard('{Enter}')
  const first = await body.findByRole('menuitem', { name: '저장소 열기' })
  await waitFor(() => expect(first).toHaveFocus())
  await expect(body.getByRole('menuitem', { name: '새 저장소' })).toHaveAttribute('aria-disabled', 'true')
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(opener).toHaveFocus())
  await userEvent.click(opener)
  await userEvent.click(await body.findByRole('menuitem', { name: '저장소 복제' }))
  const modal = await body.findByRole('dialog', { name: '저장소 복제' })
  await expect(modal).toBeVisible()
  await userEvent.click(within(modal).getByRole('button', { name: '취소' }))
  await waitFor(() => expect(opener).toHaveFocus())
} }
