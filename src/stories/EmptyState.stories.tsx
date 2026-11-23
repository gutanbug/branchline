import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button, EmptyState } from '../design-system/components'
const meta = { title: 'Components/EmptyState', component: EmptyState, args: {} } satisfies Meta<typeof EmptyState>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const NoResults: Story = { args: { title: '검색 결과가 없습니다', children: '검색어를 바꾸거나 필터를 초기화하세요.' } }
export const Decorated: Story = { args: { decorated: true, title: '아직 커밋이 없습니다', children: '파일을 스테이징하고 첫 커밋을 만들면 이력이 그래프로 표시됩니다.', action: <Button variant="primary">첫 커밋 만들기</Button> } }
