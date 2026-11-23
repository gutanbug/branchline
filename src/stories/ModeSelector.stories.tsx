import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ModeSelector } from '../design-system'

const meta = { title: 'Components/ModeSelector', component: ModeSelector, args: { label: '표시 방식', options: [['list', '목록'], ['tree', '트리']], value: 'list', onChange: fn() },
  render: function Example(args) { const [value, setValue] = useState(args.value); return <ModeSelector {...args} value={value} onChange={next => { setValue(next); args.onChange(next) }} /> },
} satisfies Meta<typeof ModeSelector>
export default meta
export const Keyboard: StoryObj<typeof meta> = { play: async ({ canvasElement, args }) => {
  const group = within(within(canvasElement).getByRole('group', { name: '표시 방식' })), list = group.getByRole('button', { name: '목록' }), tree = group.getByRole('button', { name: '트리' })
  await userEvent.click(list)
  await expect(args.onChange).not.toHaveBeenCalled()
  await userEvent.keyboard('{ArrowRight}')
  await expect(tree).toHaveFocus()
  await expect(list).toHaveAttribute('aria-pressed', 'true')
  await userEvent.keyboard('{Enter}')
  await expect(tree).toHaveAttribute('aria-pressed', 'true')
  await expect(list).toHaveAttribute('aria-pressed', 'false')
  await expect(args.onChange).toHaveBeenCalledTimes(1)
} }
