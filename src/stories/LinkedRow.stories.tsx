import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { LinkedRow, ReviewListRow } from '../design-system'

const detail = fn()
const meta = {
  title: 'Patterns/LinkedRow', component: LinkedRow,
  args: { label: 'PR #12', onCopy: fn(), onOpen: fn(), children: <ReviewListRow identifier="#12" title="리뷰 링크 탐색 개선" author="개발자" status="열림" updated="방금" onClick={detail} /> },
} satisfies Meta<typeof LinkedRow>
export default meta
export const Actions: StoryObj<typeof meta> = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'PR #12 링크 복사' }))
  await expect(args.onCopy).toHaveBeenCalledOnce()
  await userEvent.click(canvas.getByRole('button', { name: 'PR #12 브라우저에서 열기' }))
  await expect(args.onOpen).toHaveBeenCalledOnce()
  await expect(detail).not.toHaveBeenCalled()
  await userEvent.click(canvas.getByRole('button', { name: '#12 리뷰 링크 탐색 개선' }))
  await expect(detail).toHaveBeenCalledOnce()
} }
