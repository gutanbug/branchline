import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, userEvent, within } from 'storybook/test'
import { HostingWorkspace } from '../features/hosting/HostingWorkspace'
import { Button } from '../design-system'
import { remoteProject } from '../features/hosting/remoteProject'
import type { DesktopAPI, Repository } from '../app/types'
const repos = [{ path: '/github', name: '개인 앱', branch: 'main' }, { path: '/company', name: '회사 앱', branch: 'develop' }] as Repository[]
const api = {
  hostingAccounts: async () => ({ warning: '', accounts: [{ key: 'gh', provider: 'github', host: 'github.com', login: 'developer' }, { key: 'gl', provider: 'gitlab', host: 'gitlab.company.test', login: 'manager' }] }),
  hostingDefaults: async () => ({ github: '', gitlab: '' }),
  syncState: async (path: string) => ({ remotes: [{ name: 'origin', fetch: path === '/github' ? 'git@github.com:team/personal.git' : 'ssh://git@gitlab.company.test/team/sub/company.git' }] }),
  hostingRead: async (query: { kind: string; project: string }) => ({ checkedAt: '2026-09-15T00:00:00Z', hasMore: false, items: query.kind === 'project' ? [{ id: query.project, title: query.project, subtitle: '비공개' }] : [] }),
} as unknown as DesktopAPI
function Example() {
  const [activePath, setActivePath] = useState('/github')
  return <><div className="bl-actions">{repos.map(repo => <Button key={repo.path} aria-pressed={repo.path === activePath} onClick={() => setActivePath(repo.path)}>{repo.name}</Button>)}</div><HostingWorkspace api={api} repos={repos} activePath={activePath} active /></>
}
const meta = { title: 'Patterns/HostingWorkspace', component: Example } satisfies Meta<typeof Example>
export default meta
type Story = StoryObj<typeof meta>

const navigationApi: DesktopAPI = {
  ...api,
  hostingRead: async query => {
    const result = await api.hostingRead(query)
    const row = (id: string) => ({ id, title: `${query.project} 리뷰 ${id}`, state: 'open', subtitle: '개발자', url: '', date: '' })
    if (query.kind === 'reviews') return { ...result, items: Array.from({ length: 30 }, (_, i) => row(String(i + 1))) }
    if (query.kind === 'review') return { ...result, items: [{ ...row(query.id!), body: Array.from({ length: 60 }, (_, i) => `변경 내용 ${i + 1}`).join('\n\n') }] }
    return result
  },
}
function NavigationExample() {
  const [path, setPath] = useState('/github')
  return <><div>{repos.map(repo => <Button key={repo.path} onClick={() => setPath(repo.path)}>{repo.name}</Button>)}</div>
    <main className="bl-desktop-main" style={{ height: 400, overflow: 'auto' }}><HostingWorkspace api={navigationApi} repos={repos} activePath={path} active /></main></>
}
export const RepositoryNavigation: Story = { render: () => <NavigationExample />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement), scroller = canvas.getByRole('main')
  const github = canvas.getByRole('button', { name: '개인 앱' }), gitlab = canvas.getByRole('button', { name: '회사 앱' })
  const moveTo = async (top: number) => {
    scroller.scrollTop = top
    await fireEvent.scroll(scroller)
    await expect(scroller.scrollTop).toBe(top)
  }
  const review = await canvas.findByRole('button', { name: /team\/personal 리뷰 8$/ })
  await moveTo(520)
  await fireEvent.click(review)
  await canvas.findByRole('heading', { name: /team\/personal 리뷰 8/ })
  await moveTo(610)
  await fireEvent.click(canvas.getByRole('button', { name: 'CI 실행' }))
  await canvas.findByRole('heading', { name: 'GitHub Actions' })
  await fireEvent.click(canvas.getByRole('button', { name: 'PR / MR 검토' }))
  await expect(scroller.scrollTop).toBe(610)
  await fireEvent.click(gitlab)
  await fireEvent.click(await canvas.findByRole('button', { name: /team\/sub\/company 리뷰 8$/ }))
  await canvas.findByRole('heading', { name: /team\/sub\/company 리뷰 8/ })
  await moveTo(270)
  await fireEvent.click(github)
  await expect(canvas.getByRole('heading', { name: /team\/personal 리뷰 8/ })).toBeVisible()
  await expect(scroller.scrollTop).toBe(610)
  await fireEvent.click(canvas.getByRole('button', { name: '리뷰 목록으로' }))
  await expect(scroller.scrollTop).toBe(520)
  await fireEvent.click(gitlab)
  await expect(canvas.getByRole('heading', { name: /team\/sub\/company 리뷰 8/ })).toBeVisible()
  await expect(scroller.scrollTop).toBe(270)
} }

