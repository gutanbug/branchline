import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { CommitList } from '../design-system/Workspace'
import { exampleCommits } from '../design-system/examples'
const meta = { title: 'Patterns/CommitList', component: CommitList, args: { commits: exampleCommits, selectedHash: null, onSelect: fn() } } satisfies Meta<typeof CommitList>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Selected: Story = { args: { selectedHash: exampleCommits[0].hash } }
export const Empty: Story = { args: { commits: [] } }
