import { useId, useRef, useState, type ReactNode } from 'react'
import { Badge, Button } from './components'
import { Icon } from './IconButton'

/** The query stays available when the additional filters are collapsed. */
export function FilterBar({ context, search, children, count, label }: {
  context: ReactNode; search: ReactNode; children: ReactNode; count: number; label: string
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId(), toggle = useRef<HTMLButtonElement>(null)
  return <div className="bl-filter-bar">
    <div className="bl-filter-bar-tools">
      {context}
      <div className="bl-filter-bar-query">
        {search}
        <Button ref={toggle} className="bl-filter-toggle" aria-expanded={open} aria-controls={panelId}
          aria-label={label} aria-description={count ? `필터 ${count}개 적용 중` : undefined} onClick={() => setOpen(!open)}
          onKeyDown={event => { if (event.key === 'Escape' && open && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); setOpen(false) } }}>
          <Icon name="filter" />필터{count > 0 && <Badge>{count}</Badge>}
        </Button>
      </div>
    </div>
    <div id={panelId} className="bl-filter-bar-panel" hidden={!open} onKeyDown={event => {
      if (event.key !== 'Escape' || event.nativeEvent.isComposing || event.defaultPrevented) return
      event.stopPropagation()
      setOpen(false)
      toggle.current?.focus()
    }}>{open && children}</div>
  </div>
}
