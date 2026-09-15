import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ResizeHandle } from '../design-system'
const meta = { title: 'Primitives/ResizeHandle', component: ResizeHandle, args: { label: '그래프 컬럼 너비', value: 160, min: 48, max: 280, onChange: fn() }, render: function Interactive(args) {
  const [value, setValue] = useState(args.value)
  return <div style={{ display: 'flex', height: 220, width: 440, border: '1px solid var(--border)' }}><div style={{ width: value, padding: 8 }}>그래프 {value}px</div><ResizeHandle {...args} value={value} onChange={next => { setValue(next); args.onChange(next) }} /><div style={{ flex: 1, padding: 8 }}>커밋 제목·설명</div></div>
} } satisfies Meta<typeof ResizeHandle>
export default meta
type Story = StoryObj<typeof meta>
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const handle = within(canvasElement).getByRole('separator')
  handle.focus(); await userEvent.keyboard('{ArrowRight}')
  await expect(handle).toHaveAttribute('aria-valuenow', '176')
  await userEvent.keyboard('{Home}{ArrowLeft}'); await expect(handle).toHaveAttribute('aria-valuenow', '48')
  await userEvent.keyboard('{End}{ArrowRight}'); await expect(handle).toHaveAttribute('aria-valuenow', '280')
} }
