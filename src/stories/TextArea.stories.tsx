import type { Meta, StoryObj } from '@storybook/react-vite'
import { TextArea } from '../design-system/components'
const meta = { title: 'Components/TextArea', component: TextArea, args: { label: '커밋 설명', placeholder: '변경 이유를 입력하세요.' } } satisfies Meta<typeof TextArea>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
