import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { MarkdownContent } from '../design-system'
const body = '# 변경 모듈\n\n**수집 안정성**을 개선합니다.\n\n- 기존 데이터 유지\n- [x] 실패 테스트\n- [ ] 배포 검증\n\n```sql\nSELECT * FROM collection;\n```\n\n| 모듈 | 변경 |\n| --- | --- |\n| core | 재시도 |\n\n[검토 링크](https://gitlab.example/team/demo/-/merge_requests/1)\n\n[차단 링크](javascript:alert(1))\n\n![자동 요청 금지](https://tracking.invalid/pixel)\n\n<script>alert(1)</script>\n'
const meta = { title: 'Components/MarkdownContent', component: MarkdownContent, args: { value: body, baseUrl: 'https://gitlab.example/team/demo/-/merge_requests/2', onOpenLink: fn(async () => null) } } satisfies Meta<typeof MarkdownContent>
export default meta
type Story = StoryObj<typeof meta>
export const FormattedAndSafe: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getByRole('heading', { name: '변경 모듈' })).toBeVisible()
  await expect(canvas.getByRole('table')).toHaveTextContent('재시도')
  await expect(canvas.getByLabelText('완료 항목')).toBeVisible()
  await expect(canvasElement.querySelectorAll('script,img,iframe')).toHaveLength(0)
  await expect(canvas.queryByRole('link', { name: '차단 링크' })).toBeNull()
  await userEvent.click(canvas.getByRole('link', { name: '검토 링크 ↗' }))
  await expect(args.onOpenLink).toHaveBeenCalledWith('https://gitlab.example/team/demo/-/merge_requests/1')
  await userEvent.click(canvas.getByRole('button', { name: '원문 보기' }))
  await expect(canvas.getByLabelText('본문 원문')).toHaveTextContent('<script>alert(1)</script>')
  await userEvent.click(canvas.getByRole('button', { name: '서식 보기' }))
} }
export const Narrow: Story = { decorators: [Story => <div style={{ width: 320 }}><Story /></div>] }
export const Empty: Story = { args: { value: '' } }
export const LinkFailure: Story = { args: { onOpenLink: fn(async () => { throw new Error('허용된 호스팅 주소가 아닙니다.') }) }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('link', { name: '검토 링크 ↗' }))
  await expect(await within(canvasElement.ownerDocument.body).findByRole('alert')).toHaveTextContent('허용된 호스팅 주소가 아닙니다.')
} }
