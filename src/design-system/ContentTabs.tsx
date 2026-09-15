import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Button } from './components'

export type ContentTab = { id: string; label: string; content: ReactNode; closable?: boolean }
export function ContentTabs({ label, tabs, selected, onSelect, onClose, variant = 'workspace' }: { variant?: 'workspace' | 'underline'; label: string; tabs: ContentTab[]; selected: string; onSelect: (id: string) => void; onClose: (id: string) => void }) {
  const id = useId(), root = useRef<HTMLDivElement>(null), previous = useRef(selected)
  useLayoutEffect(() => {
    if (previous.current === selected) return
    previous.current = selected
    const frame = requestAnimationFrame(() => { const tab = root.current?.querySelector<HTMLButtonElement>('[role=tab][aria-selected=true]'); tab?.focus({ preventScroll: true }); tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) })
    return () => cancelAnimationFrame(frame)
  }, [selected])
  return <div className={`bl-content-tabs bl-content-tabs-${variant}`} ref={root}>
    <div className="bl-content-tabbar"><div className="bl-content-tablist" role="tablist" aria-label={label} onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || !(event.target instanceof Element) || event.target.getAttribute('role') !== 'tab') return
      const index = tabs.findIndex(tab => tab.id === selected)
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
      if (next >= 0) { event.preventDefault(); onSelect(tabs[next].id) }
      else if (event.key === 'Delete' && tabs[index]?.closable) { event.preventDefault(); onClose(selected) }
    }}>{tabs.map((tab, index) => <div className="bl-content-tab" role="presentation" key={tab.id} data-selected={tab.id === selected}>
      <Button variant="ghost" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={tab.id === selected} tabIndex={tab.id === selected ? 0 : -1} title={tab.label} onClick={() => onSelect(tab.id)}>{tab.label}</Button>
    </div>)}</div>{tabs.find(tab => tab.id === selected)?.closable && <Button variant="ghost" className="bl-content-tab-close" aria-label={`${tabs.find(tab => tab.id === selected)?.label} 탭 닫기`} onClick={() => onClose(selected)}>× 닫기</Button>}</div>
    {tabs.map((tab, index) => <div className="bl-content-tabpanel" role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} tabIndex={0} hidden={tab.id !== selected} key={tab.id}>{tab.content}</div>)}
  </div>
}
