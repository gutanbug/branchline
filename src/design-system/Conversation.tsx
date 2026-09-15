import { Button, EmptyState, Notice, TextArea } from './components'

export function Conversation({ messages, value, onChange, onSend, onCancel, busy, disabled = false, error = '', label = '충돌 해결 대화', emptyTitle = '해결 방향을 이야기하세요', emptyDescription = '유지할 동작이나 양쪽 변경의 의도를 알려 주세요.' }: { label?: string; emptyTitle?: string; emptyDescription?: string; messages: { role: 'user' | 'assistant'; content: string }[]; value: string; onChange: (value: string) => void; onSend: () => void; onCancel: () => void; busy: boolean; disabled?: boolean; error?: string }) {
  return <div className="bl-conversation">
    <div className="bl-conversation-log" role="log" aria-label={label} aria-live="polite" tabIndex={0}>
      {!messages.length && <EmptyState title={emptyTitle}>{emptyDescription}</EmptyState>}
      {messages.map((message, index) => <article key={index}><strong>{message.role === 'user' ? '나' : 'Agent'}</strong><p>{message.content}</p></article>)}
    </div>
    {error && <Notice tone="error">{error}</Notice>}
    {busy && <Notice>응답을 생성하고 있습니다. 입력과 기존 수정안은 유지됩니다.</Notice>}
    <TextArea className="resize-none" label="Agent에게 전달할 요청" value={value} rows={4} maxLength={10000} disabled={disabled || busy} onChange={e => onChange(e.target.value)} />
    <div className="bl-actions"><Button variant="primary" disabled={disabled || busy || !value.trim()} loading={busy} onClick={onSend}>선택한 Agent에 전송</Button>{busy && <Button onClick={onCancel}>응답 중단</Button>}</div>
  </div>
}
