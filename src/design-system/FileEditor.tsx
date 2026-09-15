import { useState, type ReactNode } from 'react'
import { Button, Disclosure, EmptyState, Notice, TextArea } from './components'

export type DirectoryEntry = { path: string; name: string; directory: boolean; disabled?: boolean }
export type DirectoryState = { entries?: DirectoryEntry[]; error?: string }
export function FileEditor({ filename, value, onChange, readOnly = false, dirty, busy, directories, expanded, onFolder, onFile, actions, feedback }: {
  filename?: string; value: string; onChange: (value: string) => void; readOnly?: boolean; dirty: boolean; busy: boolean;
  directories: Record<string, DirectoryState>; expanded: string[]; onFolder: (path: string, open: boolean) => void; onFile: (path: string) => void; actions: ReactNode; feedback?: ReactNode;
}) {
  const [line, setLine] = useState(1)
  function folder(path: string): ReactNode {
    const state = directories[path]
    if (!state) return <Notice compact>폴더를 읽고 있습니다…</Notice>
    if (state.error) return <Notice tone="error" compact>{state.error}<Button onClick={() => onFolder(path, true)}>다시 읽기</Button></Notice>
    return state.entries?.length ? <ul>{state.entries.map(entry => <li key={entry.path}>{entry.directory
      ? <Disclosure title={entry.name} open={expanded.includes(entry.path)} onOpenChange={open => onFolder(entry.path, open)}>{expanded.includes(entry.path) && folder(entry.path)}</Disclosure>
      : <Button variant="ghost" disabled={busy || entry.disabled} title={entry.disabled ? `${entry.path} · 일반 파일만 편집 가능` : entry.path} aria-label={`${entry.path} 파일 열기`} aria-pressed={filename === entry.path} onClick={() => onFile(entry.path)}><span aria-hidden="true">▤</span><span>{entry.name}</span></Button>}</li>)}</ul> : <p className="bl-muted">빈 폴더입니다.</p>
  }
  return <div className="bl-file-editor">
    <section className="bl-file-editor-main" aria-label="작업 파일 편집기">
      <div className="bl-file-editor-heading"><strong title={filename}>{filename || '작업 폴더'}</strong><div className="bl-actions">{actions}</div></div>
      {feedback}
      {filename ? <><TextArea label="파일 내용" className="bl-source-input resize-none" value={value} readOnly={readOnly || busy} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" onChange={event => onChange(event.target.value)} onSelect={event => setLine(event.currentTarget.value.slice(0, event.currentTarget.selectionStart).split('\n').length)} /><div className="bl-file-editor-status"><span>{dirty ? '저장하지 않음' : readOnly ? '읽기 전용' : '저장됨'}</span><span>줄 {line} / {value.split('\n').length} · UTF-8</span></div></> : <EmptyState title="오른쪽에서 파일을 선택하세요">현재 작업 폴더의 텍스트를 편집하고 저장할 수 있습니다.</EmptyState>}
    </section>
    <aside className="bl-directory-browser" aria-label="작업 폴더 파일 디렉터리"><div className="bl-row-between"><strong>파일 디렉터리</strong><Button variant="ghost" aria-label="파일 디렉터리 새로고침" title="파일 디렉터리 새로고침" disabled={busy} onClick={() => onFolder('', true)}>↻</Button></div>{folder('')}</aside>
  </div>
}
