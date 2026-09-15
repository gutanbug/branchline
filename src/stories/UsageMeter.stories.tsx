import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { UsageMeter } from '../design-system'
const meta = { title: 'Components/UsageMeter', component: UsageMeter, args: { label: '계정 한도 남음', value: 60 } } satisfies Meta<typeof UsageMeter>
export default meta
type Story = StoryObj<typeof meta>
export const Available: Story = { play: async ({ canvasElement }) => { const meter = within(canvasElement).getByRole('meter', { name: '계정 한도 남음' }); await expect(meter).toHaveAttribute('value', '60') } }
export const Exhausted: Story = { args: { value: 0 } }
