import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { FilterBar, TextField } from '../design-system'

const meta = {
  title: 'Components/FilterBar', component: FilterBar,
  args: { label: '커밋 필터', count: 0, context: <span>전체 브랜치</span>,
    search: <TextField label="커밋 검색" />, children: <TextField label="작성자" /> },
} satisfies Meta<typeof FilterBar>
export default meta
type Story = StoryObj<typeof meta>

export const Collapsed: Story = {}
export const ActiveFilters: Story = {
  args: { count: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: '커밋 필터' })
    await expect(toggle).toHaveAccessibleDescription('필터 1개 적용 중')
    await userEvent.click(toggle)
    await userEvent.click(canvas.getByLabelText('작성자'))
    await userEvent.keyboard('{Escape}')
    await expect(toggle).toHaveFocus()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.getByLabelText('커밋 검색')).toBeVisible()
  },
}
