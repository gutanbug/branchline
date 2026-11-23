import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Disclosure, Button } from '../design-system'
const meta = { title: 'Components/Disclosure', component: Disclosure, args: { title: '상태·브랜치·본문', children: <Button onClick={fn()}>제공자에서 열기</Button> } } satisfies Meta<typeof Disclosure>
export default meta
type Story = StoryObj<typeof meta>
export const Collapsed: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement), summary = canvas.getByText('상태·브랜치·본문')
  await expect(canvas.getByText('제공자에서 열기')).not.toBeVisible()
  await userEvent.click(summary)
  await expect(canvas.getByRole('button', { name: '제공자에서 열기' })).toBeVisible()
  await userEvent.click(summary)
  await expect(canvas.getByText('제공자에서 열기')).not.toBeVisible()
} }
export const Expanded: Story = { args: { initiallyOpen: true, title: '계정 관리 · 연결 상태와 권한을 확인하세요' } }
export const Tree: Story = { args: { variant: 'tree', title: 'src', children: <span>components</span> } }
