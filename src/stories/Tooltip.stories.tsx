import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import { Badge, Button, Tooltip } from '../design-system'
const content = <><strong>연결된 브랜치 2개</strong><ul><li><small>LOCAL</small><code>dev</code></li><li><small>REMOTE</small><code>origin/dev</code></li></ul></>
const meta = { title: 'Components/Tooltip', component: Tooltip, args: { content, children: <Button onClick={fn()}>연결된 브랜치</Button> } } satisfies Meta<typeof Tooltip>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement), body = within(document.body)
  await userEvent.hover(canvas.getByRole('button', { name: '연결된 브랜치' }))
  await expect(await body.findByRole('tooltip')).toHaveTextContent('origin/dev')
  await userEvent.hover(body.getByRole('tooltip'))
  await expect(body.getByRole('tooltip')).toBeVisible()
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(body.queryByRole('tooltip')).toBeNull())
} }
export const InsideCommitRow: Story = { render: () => <Button className="example-row" onClick={fn()}>선택 커밋 <Tooltip focusOwner=".example-row" content={content}><span title=""><Badge>+1</Badge></span></Tooltip></Button>, play: async ({ canvasElement }) => {
  const row = within(canvasElement).getByRole('button', { name: /선택 커밋/ }), body = within(document.body)
  row.focus()
  await expect(await body.findByRole('tooltip')).toHaveTextContent('LOCAL')
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(body.queryByRole('tooltip')).toBeNull())
  await expect(row).toHaveFocus()
} }
export const LongNames: Story = { args: { content: <><strong>연결된 브랜치 12개</strong><ul>{Array.from({ length: 12 }, (_, i) => <li key={i}><small>REMOTE</small><code>origin/feature/한글과-긴-브랜치-이름-{i}-변경사항을-확인합니다</code></li>)}</ul></> }, decorators: [Story => <div style={{ width: 280, display: 'flex', justifyContent: 'flex-end' }}><Story /></div>] }
