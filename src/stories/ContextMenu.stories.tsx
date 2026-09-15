import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor, userEvent, within } from 'storybook/test'
import { Button, ContextMenu } from '../design-system'
const select = fn()
const meta = { title: 'Components/ContextMenu', component: ContextMenu, args: { label: 'feature/검토', description: 'LOCAL · a1b2c3d4', showButton: true, children: <Button onClick={select}>feature/검토</Button>, groups: [[{ label: '그래프에서 위치 보기', onClick: select }, { label: 'Solo · 이 브랜치만 보기', onClick: select }], [{ label: '체크아웃', onClick: select, disabled: true, hint: '변경을 먼저 보관하세요' }]] }, parameters: { layout: 'centered' } } satisfies Meta<typeof ContextMenu>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body)
  await userEvent.click(canvas.getByRole('button', { name: 'feature/검토 메뉴' }))
  await expect(await body.findByRole('menuitem', { name: /체크아웃/ })).toHaveAttribute('aria-disabled', 'true')
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(canvas.getByRole('button', { name: 'feature/검토 메뉴' })).toHaveFocus())
  await userEvent.keyboard('{Enter}')
  await waitFor(() => expect(body.getByRole('menuitem', { name: '그래프에서 위치 보기' })).toHaveFocus())
  await userEvent.keyboard('{ArrowDown}')
  await waitFor(() => expect(body.getByRole('menuitem', { name: 'Solo · 이 브랜치만 보기' })).toHaveFocus())
  await userEvent.keyboard('{Enter}')
  await waitFor(() => expect(select).toHaveBeenCalled())
} }
export const LongName: Story = { args: { label: 'origin/feature/매우-긴-브랜치-이름의-줄바꿈과-화면-경계-확인' } }
export const Submenu: Story = { args: { groups: [[{ label: 'Fetch / Pull', items: [{ label: 'Fetch', onClick: select }, { label: 'Pull', onClick: select, disabled: true, hint: '이 브랜치를 먼저 체크아웃하세요' }] }]] }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body)
  const opener = canvas.getByRole('button', { name: 'feature/검토 메뉴' })
  await userEvent.click(opener)
  const trigger = await body.findByRole('menuitem', { name: 'Fetch / Pull' })
  trigger.focus(); await userEvent.keyboard('{ArrowRight}')
  const submenu = await body.findByRole('menu', { name: 'Fetch / Pull' })
  await waitFor(() => expect(within(submenu).getByRole('menuitem', { name: 'Fetch' })).toHaveFocus())
  await expect(within(submenu).getByRole('menuitem', { name: 'Pull' })).toHaveAttribute('aria-disabled', 'true')
  await userEvent.keyboard('{ArrowLeft}')
  await waitFor(() => expect(trigger).toHaveFocus())
  await userEvent.keyboard('{ArrowRight}')
  await waitFor(() => expect(body.getByRole('menu', { name: 'Fetch / Pull' })).toBeVisible())
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(trigger).toHaveFocus())
  await expect(body.getByRole('menu', { name: 'feature/검토 메뉴' })).toBeVisible()
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(opener).toHaveFocus())
} }
