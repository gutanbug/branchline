import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { BranchFilter } from '../design-system/components'
import { exampleBranches } from '../design-system/examples'
const meta = { title: 'Components/BranchFilter', component: BranchFilter, args: { branches: exampleBranches, value: null, onChange: () => {} }, parameters: { docs: { description: { component: '검색 입력과 결과 목록을 분리합니다. ↑/↓로 이동, Enter로 선택, Escape와 바깥 클릭으로 닫습니다. 선택은 조회 필터만 변경합니다.' } } } } satisfies Meta<typeof BranchFilter>
export default meta
type Story = StoryObj<typeof meta>
function Example(args: React.ComponentProps<typeof BranchFilter>) { const [value, setValue] = useState(args.value); return <BranchFilter {...args} value={value} onChange={setValue} /> }
export const Default: Story = { render: args => <Example {...args} /> }
export const SearchAndSelect: Story = { render: args => <Example {...args} />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: '조회 브랜치: 전체' }))
  const input = canvas.getByRole('textbox', { name: '브랜치 검색' })
  await userEvent.type(input, 'keyboard')
  await expect(input).toHaveFocus()
  await userEvent.keyboard('{ArrowDown}{Enter}')
  await expect(canvas.getByRole('button', { name: '조회 브랜치: fix/keyboard-nav' })).toHaveFocus()
} }
export const NoResults: Story = { render: args => <Example {...args} />, play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole('button', { name: '조회 브랜치: 전체' })); await userEvent.type(canvas.getByLabelText('브랜치 검색'), 'unknown'); await expect(canvas.getByRole('status')).toHaveTextContent('검색 결과가 없습니다') } }
export const LongName: Story = { args: { branches: ['feature/design-system/very-long-branch-name-for-overflow-review'], value: 'feature/design-system/very-long-branch-name-for-overflow-review' } }
export const Disabled: Story = { args: { disabled: true } }
