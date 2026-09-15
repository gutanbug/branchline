import type { Meta, StoryObj } from '@storybook/react-vite'
import { ActionSummary } from '../design-system'
const meta = { title: 'Patterns/ActionSummary', component: ActionSummary, args: { title: '리뷰 진행 요약', status: '열림', facts: [{ label: '작성자', value: 'developer' }, { label: '검토 요청', value: 'reviewer' }, { label: '대상', value: 'feature/tabs → main' }], next: '검토 요청 대상과 최신 커밋의 검사 결과를 확인하세요.' } } satisfies Meta<typeof ActionSummary>
export default meta
type Story = StoryObj<typeof meta>
export const Review: Story = {}
export const Unknown: Story = { args: { status: '미확인', facts: [{ label: '검토 요청', value: '제공되지 않음' }], next: '필수 검사와 승인 정책을 제공자에서 확인하세요. 미확인은 통과를 의미하지 않습니다.' } }
export const Failure: Story = { args: { title: 'CI 진행 요약', status: '실패', next: '실패한 작업의 로그를 확인하세요.' } }
