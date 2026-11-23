import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button, CodeDiff, Conversation, Dialog, Disclosure, Notice, SelectField } from '../../design-system'
import type { Agent, AgentConversation, AgentId, ConflictEditor, DesktopAPI } from '../../app/types'
const empty: AgentConversation = { prompt: '', messages: [] }

export function ConflictChat({ api, path, editor, onEditor, disabled, active }: { active: boolean; api: DesktopAPI; path: string; editor: ConflictEditor; onEditor: (editor: ConflictEditor) => void; disabled: boolean }) {
  const [agents, setAgents] = useState<Agent[]>([]), [selected, setSelected] = useState<AgentId>('codex'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [chatOpen, setChatOpen] = useState<boolean | null>(null)
  const current = useRef({ editor, onEditor }), request = useRef<string | null>(null), dialog = useRef<HTMLDialogElement>(null)
  const [confirm, setConfirm] = useState<'proposal' | 'clear'>('proposal')
  useLayoutEffect(() => { current.current = { editor, onEditor } }, [editor, onEditor])
  useEffect(() => {
    if (!active) return
    let live = true
    Promise.all([api.agents(), api.bootstrap()]).then(([value, settings]) => {
      if (!live) return
      setAgents(value)
      if (!request.current) setSelected(settings.defaultAgent)
    }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [active, api])
  useEffect(() => () => {
    if (request.current) { void api.cancel(request.current).catch(() => {}); request.current = null }
  }, [api])
  const conversation = editor.conversations?.[selected] || empty
  function update(next: AgentConversation) { const { editor, onEditor } = current.current; onEditor({ ...editor, conversations: { ...editor.conversations, [selected]: next } }) }
  async function send() {
    if (request.current || !editor.snapshot) return
    const id = crypto.randomUUID(), snapshot = editor.snapshot, sent = conversation, draft = editor.draft
    request.current = id; setBusy(true); setError('')
    try {
      const reply = await api.agentChat(path, { id, agent: selected, file: snapshot.file, expected: snapshot.token, prompt: sent.prompt, draft, previousResult: sent.proposal?.result, messages: sent.messages })
      if (request.current !== id) return
      if (current.current.editor.snapshot?.token !== snapshot.token) throw new Error('충돌 원본이 변경되어 응답을 적용하지 않았습니다. 새 원본으로 다시 요청하세요.')
      update({ prompt: '', messages: [...sent.messages, { role: 'user', content: sent.prompt }, { role: 'assistant', content: reply.message }], proposal: reply.result === null ? undefined : { result: reply.result, token: reply.token, draft } })
    } catch (e) { if (request.current === id) setError((e as Error).message) }
    finally { if (request.current === id) { request.current = null; setBusy(false) } }
  }
  function apply(action = confirm) {
    if (action === 'clear') update(empty)
    else if (conversation.proposal) {
      if (editor.snapshot?.token !== conversation.proposal.token) { setError('수정안의 원본이 달라졌습니다. 새 대화로 요청하세요.'); dialog.current?.close(); return }
      onEditor({ ...editor, draft: conversation.proposal.result })
    }
    dialog.current?.close()
  }
  const enabled = agents.some(agent => agent.id === selected && agent.enabled && agent.version)
  // Open by default only when the chosen Agent is ready; otherwise keep the merge editor in view.
  return <Disclosure title="AI와 충돌 해결 대화" open={chatOpen ?? enabled} onOpenChange={setChatOpen}>
    <Notice compact>선택한 파일과 대화를 {agents.find(agent => agent.id === selected)?.name || selected}에 전송합니다. 기존 CLI 인증을 사용하며 사용량이 발생할 수 있습니다.</Notice>
    <Disclosure title="AI 전송·대화 보관 안내"><p>기준·Stage 2/3·현재 내용·편집 초안과 대화를 전송합니다. Codex는 사용자 지정 설정을 제외한 기본 모델로 실행합니다. 다른 파일 탐색과 자동 저장은 요청하지 않습니다. 계정을 바꿨다면 새 대화를 시작하세요. 대화는 Agent별로 유지하며 앱 재시작 시 초기화합니다. 최대 10회·512 KiB까지 전송합니다.</p></Disclosure>
    <SelectField label="대화 Agent" value={selected} disabled={busy} onChange={value => { setSelected(value as AgentId); setError('') }} options={(['codex', 'claude', 'gemini'] as const).map(id => { const agent = agents.find(a => a.id === id); return { value: id, label: `${agent?.name || id} · ${agent?.enabled && agent.version ? '활성 · 설치 확인' : '설정 필요'}` } })} />
    {!enabled && <Notice>AI Agents 화면에서 실행 파일을 확인하고 이 Agent를 활성화하세요. 로그인은 공식 CLI에서 진행합니다.</Notice>}
    <Conversation messages={conversation.messages} value={conversation.prompt} onChange={prompt => update({ ...conversation, prompt })} onSend={() => void send()} onCancel={() => { if (request.current) void api.cancel(request.current).catch(e => setError(e.message)) }} busy={busy} disabled={disabled || !enabled} error={error} />
    {conversation.proposal && <><Disclosure title="마지막 성공 응답의 전체 수정안"><CodeDiff format="code" value={conversation.proposal.result || '(빈 파일 제안)'} /></Disclosure><Button disabled={disabled || busy} onClick={() => { if (conversation.proposal?.draft === editor.draft) apply('proposal'); else { setConfirm('proposal'); dialog.current?.showModal() } }}>수정안을 편집 초안으로 가져오기</Button></>}
    <Button disabled={busy || !conversation.messages.length && !conversation.prompt} onClick={() => { setConfirm('clear'); dialog.current?.showModal() }}>이 Agent의 새 대화</Button>
    <Dialog dialogRef={dialog} title={confirm === 'clear' ? '대화 초기화 확인' : 'AI 수정안 가져오기'}>
      <p>{confirm === 'clear' ? '선택한 Agent의 대화와 입력·수정안을 지웁니다. 현재 파일 편집은 유지합니다.' : '편집 초안을 아래 내용으로 교체합니다. 실제 작업 파일 저장·스테이징·테스트는 수행하지 않습니다.'}</p>
      {confirm === 'proposal' && <>{conversation.proposal?.draft !== editor.draft && <Notice>AI 요청 이후 직접 편집한 내용이 있습니다. 가져오면 현재 편집 초안을 덮어씁니다.</Notice>}<CodeDiff format="code" value={conversation.proposal?.result || '(빈 파일 제안)'} /></>}
      <div className="bl-actions bl-dialog-actions"><Button onClick={() => dialog.current?.close()}>취소</Button><Button variant="primary" onClick={() => apply()}>{confirm === 'clear' ? '새 대화 시작' : '편집 초안 교체'}</Button></div>
    </Dialog>
  </Disclosure>
}
