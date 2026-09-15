import type { Meta, StoryObj } from '@storybook/react-vite'
import { Notice } from '../design-system/components'
const meta = { title: 'Components/Notice', component: Notice, args: { children: '예제 · 변경 사항을 적용했습니다.' } } satisfies Meta<typeof Notice>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}


export const Error: Story = { args: { tone: 'error', children: '원격 작업을 완료하지 못했습니다. 연결을 확인하고 다시 시도하세요.' } }
export const Compact: Story = { args: { compact: true, children: '이력을 갱신하고 있습니다…' } }
