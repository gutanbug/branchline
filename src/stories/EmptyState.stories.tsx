import type { Meta, StoryObj } from '@storybook/react-vite'
import { EmptyState } from '../design-system/components'
const meta = { title: 'Components/EmptyState', component: EmptyState, args: {} } satisfies Meta<typeof EmptyState>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const NoResults: Story = { args: { title: '검색 결과가 없습니다', children: '검색어를 바꾸거나 필터를 초기화하세요.' } }
