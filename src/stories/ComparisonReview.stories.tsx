import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ComparisonReview } from '../features/hosting/ComparisonReview'
import type { DesktopAPI } from '../app/types'
const sourceSha = 'a'.repeat(40), targetSha = 'b'.repeat(40)
const prepare = fn(async () => ({ id: 'plan', expiresAt: Date.now() + 300000, label: 'PR/MR 생성', facts: [{ label: '브랜치', value: 'feature/review → main' }], text: '변경 검토' }))
const write = fn(async () => ({ id: '42', message: 'PR 생성 완료' }))
const api = {
  hostingAccounts: async () => ({ accounts: [{ key: 'github:test', host: 'github.com', login: 'developer', provider: 'github', writeAccess: true }], warning: '' }),
  syncState: async () => ({ remotes: [{ name: 'origin', fetch: 'git@github.com:team/project.git' }] }),
  hostingRead: async () => ({ items: [{ id: 'team/project' }] }),
  hostingPrepare: prepare, hostingWrite: write, hostingDiscard: async () => null,
} as unknown as DesktopAPI
const meta = { title: 'Patterns/ComparisonReview', component: ComparisonReview, args: { api, path: '/fixture', source: 'refs/heads/feature/review', target: 'refs/remotes/origin/main', sourceSha, targetSha } } satisfies Meta<typeof ComparisonReview>
export default meta
type Story = StoryObj<typeof meta>
export const CreateFromComparison: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.selectOptions(await canvas.findByRole('combobox', { name: 'PR/MR 작성 계정' }), 'github:test')
  await expect(canvas.getByRole('textbox', { name: 'PR/MR 원격 프로젝트' })).toHaveValue('team/project')
  await userEvent.click(canvas.getByRole('button', { name: '원격 프로젝트 확인' }))
  await userEvent.click(await canvas.findByRole('button', { name: 'PR 만들기' }))
  const dialog = within(canvas.getByRole('dialog'))
  await expect(dialog.getByRole('textbox', { name: '출발 원격 브랜치' })).toHaveValue('feature/review')
  await expect(dialog.getByRole('textbox', { name: '대상 원격 브랜치' })).toHaveValue('main')
  await expect(dialog.getByRole('textbox', { name: '출발 원격 브랜치' })).toBeDisabled()
  await userEvent.type(dialog.getByRole('textbox', { name: '제목' }), '비교한 변경 검토')
  await userEvent.click(dialog.getByRole('button', { name: '최신 상태 확인 · 실행 전 검토' }))
  await expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ source: 'feature/review', target: 'main', sourceSha, targetSha, project: 'team/project' }))
  await userEvent.click(await dialog.findByRole('button', { name: '원격 실행 · PR/MR 생성' }))
  await expect(write).toHaveBeenCalledWith('plan')
} }
export const NoAccount: Story = { args: { api: { ...api, hostingAccounts: async () => ({ accounts: [], warning: '' }) } } }
export const ReadFailure: Story = { args: { api: { ...api, hostingAccounts: async () => { throw new Error('연결 정보를 읽지 못했습니다.') } } } }
