import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn, expect, userEvent, within } from 'storybook/test'
import { Conversation } from '../design-system'
const meta = { title: 'Patterns/Conversation', component: Conversation, args: { messages: [], value: '', busy: false, onChange: fn(), onSend: fn(), onCancel: fn() } } satisfies Meta<typeof Conversation>
export default meta
type Story = StoryObj<typeof meta>
export const Empty: Story = { play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole('button', { name: '선택한 Agent에 전송' })).toBeDisabled() } }
export const FollowUp: Story = { args: { messages: [{ role: 'user', content: '양쪽의 예외 처리를 유지해줘.' }, { role: 'assistant', content: '두 조건을 함께 보존한 수정안을 제안합니다. 테스트는 실행하지 않았습니다.' }], value: '빈 입력도 처리해줘.' }, play: async ({ canvasElement, args }) => { await userEvent.click(within(canvasElement).getByRole('button', { name: '선택한 Agent에 전송' })); await expect(args.onSend).toHaveBeenCalled() } }
export const Running: Story = { args: { value: '두 조건을 유지해줘.', busy: true }, play: async ({ canvasElement, args }) => { await userEvent.click(within(canvasElement).getByRole('button', { name: '응답 중단' })); await expect(args.onCancel).toHaveBeenCalled() } }
export const Failure: Story = { args: { error: 'Agent 실행을 완료하지 못했습니다. 공식 CLI에서 로그인·버전·한도를 확인하세요.', value: '유지되는 입력 초안' } }
