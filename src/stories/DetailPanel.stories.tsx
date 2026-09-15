import type { Meta, StoryObj } from '@storybook/react-vite'
import { DetailPanel } from '../design-system/Workspace'
import { exampleCommits } from '../design-system/examples'
const meta = { title: 'Patterns/DetailPanel', component: DetailPanel, args: { commit: null } } satisfies Meta<typeof DetailPanel>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Selected: Story = { args: { commit: exampleCommits[0] } }
