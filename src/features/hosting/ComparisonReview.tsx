import { useEffect, useState } from 'react'
import { Button, EmptyState, Notice, SelectField, TextField } from '../../design-system'
import { remoteProject } from './remoteProject'
import { HostActions } from './HostActions'
import type { DesktopAPI, HostAccount, SyncSnapshot } from '../../app/types'

export function ComparisonReview({ api, path, source, target, sourceSha, targetSha }: { api: DesktopAPI; path: string; source: string; target: string; sourceSha: string; targetSha: string }) {
  const [accounts, setAccounts] = useState<HostAccount[]>([]), [remotes, setRemotes] = useState<SyncSnapshot['remotes']>([])
  const [selected, setSelected] = useState(''), [project, setProject] = useState(''), [verified, setVerified] = useState('')
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => {
    let live = true
    Promise.all([api.hostingAccounts(), api.syncState(path)]).then(([result, state]) => { if (live) { setAccounts(result.accounts); setRemotes(state.remotes); setLoading(false); setError('') } }).catch(error => { if (live) { setError(error.message); setLoading(false) } })
    return () => { live = false }
  }, [api, path, retry])
  const account = accounts.find(account => account.key === selected)
  function select(key: string) {
    setSelected(key); setVerified(''); setError('')
    const host = accounts.find(account => account.key === key)?.host
    const matches = remotes.flatMap(remote => {
      const target = remoteProject(remote.fetch, host); return target ? [target.project] : []
    })
    setProject(new Set(matches).size === 1 ? matches[0] : '')
  }
  function branch(ref: string) {
    if (ref.startsWith('refs/heads/')) return ref.slice(11)
    const remote = remotes.filter(remote => ref.startsWith(`refs/remotes/${remote.name}/`)).sort((a, b) => b.name.length - a.name.length)[0]
    return remote ? ref.slice(`refs/remotes/${remote.name}/`.length) : ''
  }
  const from = branch(source), to = branch(target)
  async function verify() {
    if (!account || busy) return
    setBusy(true); setError(''); setVerified('')
    try { const result = await api.hostingRead({ account: account.key, kind: 'project', project: project.trim() }); if (!result.items[0]?.id) throw new Error('프로젝트를 확인하지 못했습니다.'); setVerified(result.items[0].id) } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <section aria-label="비교에서 PR/MR 생성">
    {loading && <Notice>호스팅 계정과 원격 저장소를 확인하고 있습니다…</Notice>}
    {error && <Notice tone="error">{error}<Button disabled={busy} onClick={() => { setLoading(true); setRetry(value => value + 1) }}>연결 다시 조회</Button></Notice>}
    {!loading && !accounts.length ? <EmptyState title="호스팅 계정을 연결하세요">프로젝트 현황의 계정 관리에서 GitHub/GitLab을 연결한 뒤 다시 조회하세요.<Button onClick={() => { setLoading(true); setRetry(value => value + 1) }}>계정 다시 조회</Button></EmptyState> : <>
      <Notice compact>선택한 두 브랜치를 같은 원격 프로젝트에 Push한 뒤 생성하세요. 원격 SHA가 비교한 SHA와 일치하는지 실행 전에 확인합니다.</Notice>
      <div className="bl-host-form"><SelectField label="PR/MR 작성 계정" disabled={loading || busy} value={selected} onChange={select} options={[{ value: '', label: '호스팅 계정 선택' }, ...accounts.map(account => ({ value: account.key, label: `${account.host} / ${account.login}` }))]} /><TextField label="PR/MR 원격 프로젝트" placeholder="owner/repository 또는 group/project" disabled={loading || busy} value={project} onChange={event => { setProject(event.target.value); setVerified('') }} /><Button disabled={!account || !project.trim() || busy || account.reconnect} loading={busy} onClick={() => void verify()}>원격 프로젝트 확인</Button></div>
      {account?.reconnect && <Notice>프로젝트 현황의 계정 관리에서 다시 연결하세요.</Notice>}
      {!from || !to ? <Notice>이름이 있는 로컬 또는 원격 추적 브랜치를 양쪽에 선택하세요.</Notice> : verified && account && <HostActions key={`${account.key}/${verified}/${source}/${target}`} api={api} account={account} project={verified} kind="create" creation={{ source: from, target: to, sourceSha, targetSha }} onRefresh={() => { setVerified(''); void verify() }} />}
    </>}
  </section>
}
