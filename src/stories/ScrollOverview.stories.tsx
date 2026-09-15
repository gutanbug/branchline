import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ScrollOverview } from '../design-system'
const meta = { title: 'Primitives/ScrollOverview', component: ScrollOverview, args: { label: '누적 이력 이동', value: 0, viewport: .2, onChange: fn(), children: <svg viewBox="0 0 44 300" preserveAspectRatio="none"><path d="M12 0 V300 M12 50 C12 70 32 70 32 90 V220 C32 240 12 240 12 260" fill="none" stroke="currentColor" /></svg> }, render: function Interactive(args) {
  const [value, setValue] = useState(args.value)
  return <div style={{ display: 'grid', width: 44, height: 300 }}><ScrollOverview {...args} value={value} onChange={next => { setValue(next); args.onChange(next) }} /></div>
} } satisfies Meta<typeof ScrollOverview>
export default meta
type Story = StoryObj<typeof meta>
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const slider = within(canvasElement).getByRole('slider')
  slider.focus(); await userEvent.keyboard('{ArrowDown}')
  await expect(slider).toHaveAttribute('aria-valuenow', '2')
  await userEvent.keyboard('{PageDown}'); await expect(slider).toHaveAttribute('aria-valuenow', '27')
  await userEvent.keyboard('{End}{ArrowDown}'); await expect(slider).toHaveAttribute('aria-valuenow', '100')
  await userEvent.keyboard('{Home}'); await expect(slider).toHaveAttribute('aria-valuenow', '0')
} }
export const AllVisible: Story = { args: { viewport: 1 }, play: async ({ canvasElement, args }) => {
  const slider = within(canvasElement).getByRole('slider')
  slider.focus(); await userEvent.keyboard('{End}')
  await expect(slider).toHaveAttribute('aria-disabled', 'true')
  await expect(args.onChange).not.toHaveBeenCalled()
} }
