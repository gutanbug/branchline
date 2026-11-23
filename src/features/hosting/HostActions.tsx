import { HostLink } from './HostLink'
import { ToastMessage } from '../../design-system'
import { useEffect, useRef, useState } from 'react'
import { ActionSummary, Button, IconButton, Checkbox, Dialog, Notice, SelectField, TextArea, TextField } from '../../design-system'
import type { DesktopAPI, HostAccount, HostItem, HostWriteInput, HostWritePlan, HostWriteResult } from '../../app/types'

export function HostActions({ api, account, project, kind, item, onRefresh, onMerge, creation, disabled, compact = false, active = true }: { disabled?: boolean; active?: boolean; compact?: boolean; creation?: { source: string; target: string; sourceSha: string; targetSha: string }; api: DesktopAPI; account: HostAccount; project: string; kind: 'create' | 'review' | 'run'; item?: HostItem; onRefresh: () => void; onMerge?: (result: HostWriteResult) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), pending = useRef<string | null>(null), running = useRef(false)
  const [action, setAction] = useState<HostWriteInput['action']>('create'), [plan, setPlan] = useState<HostWritePlan | null>(null)
  const [title, setTitle] = useState(''), [source, setSource] = useState(creation?.source || ''), [target, setTarget] = useState(creation?.target || ''), [draft, setDraft] = useState(true), [method, setMethod] = useState(account.provider === 'github' ? 'merge' : 'project')
  const [bodies, setBodies] = useState<Partial<Record<typeof action, string>>>({})
  const [created, setCreated] = useState<HostWriteResult | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  if (!active && (message || error)) { setMessage(''); setError('') }
  useEffect(() => () => { if (pending.current) void api.hostingDiscard(pending.current).catch(() => {}) }, [api])
  function discard() { if (pending.current) void api.hostingDiscard(pending.current).catch(() => {}); pending.current = null; setPlan(null) }
  function open(value: typeof action) { if (running.current) return; discard(); setAction(value); setError(''); if (value === 'approve' && account.provider === 'gitlab') { void prepare(value); return }; dialog.current?.showModal(); if (value === 'rerun' || value === 'cancel') void prepare(value) }
  async function prepare(operation = action) {
    if (running.current) return
    running.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const value = await api.hostingPrepare({ account: account.key, project, action: operation, id: item?.id, version: item?.version, title, body: bodies[operation] || '', source, target, draft, method, sourceSha: creation?.sourceSha, targetSha: creation?.targetSha })
      pending.current = value.id
      if (['create', 'comment', 'approve', 'request-changes'].includes(operation)) {
        pending.current = null
        const result = await api.hostingWrite(value.id)
        setMessage(result.message); setBodies(previous => ({ ...previous, [operation]: '' })); dialog.current?.close()
        if (operation === 'create') { setCreated(result); setTitle(''); setSource(creation?.source || ''); setTarget(creation?.target || '') }
      } else setPlan(value)
    } catch (e) { setError((e as Error).message) }
    finally { running.current = false; setBusy(false) }
  }
  async function execute() {
    if (!plan || running.current) return
    running.current = true; setBusy(true); setError(''); setMessage(''); pending.current = null
    try {
      const result = await api.hostingWrite(plan.id)
      dialog.current?.close()
      if (action === 'merge' && onMerge) onMerge(result)
      else setMessage(result.message)
    }
    catch (e) { setError((e as Error).message) }
    finally { setPlan(null); running.current = false; setBusy(false) }
  }
  if (!account.writeAccess) return compact ? <small className="bl-muted">읽기 전용 · 원격 쓰기는 계정 관리에서 허용</small> : <Notice>원격 작업은 계정 관리에서 ‘원격 쓰기 허용’으로 다시 연결하면 사용할 수 있습니다.</Notice>
  const openReview = item && ['open', 'opened'].includes(item.state)
  const canCancel = item && ['queued', 'in_progress', 'waiting', 'pending', 'requested', 'created', 'running', 'preparing', 'waiting_for_resource', 'scheduled'].includes(item.state)
  const canRerun = item && (account.provider === 'github' ? item.state === 'completed' : ['failed', 'canceled'].includes(item.state))
  const labels = { create: 'PR/MR 생성', comment: '댓글 게시', approve: '리뷰 승인', 'request-changes': '변경 요청', merge: '병합', rerun: 'CI 재실행', cancel: 'CI 취소' }
  const needsBody = action === 'create' || action === 'comment' || action === 'request-changes' || action === 'approve' && account.provider === 'github'
  return <section aria-label="원격 작업" className={compact ? 'bl-host-actions-inline' : 'bl-sync-section'}>
    <div className="bl-actions">
      {kind === 'create' && creation ? <Button variant="primary" disabled={disabled} onClick={() => open('create')}>{account.provider === 'github' ? 'PR 만들기' : 'MR 만들기'}</Button> : kind === 'create' ? <IconButton icon="plus" label={account.provider === 'github' ? 'PR 만들기' : 'MR 만들기'} onClick={() => open('create')} /> : kind === 'review' ? <>
        <Button disabled={busy || !openReview || !item?.version} onClick={() => open('comment')}>댓글 작성</Button>
        <Button disabled={busy || !openReview || !item?.version || item.draft} loading={busy && action === 'approve'} onClick={() => open('approve')}>리뷰 승인</Button>
        {account.provider === 'github' && <Button disabled={busy || !openReview || !item?.version || item.draft} onClick={() => open('request-changes')}>변경 요청</Button>}
        <Button disabled={busy || !openReview || !item?.version || item.draft} onClick={() => open('merge')}>병합 검토</Button>
      </> : <><Button disabled={!canRerun || !item?.version} onClick={() => open('rerun')}>{account.provider === 'github' ? '전체 작업 재실행' : '실패·취소 작업 재시도'}</Button><Button disabled={!canCancel || !item?.version} onClick={() => open('cancel')}>CI 실행 취소</Button></>}
    </div>
    <ToastMessage scope={project} tone="error" message={error} />
    {creation && created?.id && (created.url
      ? <HostLink api={api} account={account.key} url={created.url} showLabel label={`${account.provider === 'github' ? 'PR #' : 'MR !'}${created.id} 열기`} />
      : <small role="status">{account.provider === 'github' ? 'PR #' : 'MR !'}{created.id} 생성됨</small>)}
    <ToastMessage scope={project} tone="success" message={message}>{!creation && <Button onClick={onRefresh}>최신 결과 조회</Button>}</ToastMessage>
    <Dialog dialogRef={dialog} title={plan ? `${plan.label} 최종 확인` : labels[action]} busy={busy} onClose={discard}>
      {plan ? <>
        <ActionSummary title="실행 대상" status="" facts={plan.facts} />
        {plan.text && <TextArea className="resize-none" label="게시할 전체 내용" value={plan.text} readOnly rows={7} />}
        {action === 'rerun' && <Notice>배포·외부 서비스 변경·사용료가 발생할 수 있습니다.</Notice>}
        <div className="bl-actions bl-dialog-actions"><Button disabled={busy} onClick={discard}>내용 다시 편집</Button><Button variant="primary" loading={busy} onClick={() => void execute()}>원격 실행 · {plan.label}</Button></div>
      </> : <form noValidate onSubmit={e => { e.preventDefault(); void prepare() }} onKeyDown={e => { if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault() }}>
        <p className="bl-path">{account.host} / {account.login} · {project}{item ? ` · #${item.id}` : ''}</p>
        {action === 'create' && <div className="bl-host-form"><TextField label="제목" value={title} onChange={e => setTitle(e.target.value)} maxLength={255} disabled={busy} /><TextField label="출발 원격 브랜치" value={source} onChange={e => setSource(e.target.value)} hint="같은 원격 프로젝트에 Push된 브랜치" disabled={busy || !!creation} /><TextField label="대상 원격 브랜치" value={target} onChange={e => setTarget(e.target.value)} disabled={busy || !!creation} /><Checkbox label="초안으로 생성" checked={draft} onChange={e => setDraft(e.target.checked)} disabled={busy} /></div>}
        {needsBody && <TextArea className="resize-none" label={action === 'create' ? '본문' : action === 'approve' ? '리뷰 의견 · 선택' : '게시할 의견'} value={bodies[action] || ''} onChange={e => {
          const text = e.target.value
          setBodies(previous => ({ ...previous, [action]: text }))
        }} rows={7} maxLength={20000} disabled={busy} />}
        {action === 'merge' && <SelectField label="병합 방식" value={method} onChange={setMethod} disabled={busy} options={account.provider === 'github' ? [{ value: 'merge', label: 'Merge commit' }, { value: 'squash', label: 'Squash' }, { value: 'rebase', label: 'Rebase' }] : [{ value: 'project', label: 'GitLab 프로젝트 설정 따름' }]} />}
        <div className="bl-actions bl-dialog-actions"><Button disabled={busy} onClick={() => dialog.current?.close()}>닫기</Button><Button type="submit" variant="primary" loading={busy}>{action === 'merge' || action === 'rerun' || action === 'cancel' ? '실행 대상 확인' : labels[action]}</Button></div>
      </form>}
    </Dialog>
  </section>
}
