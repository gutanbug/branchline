import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ApplyTray } from '../design-system/Workspace'
const meta = { title: 'Patterns/ApplyTray', component: ApplyTray, args: { count: 0, onApply: fn() } } satisfies Meta<typeof ApplyTray>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Selected: Story = { args: { count: 3 } }
