import '../app/desktop.css'
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import { ReviewFilters } from '../features/hosting/ReviewFilters'
import { defaultReviewFilter } from '../features/hosting/queries'
const meta = { title: 'Patterns/ReviewFilters', component: ReviewFilters, args: { value: defaultReviewFilter, github: true, onChange: fn(), onOpenReview: fn() }, render: function Example(args) { const [value, setValue] = useState(args.value); return <ReviewFilters {...args} value={value} onChange={next => { setValue(next); args.onChange(next) }} /> } } satisfies Meta<typeof ReviewFilters>
export default meta
type Story = StoryObj<typeof meta>
export const SearchAndReset: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement), search = canvas.getByRole('textbox', { name: '리뷰 검색' })
  await userEvent.click(canvas.getByRole('button', { name: '내 직접 검토 요청' }))
  await userEvent.click(canvas.getByRole('button', { name: '7일 이상 전' }))
  await userEvent.type(search, '수집 오류')
  await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith({ ...defaultReviewFilter, reviewRole: 'reviewer', inactiveDays: 7, titleSearch: '수집 오류' }))
  await userEvent.click(canvas.getByRole('button', { name: '리뷰 검색 지우기' }))
  await expect(search).toHaveFocus()
  await expect(search).toHaveValue('')
  await userEvent.click(canvas.getByRole('button', { name: '필터 초기화' }))
  await expect(args.onChange).toHaveBeenLastCalledWith(defaultReviewFilter)
} }
export const GitLab: Story = { args: { github: false } }
export const Narrow: Story = { decorators: [Story => <div style={{ width: 340 }}><Story /></div>] }

export const CIFailure: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement)
  const failed = canvas.getByRole('checkbox', { name: 'CI 실패만' })
  failed.focus()
  await userEvent.keyboard('[Space]')
  await expect(failed).toBeChecked()
  await expect(args.onChange).toHaveBeenLastCalledWith({ ...defaultReviewFilter, ciFilter: 'failed' })
  await expect(canvas.getByText(/현재 Head · 페이지당 30개 확인/)).toBeVisible()
  await userEvent.click(canvas.getByRole('button', { name: '필터 초기화' }))
  await expect(failed).not.toBeChecked()
} }

export const OpenByNumber: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement), search = canvas.getByRole('textbox', { name: '리뷰 검색' })
  await userEvent.type(search, '#12{Enter}')
  await expect(args.onOpenReview).toHaveBeenCalledWith('12', search)
  await expect(search).toHaveValue('')
  await expect(args.onChange).not.toHaveBeenCalled()
} }
