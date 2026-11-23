import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { ScrollArea } from '../design-system'

const rows = Array.from({ length: 30 }, (_, i) => <p key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>브랜치 {i + 1}</p>)
const meta = { title: 'Components/ScrollArea', component: ScrollArea } satisfies Meta<typeof ScrollArea>
export default meta
type Story = StoryObj<typeof meta>
export const EdgeFade: Story = { render: () => <ScrollArea style={{ height: 220, width: 240 }} data-testid="area">{rows}</ScrollArea>, play: async ({ canvasElement }) => {
  const area = canvasElement.querySelector<HTMLElement>('[data-testid=area]')!
  await waitFor(() => expect(area.hasAttribute('data-more-below')).toBe(true))
  await expect(area.hasAttribute('data-more-above')).toBe(false)
  area.scrollTop = area.scrollHeight
  await waitFor(() => expect(area.hasAttribute('data-more-below')).toBe(false))
  await expect(area.hasAttribute('data-more-above')).toBe(true)
} }
export const ShortContent: Story = { render: () => <ScrollArea style={{ height: 220, width: 240 }} data-testid="area">{rows.slice(0, 3)}</ScrollArea>, play: async ({ canvasElement }) => {
  const area = canvasElement.querySelector<HTMLElement>('[data-testid=area]')!
  await expect(area.hasAttribute('data-more-below')).toBe(false)
} }
