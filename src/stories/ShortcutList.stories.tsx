import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ShortcutList } from '../design-system'
const meta = { title: 'Components/ShortcutList', component: ShortcutList, args: { groups: [
  { title: '커밋', items: [{ keys: ['⌘+Enter', 'Ctrl+Enter'], label: '스테이징한 변경 커밋' }] },
  { title: '그래프', items: [{ keys: ['/'], label: '커밋 검색' }, { keys: ['↑', '↓'], label: '이전·다음 커밋' }] },
] } } satisfies Meta<typeof ShortcutList>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getByRole('region', { name: '커밋' })).toBeVisible()
  await expect(canvas.getByText('스테이징한 변경 커밋')).toBeVisible()
} }
