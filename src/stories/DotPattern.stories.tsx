import type { Meta, StoryObj } from '@storybook/react-vite'
import { DotPattern } from '../design-system'

const meta = { title: 'Foundations/DotPattern', component: DotPattern, decorators: [Story => <div style={{ position: 'relative', height: 240, border: '1px solid var(--border)' }}><Story /></div>] } satisfies Meta<typeof DotPattern>
export default meta
type Story = StoryObj<typeof meta>
export const RadialFade: Story = {}
export const Flat: Story = { args: { fade: 'none' } }
export const Dense: Story = { args: { spacing: 10 } }
