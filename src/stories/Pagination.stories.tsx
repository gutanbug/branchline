import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Pagination } from '../design-system'
const meta = { title: 'Components/Pagination', component: Pagination, args: { label: '프로젝트 페이지', page: 1, hasMore: true, onChange: () => {} } } satisfies Meta<typeof Pagination>
export default meta
type Story = StoryObj<typeof meta>
function Example() { const [page, setPage] = useState(1); return <Pagination label="프로젝트 페이지" page={page} hasMore={page < 2} onChange={setPage} /> }
export const Default: Story = { render: () => <Example />, play: async ({ canvasElement }) => { const canvas = within(canvasElement); await expect(canvas.getByRole('button', { name: '이전' })).toBeDisabled(); await userEvent.click(canvas.getByRole('button', { name: '다음' })); await expect(canvas.getByText('2페이지')).toBeVisible(); await expect(canvas.getByRole('button', { name: '다음' })).toBeDisabled(); await userEvent.click(canvas.getByRole('button', { name: '이전' })); await expect(canvas.getByText('1페이지')).toBeVisible() } }
export const Loading: Story = { args: { busy: true } }
export const Empty: Story = { args: { hasMore: false } }
export const Range: Story = { args: { summary: '1–100개 표시', previousLabel: '이전 보관 항목', nextLabel: '다음 보관 항목' } }
