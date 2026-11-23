import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Badge, Button, PageHeader, SettingsCard, TextField } from '../design-system'

const meta = { title: 'Patterns/SettingsCard', component: SettingsCard, args: { title: '작성자 프로필', description: '개인·업무처럼 자주 쓰는 작성자 정보를 저장해 둡니다.' } } satisfies Meta<typeof SettingsCard>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { args: { children: <><TextField label="작성자 이름" /><div className="bl-actions"><Button variant="primary">프로필 저장</Button></div></> }, play: async ({ canvasElement }) => {
  await expect(within(canvasElement).getByRole('region', { name: '작성자 프로필' })).toBeVisible()
} }
export const WithStatus: Story = { args: { title: 'Claude Code', description: '설치 확인됨', aside: <><Badge>사용 안 함</Badge><Button variant="primary">사용하기</Button></> } }
export const HeadingOnly: Story = {}
export const SettingsPage: Story = { render: args => <div><PageHeader eyebrow="설정" title="앱 설정" description="커밋에 남길 작성자 이름·이메일을 프로필로 저장하고 저장소마다 골라 적용합니다." /><SettingsCard {...args} /></div> }
