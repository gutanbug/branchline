import { useRef, useState, type ReactNode } from 'react'
import { CodeDiff, ContentTabs, DiffFileBrowser, InspectorPanel, Notice } from '../../design-system'
import type { DiffFileSelection } from '../../design-system/DiffFileList'

export function CommitReview({ hidden, graph, sha, title, summary, details, onClose, visit, working }: { hidden?: boolean; working?: { content: ReactNode; visit: number; dirty: boolean; onClose: () => void }; graph: ReactNode; sha?: string; visit?: number; title: string; summary: ReactNode; details?: { value: string; error: string }; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const scope = `${sha || ''}/${visit || 0}`
  const [opened, setOpened] = useState<{ scope: string; files: DiffFileSelection[]; active: string }>({ scope, files: [], active: working ? 'working' : 'graph' })
  const [workingVisit, setWorkingVisit] = useState(working?.visit)
  if (working?.visit !== workingVisit) { setWorkingVisit(working?.visit); setOpened(previous => ({ ...previous, active: working ? 'working' : 'graph' })) }
  if (opened.scope !== scope) setOpened({ scope, files: [], active: 'graph' })
  const files = opened.scope === scope ? opened.files : [], active = opened.scope === scope ? opened.active : 'graph'
  function close(id: string) { if (id === 'working') { working?.onClose(); return } setOpened(previous => ({ ...previous, files: previous.files.filter(file => file.id !== id), active: previous.active === id ? 'graph' : previous.active })) }
  return <div hidden={hidden} ref={root} className={`bl-work-columns bl-history-columns bl-graph-columns ${active !== 'graph' ? 'bl-review-file-open' : ''} ${sha ? '' : 'bl-history-unselected'} ${active === 'working' ? 'bl-working-file-open' : ''}`} onKeyDownCapture={event => {
    if (active === 'graph' || event.key !== 'Escape' || event.nativeEvent.isComposing || document.querySelector('dialog[open]') || (event.target instanceof Element && event.target.closest('select,[role=menu],[role=listbox]'))) return
    event.preventDefault(); event.stopPropagation(); close(active)
  }}>
    <ContentTabs hideSingleTab label="커밋 그래프와 파일 변경" selected={active} onSelect={active => setOpened(previous => ({ ...previous, active }))} onClose={close} tabs={[
      { id: 'graph', label: '그래프', content: graph },
      ...(working ? [{ id: 'working', label: `작업 폴더${working.dirty ? ' · 수정 중' : ''}`, closable: true, content: working.content }] : []),
      ...files.map(file => ({ id: file.id, label: file.path, closable: true, content: <CodeDiff value={file.value} filename={file.path} /> })),
    ]} />
    {sha && active !== 'working' && <InspectorPanel title={title} summary={summary} navigationKey={scope} onClose={() => { if (active === 'graph') (root.current?.querySelector<HTMLElement>('.bl-graph-row[aria-pressed=true]') || root.current?.querySelector<HTMLElement>('.bl-commit-graph'))?.focus({ preventScroll: true }); onClose() }}>{expanded => !details ? <Notice>커밋을 읽고 있습니다…</Notice> : details.error ? <Notice tone="error">{details.error}</Notice> : <DiffFileBrowser key={scope} preview={expanded} value={details.value} selected={active === 'graph' ? undefined : active} onOpen={file => setOpened(previous => ({ scope, active: file.id, files: previous.scope === scope ? previous.files.some(item => item.id === file.id) ? previous.files : [...previous.files, file] : [file] }))} />}</InspectorPanel>}
  </div>
}
