import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import { ContentTabs, TextField } from '../design-system'
function Example() {
  const [selected, select] = useState('graph'), [open, setOpen] = useState(true)
  return <div style={{ height: 300 }}><ContentTabs label="검토 탭" selected={selected} onSelect={select} onClose={() => { setOpen(false); select('graph') }} tabs={[{ id: 'graph', label: '그래프', content: <TextField label="보존할 입력" defaultValue="유지되는 그래프 상태" /> }, ...(open ? [{ id: 'file', label: 'src/아주 긴 파일 이름/설정.ts', closable: true, content: <p>선택한 파일 변경</p> }] : [])]} /></div>
}
const meta = { title: 'Components/ContentTabs', component: Example } satisfies Meta<typeof Example>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('tab', { name: '그래프' }))
  await userEvent.keyboard('{ArrowRight}')
  await waitFor(() => expect(canvas.getByRole('tab', { name: /설정.ts/ })).toHaveFocus())
  await expect(canvas.getByRole('tabpanel', { name: /설정.ts/ })).toBeVisible()
  await userEvent.keyboard('{Delete}')
  await waitFor(() => expect(canvas.getByRole('tab', { name: '그래프' })).toHaveFocus())
  await expect(canvas.getByLabelText('보존할 입력')).toHaveValue('유지되는 그래프 상태')
  await expect(canvas.queryByRole('tab', { name: /설정.ts/ })).toBeNull()
} }
export const Narrow: Story = { decorators: [Story => <div style={{ width: 310, maxWidth: '100%' }}><Story /></div>] }

export const GraphOnly: Story = {
  render: () => <ContentTabs hideSingleTab label="검토 탭" selected="graph" tabs={[{ id: 'graph', label: '그래프', content: <p>커밋 이력</p> }]} onSelect={() => {}} onClose={() => {}} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('tablist')).not.toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: '그래프' })).toBeVisible()
  },
}
