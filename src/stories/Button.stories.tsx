import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '../design-system/components'

const meta = {
  title: 'Components/Button', component: Button,
  args: { children: '변경 사항 적용', onClick: fn() },
  argTypes: { variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] }, loading: { control: 'boolean' }, disabled: { control: 'boolean' } },
  parameters: { docs: { description: { component: '화면당 primary 동작은 하나. 최소 높이 44px. 로딩 상태는 중복 클릭을 차단합니다.' } } },
} satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>
export const Primary: Story = { args: { variant: 'primary' }, play: async ({ canvasElement, args }) => { await userEvent.click(within(canvasElement).getByRole('button')); await expect(args.onClick).toHaveBeenCalledOnce() } }
export const Secondary: Story = { args: { variant: 'secondary', children: '취소' } }
export const Ghost: Story = { args: { variant: 'ghost', children: '자세히 보기' } }
export const Disabled: Story = { args: { disabled: true, children: '충돌 해결 필요' } }
export const Loading: Story = { args: { variant: 'primary', loading: true, children: '적용 중…' }, play: async ({ canvasElement, args }) => { const button = within(canvasElement).getByRole('button'); await expect(button).toBeDisabled(); await userEvent.click(button); await expect(args.onClick).not.toHaveBeenCalled() } }
