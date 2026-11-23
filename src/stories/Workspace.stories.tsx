import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Workspace } from '../design-system/Workspace'
const meta = { title: 'Patterns/Workspace', component: Workspace, parameters: { layout: 'fullscreen', docs: { description: { component: 'handoff의 appbar → sidebar + workspace → history + detail 구조를 React 컴포넌트로 조합한 예제. 실제 Git 작업은 수행하지 않습니다.' } } } } satisfies Meta<typeof Workspace>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
export const Error: Story = { args: { error: true } }
export const SelectAndApply: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const detail = within(canvas.getByRole('complementary', { name: '커밋 상세' }))
  await expect(detail.getByText('커밋을 선택하세요')).toBeVisible()
  await expect(detail.queryByText('a8f31c2')).not.toBeInTheDocument()
  await userEvent.click(canvas.getByRole('button', { name: /브랜치 필터 선택 UI 추가/ }))
  await expect(detail.getByText('a8f31c2')).toBeVisible()
  await userEvent.click(canvas.getByLabelText('선택한 커밋의 예제 변경 포함'))
  await userEvent.click(canvas.getByRole('button', { name: '변경 사항 적용' }))
  await expect(within(canvasElement.ownerDocument.body).getByRole('status')).toHaveTextContent('실제 파일은 변경되지 않았습니다')
  await expect(canvas.getByRole('button', { name: '변경 사항 적용' })).toBeDisabled()
} }
export const FilterWithoutCheckout: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: '이력 조회: main' }))
  await expect(canvas.getByText('현재 체크아웃', { selector: 'small' }).previousElementSibling).toHaveTextContent('feature/branch-filter')
  await expect(canvas.queryByRole('button', { name: /브랜치 필터 선택 UI 추가/ })).not.toBeInTheDocument()
  await expect(canvas.getByText('커밋을 선택하세요')).toBeVisible()
  await userEvent.type(canvas.getByRole('searchbox'), 'no-such-commit')
  await expect(canvas.getByText('일치하는 커밋이 없습니다')).toBeVisible()
} }
