import { useEffect, useRef, useState } from 'react'
import { ActionSummary, Button, Checkbox, CodeDiff, CommitMessage, Conversation, Dialog, Disclosure, Notice, SelectField, TextArea, TextField } from '../../design-system'
import { splitCommitMessage } from '../../design-system/commit-message'
import type { Agent, AgentId, AgentMessage, AmendPreview, DesktopAPI, Repository } from '../../app/types'

type Chat = { prompt: string; messages: AgentMessage[]; proposal?: string }
const emptyChat: Chat = { prompt: '', messages: [] }
export function AmendCommit({ api, repo, sha, onRepo, onAmended, onClose, onBusy }: { api: DesktopAPI; repo: Repository; sha: string; onRepo: (repo: Repository) => void; onAmended: (repo: Repository) => void; onClose: () => void; onBusy: (busy: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [preview, setPreview] = useState<AmendPreview | null>(null)
  const [title, setTitle] = useState(''), [body, setBody] = useState('')
  const [includeStaged, setIncludeStaged] = useState(false), [acknowledged, setAcknowledged] = useState(false)
  const [reviewing, setReviewing] = useState(false), [running, setRunning] = useState('')
  const [error, setError] = useState(''), [agentError, setAgentError] = useState('')
  const [agents, setAgents] = useState<Agent[]>([]), [agent, setAgent] = useState<AgentId>('codex')
  const [chats, setChats] = useState<Partial<Record<AgentId, Chat>>>({})
  const live = useRef(true)
  const busy = !!running, stale = !!preview && preview.token !== repo.token
  const chat = chats[agent] || emptyChat, available = agents.filter(agent => agent.enabled && agent.path && agent.version)
  const message = `${title.trim()}${body.trim() ? `\n\n${body.trim()}` : ''}`
  function load(reset = false) {
    return api.amendPreview(repo.path, sha).then(next => {
      if (!live.current) return
      setError(''); setPreview(next); setReviewing(false); setAcknowledged(false); setChats({})
      if (reset) { const message = splitCommitMessage(next.message); setTitle(message.title); setBody(message.body) }
    }).catch(error => { if (live.current) setError(error.message) })
  }
  function loadAgents() {
    return api.agents().then(list => { if (live.current) { setAgents(list); setAgentError('') } }).catch(() => { if (live.current) setAgentError('Agent 목록을 읽지 못했습니다. 목록을 다시 확인하세요.') })
  }
  useEffect(() => {
    live.current = true; dialog.current?.showModal()
    void load(true); void loadAgents()
    return () => { live.current = false }
    // The dialog is keyed by the selected HEAD; drafts must survive repository refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function updateChat(patch: Partial<Chat>) { setChats(previous => ({ ...previous, [agent]: { ...(previous[agent] || emptyChat), ...patch } })) }
  async function ask() {
    if (!preview || busy || stale || !chat.prompt.trim() || !available.some(item => item.id === agent)) return
    const id = crypto.randomUUID(), selectedAgent = agent, request = chat
    setRunning(id); onBusy(true); setAgentError('')
    try {
      const reply = await api.agentChat(repo.path, { kind: 'commit-message', id, agent, file: 'COMMIT_MESSAGE', sha, includeStaged, expected: preview.token, draft: message, prompt: request.prompt, messages: request.messages, previousResult: request.proposal })
      if (live.current) setChats(previous => ({ ...previous, [selectedAgent]: { prompt: '', messages: [...request.messages, { role: 'user', content: request.prompt }, { role: 'assistant', content: reply.message }], proposal: reply.result ?? request.proposal } }))
    } catch (error) { if (live.current) setAgentError((error as Error).message) }
    finally { if (live.current) setRunning(''); onBusy(false) }
  }
  async function execute() {
    if (!preview || busy || stale || !title.trim() || (preview.published.length > 0 && !acknowledged)) return
    setRunning('amend'); onBusy(true); setError('')
    try {
      const next = await api.mutate(repo.path, { action: 'amend', expected: preview.token, base: sha, message, includeStaged, rewritePublished: acknowledged })
      onAmended(next); dialog.current?.close()
    } catch (error) {
      if (live.current) { setError((error as Error).message); setReviewing(false) }
      try { onRepo(await api.state(repo.path)) } catch { /* Keep the original error and draft. */ }
    } finally { if (live.current) setRunning(''); onBusy(false) }
  }
  return <Dialog dialogRef={dialog} title="최근 커밋 수정 · Amend" size="wide" busy={busy} onClose={onClose}>
    {error && <Notice tone="error">{error}</Notice>}
    {!preview ? <>{!error && <Notice>현재 HEAD와 스테이징 변경을 확인하고 있습니다…</Notice>}<Button onClick={() => void load(true)}>다시 확인</Button></> : <form noValidate onSubmit={event => { event.preventDefault(); if (title.trim() && !stale) { setReviewing(true); dialog.current?.scrollTo(0, 0) } }} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault() }}>
      <Notice>기존 커밋을 교체하므로 SHA가 바뀝니다. 작성자는 유지하며 Git hooks·서명 설정을 사용합니다. 원격 Push는 별도로 실행합니다.</Notice>
      {stale && <Notice tone="error">저장소 상태가 변경되었습니다. 초안은 유지했습니다. {sha === repo.head ? <Button disabled={busy} onClick={() => void load()}>최신 상태 다시 검토</Button> : 'HEAD가 바뀌었으므로 닫고 현재 커밋에서 다시 시작하세요.'}</Notice>}
      {!reviewing && <><TextField label="커밋 제목" value={title} maxLength={1000} disabled={busy} onChange={event => setTitle(event.target.value)} />
      <TextArea className="resize-none" label="커밋 본문" value={body} rows={6} maxLength={9000} disabled={busy || reviewing} onChange={event => setBody(event.target.value)} />
      <Checkbox label={`스테이징 변경 ${preview.stagedFiles.length}개도 포함`} checked={includeStaged} disabled={busy || reviewing || !preview.stagedFiles.length} onChange={event => { setIncludeStaged(event.target.checked); setChats({}) }} />
      <p className="bl-muted">체크하지 않으면 메시지만 수정하며 스테이징·작업 파일은 그대로 유지합니다.</p></>}
      {preview.stagedFiles.length > 0 && <Disclosure title="스테이징 변경 검토"><CodeDiff value={preview.stagedDiff} /></Disclosure>}
      {!reviewing && <Disclosure title="AI로 커밋 메시지 다듬기">
        <Notice>기존 메시지와 커밋 diff{includeStaged ? '·스테이징 diff' : ''}를 선택한 Agent에 전송합니다. CLI의 기존 로그인 세션을 사용하며 사용량이 발생할 수 있습니다. AI는 메시지만 제안합니다.</Notice>
        {!available.length && <Notice>AI Agents 화면에서 로그인된 Claude·Codex·Gemini를 활성화한 뒤 목록을 새로고침하세요.</Notice>}
        <SelectField label="메시지 작성 Agent" value={agent} disabled={busy} options={(['claude', 'codex', 'gemini'] as AgentId[]).map(id => ({ value: id, label: `${id}${available.some(item => item.id === id) ? '' : ' · 사용 불가'}` }))} onChange={id => { setAgent(id as AgentId); setAgentError('') }} />
        <Button disabled={busy} onClick={() => void loadAgents()}>Agent 목록 새로고침</Button>
        <Conversation label="커밋 메시지 대화" emptyTitle="메시지의 방향을 알려 주세요" emptyDescription="제목 표현, 변경 이유, 포함할 이슈 번호를 요청할 수 있습니다." messages={chat.messages} value={chat.prompt} onChange={prompt => updateChat({ prompt })} onSend={() => void ask()} onCancel={() => { api.cancel(running).catch(error => setAgentError(error.message)) }} busy={busy} disabled={stale || !available.some(item => item.id === agent)} error={agentError} />
        {chat.messages.length > 0 && <Button disabled={busy} onClick={() => updateChat({ messages: [], proposal: undefined })}>새 대화</Button>}
        {chat.proposal && <><CommitMessage {...splitCommitMessage(chat.proposal)} /><Button disabled={busy || stale} onClick={() => { const proposal = splitCommitMessage(chat.proposal!); setTitle(proposal.title); setBody(proposal.body) }}>AI 제안을 편집기에 적용</Button></>}
      </Disclosure>}
      {reviewing && <><ActionSummary title="Amend 실행 전 검토" status="SHA 재작성" facts={[{ label: '브랜치', value: repo.branch || '' }, { label: '기존 HEAD', value: sha }, { label: '변경 범위', value: includeStaged ? `메시지 + 스테이징 ${preview.stagedFiles.length}개` : '메시지만' }]} next="제목·본문과 포함할 변경을 확인하세요."><CommitMessage title={title.trim()} body={body.trim()} /></ActionSummary>{preview.published.length > 0 && <><Notice>마지막 Fetch 이력에서 이 커밋을 포함한 원격 브랜치: {preview.published.join(', ')}</Notice><Checkbox label="공유된 커밋의 SHA를 재작성한다는 것을 확인했습니다" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} /></>}</>}
      <div className="bl-actions bl-dialog-actions"><Button disabled={busy} onClick={() => dialog.current?.close()}>수정 취소</Button>{reviewing ? <><Button disabled={busy} onClick={() => setReviewing(false)}>계속 편집</Button><Button variant="primary" loading={running === 'amend'} disabled={busy || stale || (preview.published.length > 0 && !acknowledged)} onClick={() => void execute()}>Amend 실행</Button></> : <Button type="submit" variant="primary" disabled={busy || stale || !title.trim()}>Amend 검토</Button>}</div>
    </form>}
  </Dialog>
}
