import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { TextField } from '../design-system/components'
const meta = { title: 'Components/TextField', component: TextField, args: { label: '브랜치 이름', placeholder: 'feature/new-work', hint: '기준 브랜치에서 새 작업을 시작합니다.' } } satisfies Meta<typeof TextField>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { play: async ({ canvasElement }) => { const input = within(canvasElement).getByLabelText('브랜치 이름'); await userEvent.type(input, 'feature/design-system'); await expect(input).toHaveValue('feature/design-system') } }
export const Error: Story = { args: { defaultValue: 'feature/new work', error: '공백 없이 브랜치 이름을 입력하세요.' } }
export const Disabled: Story = { args: { disabled: true, defaultValue: 'main' } }
export const ReadOnly: Story = { args: { readOnly: true, defaultValue: 'main', hint: '기준 브랜치는 변경할 수 없습니다.' } }
export const Search: Story = { args: { type: 'search', label: '커밋 검색', placeholder: '메시지, 해시, 작성자, 파일', hint: undefined } }
