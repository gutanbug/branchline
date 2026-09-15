import type { Meta, StoryObj } from '@storybook/react-vite'
import { ToolbarButton } from '../design-system/components'
const meta = { title: 'Components/ToolbarButton', component: ToolbarButton, args: { icon: '↓', children: 'Fetch' } } satisfies Meta<typeof ToolbarButton>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true, icon: '↑', children: 'Push' } }
