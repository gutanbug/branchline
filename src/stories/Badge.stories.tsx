import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from '../design-system/components'
const meta = { title: 'Components/Badge', component: Badge, args: { children: '예제' } } satisfies Meta<typeof Badge>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Branch: Story = { args: { variant: 'branch', children: 'feature/branch-filter' } }
