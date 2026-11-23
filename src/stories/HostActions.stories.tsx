import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { HostActions } from '../features/hosting/HostActions'
import type { DesktopAPI } from '../app/types'

const prepare = fn(async () => ({ id: 'approval', label: '리뷰 승인', facts: [] }))
const write = fn(async () => ({ message: '승인했습니다.' }))
const meta = {
  title: 'Patterns/HostActions', component: HostActions,
  args: {
    api: { hostingPrepare: prepare, hostingWrite: write, hostingDiscard: async () => null } as unknown as DesktopAPI,
    account: { key: 'gitlab:test', provider: 'gitlab', host: 'gitlab.example', login: 'reviewer', scope: 'api', writeAccess: true, persistent: false, expiresAt: null, reconnect: false },
    project: 'team/project', kind: 'review', onRefresh: fn(),
    item: { id: '42', title: '변경 검토', subtitle: '', url: '', date: '', state: 'opened', version: 'current-head' },
  },
} satisfies Meta<typeof HostActions>
export default meta
type Story = StoryObj<typeof meta>

export const GitLabApproval: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: '댓글 작성' }))
  await userEvent.type(canvas.getByRole('textbox'), '다시 확인할 내용')
  await userEvent.keyboard('{Escape}')
  await userEvent.click(canvas.getByRole('button', { name: '리뷰 승인' }))
  await expect(await within(canvasElement.ownerDocument.body).findByText('승인했습니다.')).toBeVisible()
  await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  await expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ action: 'approve', body: '', project: 'team/project', id: '42', version: 'current-head' }))
  await expect(write).toHaveBeenCalledTimes(1)
} }

export const SeparateGitHubDrafts: Story = {
  args: { account: { ...meta.args.account, provider: 'github', host: 'github.com' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const open = (label: string) => userEvent.click(canvas.getByRole('button', { name: label }))
    await open('변경 요청')
    await userEvent.type(canvas.getByRole('textbox'), '테스트 추가 요청')
    await userEvent.keyboard('{Escape}')
    await open('댓글 작성')
    await expect(canvas.getByRole('textbox')).toHaveValue('')
    await userEvent.type(canvas.getByRole('textbox'), '별도 질문')
    await userEvent.keyboard('{Escape}')
    await open('리뷰 승인')
    await expect(canvas.getByRole('textbox')).toHaveValue('')
    await userEvent.click(within(canvas.getByRole('dialog')).getByRole('button', { name: '리뷰 승인' }))
    await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ action: 'approve', body: '' }))
    await open('댓글 작성')
    await expect(canvas.getByRole('textbox')).toHaveValue('별도 질문')
    await userEvent.keyboard('{Escape}')
    await open('변경 요청')
    await expect(canvas.getByRole('textbox')).toHaveValue('테스트 추가 요청')
    await userEvent.click(within(canvas.getByRole('dialog')).getByRole('button', { name: '변경 요청' }))
    await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ action: 'request-changes', body: '테스트 추가 요청' }))
    await open('변경 요청')
    await expect(canvas.getByRole('textbox')).toHaveValue('')
  },
}

export const GitLabApprovalFailure: Story = {
  args: { api: { ...meta.args.api, hostingPrepare: fn(async () => { throw new Error('최신 커밋이 변경되었습니다. 다시 조회하세요.') }) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: '리뷰 승인' }))
    await expect(await within(canvasElement.ownerDocument.body).findByRole('alert')).toHaveTextContent('최신 커밋이 변경되었습니다.')
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(canvas.getByRole('button', { name: '리뷰 승인' })).toBeEnabled())
    await expect(write).not.toHaveBeenCalled()
  },
}
