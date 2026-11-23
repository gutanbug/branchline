import { useEffect, useState } from 'react'
import { Button, EmptyState, Notice, SelectField, TextField } from '../../design-system'
import type { DesktopAPI, HostAccount, HostAccounts, SyncSnapshot } from '../../app/types'
import type { ReviewPush } from '../workspace/RemoteWorkspace'
import { AccountConnections } from './AccountConnections'
import { HostActions } from './HostActions'
import { useHostRead } from './queries'
import { remoteProject } from './remoteProject'

type BranchPair = { source: string; target: string; sourceSha: string; targetSha: string }
type Remote = SyncSnapshot['remotes'][number]

function ReviewProject({ api, account, project, creation, destination, needsPush, onPush, blocked }: {
  api: DesktopAPI; account: HostAccount; project: string; creation: BranchPair; destination?: Remote; needsPush?: boolean; onPush?: ReviewPush; blocked?: boolean
}) {
  const result = useHostRead(api, { account: account.key, kind: 'project', project })
  const [published, setPublished] = useState(''), [pushing, setPushing] = useState(false)
  const verified = result.value?.items[0]?.id
  if (result.busy) return <Notice compact>원격 프로젝트 확인 중…</Notice>
  if (!verified) return <Notice tone="error">{result.error || '프로젝트를 확인하지 못했습니다.'}<Button onClick={result.refresh}>프로젝트 다시 확인</Button></Notice>
  const publication = JSON.stringify([destination?.push, creation.source, creation.sourceSha])
  async function push() {
    if (!onPush || !destination || pushing || blocked) return
    setPushing(true)
    try { if (await onPush(destination.name, destination.push, creation.source, creation.sourceSha)) setPublished(publication) }
    finally { setPushing(false) }
  }
  return <>{destination && onPush && <div className="bl-actions">{published === publication
    ? <small role="status">{destination.name}/{creation.source}에 게시됨</small>
    : needsPush && <Button disabled={blocked} loading={pushing} onClick={() => void push()}>{destination.name}/{creation.source}에 Push</Button>}</div>}
    <HostActions key={JSON.stringify(creation)} api={api} account={account} project={verified} kind="create" creation={creation} disabled={pushing || blocked} onRefresh={result.refresh} />
  </>
}

export function ComparisonReview({ api, path, repoToken, source, target, sourceSha, targetSha, onPush, blocked }: BranchPair & {
  api: DesktopAPI; path: string; repoToken?: string; onPush?: ReviewPush; blocked?: boolean
}) {
  const [accounts, setAccounts] = useState<HostAccounts>(), [sync, setSync] = useState<SyncSnapshot>()
  const [choice, setChoice] = useState<string | null>(null), [input, setInput] = useState<string | null>(null), [confirmed, setConfirmed] = useState('')
  const [error, setError] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => {
    let live = true
    Promise.all([api.hostingAccounts(), api.syncState(path)]).then(([accounts, state]) => {
      if (live) { setAccounts(accounts); setSync(state); setError('') }
    }).catch(reason => { if (live) setError(reason.message) })
    return () => { live = false }
  }, [api, path, repoToken, retry])
  function select(key: string) { setChoice(key); setInput(null); setConfirmed('') }
  const remotes = sync?.remotes || []
  const matches = accounts?.accounts.filter(account => remotes.some(remote => remoteProject(remote.fetch, account.host)))
  const account = choice === null && matches?.length === 1 ? matches[0] : accounts?.accounts.find(account => account.key === choice)
  const projects = new Set(remotes.map(remote => remoteProject(remote.fetch, account?.host)?.project).filter(Boolean))
  const suggested = account && projects.size === 1 ? [...projects][0] || '' : ''
  const project = input ?? suggested
  const verifiedPath = input === null ? suggested : confirmed
  function branch(ref: string) {
    if (ref.startsWith('refs/heads/')) return ref.slice(11)
    const remote = remotes.filter(remote => ref.startsWith(`refs/remotes/${remote.name}/`)).sort((a, b) => b.name.length - a.name.length)[0]
    return remote ? ref.slice(`refs/remotes/${remote.name}/`.length) : ''
  }
  const from = branch(source), to = branch(target)
  const destinations = account && verifiedPath ? remotes.filter(remote => !remote.blocked && remoteProject(remote.push, account.host)?.project === verifiedPath) : []
  const destination = destinations.length === 1 ? destinations[0] : undefined
  const repo = sync?.repository
  const canPush = repo && destination && !repo.operation && repo.head === sourceSha && source === `refs/heads/${repo.branch}`
    && !repo.refs.some(ref => ref.ref === `refs/remotes/${destination.name}/${from}` && ref.sha === sourceSha && remoteProject(destination.fetch, account?.host)?.project === verifiedPath)
  const connect = accounts && <AccountConnections api={api} accounts={accounts} connectLabel={account ? '쓰기 권한으로 다시 연결' : '계정 연결'} onChange={(next, key) => { setAccounts(next); if (key) select(key) }} />
  return <section aria-label="비교에서 PR/MR 생성">
    {error ? <Notice tone="error">{error}<Button onClick={() => setRetry(value => value + 1)}>연결 다시 조회</Button></Notice>
      : !accounts || !sync ? <Notice>호스팅 계정과 원격 저장소를 확인하고 있습니다…</Notice>
      : !accounts.accounts.length ? <><EmptyState title="호스팅 계정을 연결하세요">PR/MR을 올릴 계정을 연결하고 원격 쓰기를 허용하세요.</EmptyState>{connect}</> : <>
        <div className="bl-host-form"><SelectField label="PR/MR 작성 계정" value={account?.key || ''} onChange={select} options={[{ value: '', label: '호스팅 계정 선택' }, ...accounts.accounts.map(account => ({ value: account.key, label: `${account.host} / ${account.login}` }))]} />
          <TextField label="PR/MR 원격 프로젝트" placeholder="owner/repository 또는 group/project" disabled={!account} value={project} onChange={event => { setInput(event.target.value); setConfirmed('') }} />
          {account && !verifiedPath && <Button disabled={!project.trim()} onClick={() => setConfirmed(project.trim())}>원격 프로젝트 확인</Button>}
        </div>
        {!account && !matches?.length && connect}
        {account && (account.reconnect || !account.writeAccess) ? <><Notice compact>PR/MR을 만들려면 이 계정의 원격 쓰기 권한이 필요합니다.</Notice>{connect}</>
          : !from || !to || from === to ? <Notice compact>서로 다른 출발 브랜치와 대상 브랜치를 선택하세요.</Notice>
          : account && verifiedPath && <ReviewProject key={JSON.stringify([account.key, verifiedPath])} api={api} account={account} project={verifiedPath} creation={{ source: from, target: to, sourceSha, targetSha }} destination={destination} needsPush={!!canPush} onPush={onPush} blocked={blocked} />}
      </>}
  </section>
}