function MergeExample({ confirmed }: { confirmed: boolean }) {
  const [mergeApi] = useState<DesktopAPI>(() => {
    let submitted = false
    const review = { id: '7', title: '권한 검사', state: 'open', version: 'test-head', subtitle: '개발자', url: '', date: '' }
    return {
      ...api,
      hostingAccounts: async () => {
        const data = await api.hostingAccounts()
        return { ...data, accounts: data.accounts.map(a => ({ ...a, writeAccess: true })) }
      },
      hostingRead: async query => {
        const result = await api.hostingRead(query)
        if (query.kind === 'review') return { ...result, items: [{ ...review, body: submitted ? '갱신한 상세' : '최초 조회' }] }
        if (query.kind === 'reviews') return { ...result, items: submitted ? [review, { ...review, id: '8', title: '새 리뷰' }] : [review] }
        return result
      },
      hostingPrepare: async () => ({ id: 'merge-plan', label: '병합', facts: [], text: '', expiresAt: Date.now() + 60000 }),
      hostingWrite: async () => {
        submitted = true
        return { id: '', merged: confirmed, message: confirmed ? '병합이 완료되었습니다.' : '병합 요청을 접수했습니다.' }
      },
    }
  })
  return <HostingWorkspace api={mergeApi} repos={repos} activePath="/github" active />
}

async function checkMerge(canvasElement: HTMLElement, confirmed: boolean) {
  const canvas = within(canvasElement)
  await userEvent.click(await canvas.findByRole('button', { name: /권한 검사/ }))
  await userEvent.click(await canvas.findByRole('button', { name: '병합 검토' }))
  const dialog = within(canvas.getByRole('dialog'))
  await userEvent.click(dialog.getByRole('button', { name: '실행 대상 확인' }))
  await userEvent.click(await dialog.findByRole('button', { name: '원격 실행 · 병합' }))
  await canvas.findByText('갱신한 상세')
  if (confirmed) {
    await expect(canvas.getByRole('button', { name: '병합 검토' })).toBeDisabled()
    await expect(canvas.getByText('병합됨')).toBeVisible()
  } else {
    await expect(canvas.getByRole('button', { name: '병합 검토' })).toBeEnabled()
  }
  await userEvent.click(canvas.getByRole('button', { name: '리뷰 목록으로' }))
  await expect(await canvas.findByRole('button', { name: /새 리뷰/ })).toBeVisible()
  await expect(!!canvas.queryByRole('button', { name: /권한 검사/ })).toBe(!confirmed)
}

export const ConfirmedMerge: Story = { render: () => <MergeExample confirmed />, play: ({ canvasElement }) => checkMerge(canvasElement, true) }
export const UnconfirmedMerge: Story = { render: () => <MergeExample confirmed={false} />, play: ({ canvasElement }) => checkMerge(canvasElement, false) }

export const CurrentRepository: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await canvas.findByRole('heading', { name: 'team/personal' })
  await expect(canvas.queryByRole('combobox', { name: '조회 계정' })).not.toBeInTheDocument()
  await userEvent.click(canvas.getByRole('button', { name: '회사 앱' }))
  await canvas.findByRole('heading', { name: 'team/sub/company' })
  await expect(canvas.queryByRole('heading', { name: 'team/personal' })).not.toBeInTheDocument()
  await canvas.findByRole('heading', { name: 'Merge Requests' })
  await expect(remoteProject('https://github.com/team/app.git', 'github.com')?.project).toBe('team/app')
  await expect(remoteProject('ssh://git@gitlab.company.test:2222/group/sub/app.git')?.host).toBe('gitlab.company.test')
  await expect(remoteProject('https://gitlab.company.test:8443/group/app.git')?.host).toBe('gitlab.company.test:8443')
  for (const url of ['/tmp/local', 'https://github.com.evil.test/team/app', 'https://secret:token@github.com/team/app', 'https://github.com/team/app?token=secret']) await expect(remoteProject(url, 'github.com')).toBeNull()
} }
