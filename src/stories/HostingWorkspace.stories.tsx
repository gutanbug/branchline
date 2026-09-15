import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
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
