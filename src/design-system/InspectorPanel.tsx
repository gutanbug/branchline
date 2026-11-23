import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Dialog } from './components'
import { IconButton } from './IconButton'

export function InspectorPanel({ title, summary, children, onClose, navigationKey, integratedToolbar = false }: { integratedToolbar?: boolean; navigationKey?: unknown; title: string; summary?: ReactNode; children: ReactNode | ((expanded: boolean, actions: ReactNode) => ReactNode); onClose?: () => void }) {
  const [isExpanded, setExpanded] = useState(false)
  const expanded = useRef<HTMLDialogElement>(null), inlineSlot = useRef<HTMLDivElement>(null), expandedSlot = useRef<HTMLDivElement>(null)
  const expandButton = useRef<HTMLButtonElement>(null), restoreFocus = useRef(false)
  useEffect(() => { expanded.current?.close() }, [navigationKey])
  // Keep one portal container so expanding never resets the selected file, view mode or scroll position.
  const [content] = useState(() => document.createElement('div'))
  useLayoutEffect(() => {
    content.setAttribute('class', 'bl-inspector-content'); content.setAttribute('role', 'region'); content.setAttribute('tabindex', '0'); content.setAttribute('aria-label', `${title} 본문`)
    const slot = isExpanded ? expandedSlot.current : inlineSlot.current
    slot?.appendChild(content)
    if (!isExpanded && restoreFocus.current) { expandButton.current?.focus({ preventScroll: true }); restoreFocus.current = false }
    return () => content.remove()
  }, [content, isExpanded, title])
  const actions = <div className="bl-actions">{(!integratedToolbar || !isExpanded) && <IconButton ref={expandButton} icon="expand" label={`${title} 크게 보기`} onClick={() => { setExpanded(true); expanded.current?.showModal() }} />}{onClose && <IconButton icon="close" label={`${title} 닫기`} onClick={onClose} />}</div>
  return <aside className="bl-inspector" aria-label={title} onKeyDown={event => { if (event.key === 'Escape' && !event.nativeEvent.isComposing && onClose && !expanded.current?.open) { event.preventDefault(); event.stopPropagation(); onClose() } }}>
    {!integratedToolbar && <header className="bl-inspector-header"><div className="bl-inspector-heading"><h2>{title}</h2>{actions}</div>{summary && !isExpanded && <div className="bl-inspector-summary">{summary}</div>}</header>}
    <div ref={inlineSlot} className="bl-inspector-slot" />
    <Dialog dialogRef={expanded} title={integratedToolbar ? "파일 변경 크게 보기" : `${title} 크게 보기`} onClose={() => { restoreFocus.current = integratedToolbar; setExpanded(false) }}><div className="bl-inspector-expanded">{isExpanded && summary}<div ref={expandedSlot} className="bl-inspector-slot" /></div></Dialog>
    {createPortal(typeof children === 'function' ? children(isExpanded, actions) : children, content)}
  </aside>
}
