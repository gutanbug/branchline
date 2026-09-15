import type { Meta, StoryObj } from '@storybook/react-vite'
import { Checkbox } from '../design-system/components'
const meta = { title: 'Components/Checkbox', component: Checkbox, args: { label: '변경 파일 포함' } } satisfies Meta<typeof Checkbox>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Checked: Story = { args: { defaultChecked: true } }
export const Disabled: Story = { args: { disabled: true } }
