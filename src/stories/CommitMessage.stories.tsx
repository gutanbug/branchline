import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { CommitMessage, CommitMetadata } from '../design-system'
import { formatCommitDate, parseCommitPreamble } from '../design-system/commit-message'
const preamble = `commit ${'a'.repeat(40)}\nAuthor:     이재근 <author@example.invalid>\nAuthorDate: 2026-09-14T15:52:42+09:00\nCommit:     이재근 <author@example.invalid>\nCommitDate: 2026-09-14T15:52:42+09:00\n\n    [CMPTEAM-5717] service-ipam 테스트 추가\n    \n    주요 변경사항\n    - 서비스 테스트 모듈 확장\n    - 스크립트 및 규약 문서 갱신\n`
const meta = { title: 'Components/CommitMessage', component: CommitMessage, args: { title: '[CMPTEAM-5717] service-ipam 테스트 추가', body: '주요 변경사항\n- 서비스 테스트 모듈 확장\n- 스크립트 및 규약 문서 갱신' } } satisfies Meta<typeof CommitMessage>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Metadata: Story = { render: () => <CommitMetadata value={preamble} />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getByRole('heading', { name: /CMPTEAM-5717/ })).toBeVisible()
  await expect(canvas.getByRole('region', { name: '커밋 본문' })).toHaveTextContent('주요 변경사항')
  await userEvent.click(canvas.getByText('커밋 정보', { exact: true }))
  await expect(canvas.getAllByText('이재근 <author@example.invalid>')).toHaveLength(2)
  await expect(parseCommitPreamble(preamble)?.body).toContain('- 서비스 테스트 모듈 확장')
  await expect(formatCommitDate('2026-09-14T15:52:42+09:00')).toMatch(/\d{2}:52/)
  await expect(formatCommitDate('2026-09-14T15:52:42+09:00')).not.toContain(':42')
} }
export const EmptyBody: Story = { args: { body: '' } }
export const LongBody: Story = { args: { title: '긴-한글-커밋-제목-줄바꿈-확인'.repeat(8), body: '변경 이유와 구현 내용을 확인합니다.\n'.repeat(30) }, decorators: [Story => <div style={{ width: 280 }}><Story /></div>] }
