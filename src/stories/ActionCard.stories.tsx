import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ActionCard, ActionCardGrid } from '../design-system'

const meta = { title: 'Components/ActionCard', component: ActionCard, args: { icon: 'folderOpen', title: '저장소 열기', description: '이 컴퓨터에 있는 Git 저장소 폴더를 엽니다.', onClick: fn() } } satisfies Meta<typeof ActionCard>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { play: async ({ canvasElement, args }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: '저장소 열기' }))
  await expect(args.onClick).toHaveBeenCalledOnce()
  await expect(within(canvasElement).getByRole('button', { name: '저장소 열기' })).toHaveAccessibleDescription('이 컴퓨터에 있는 Git 저장소 폴더를 엽니다.')
} }
export const Primary: Story = { args: { primary: true } }
export const Disabled: Story = { args: { disabled: true } }
export const StartScreen: Story = { render: args => <ActionCardGrid label="시작 방법">
  <ActionCard {...args} primary />
  <ActionCard icon="download" title="저장소 복제" description="GitHub·GitLab 등 원격 주소에서 내려받습니다." onClick={args.onClick} />
  <ActionCard icon="plus" title="새 저장소 만들기" description="빈 폴더에 새 Git 저장소를 시작합니다." onClick={args.onClick} />
</ActionCardGrid>, play: async ({ canvasElement }) => {
  await expect(within(canvasElement).getByRole('group', { name: '시작 방법' })).toBeVisible()
} }
