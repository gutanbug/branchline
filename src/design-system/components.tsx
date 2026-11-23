import { useId, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode, RefObject, Ref } from 'react'
import mark from '../../branchline-design-system-handoff/assets/branchline-mark.svg'
import { Tooltip } from './Tooltip'
import { DotPattern } from './DotPattern'

export function Brand() {
  return <span className="wordmark"><img className="mark" src={mark} alt="" />branchline</span>
}

export function Button({ variant = 'secondary', loading = false, children, disabled, className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement>; variant?: 'primary' | 'secondary' | 'ghost'; loading?: boolean }) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={`btn btn-${variant} ${className}`}>{loading && <span aria-hidden="true">↻</span>}{children}</button>
}

export function ToolbarButton({ icon, children, onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode }) {
  return <button type="button" onClick={onClick} {...props} className={`toolbar-btn ${props.className ?? ''}`}><span aria-hidden="true">{icon}</span>{children}</button>
}

export function Badge({ children, variant = 'neutral' }: { children: ReactNode; variant?: 'neutral' | 'branch' }) {
  return <span className={variant === 'branch' ? 'branch-tag' : 'neutral-tag'}>{children}</span>
}

export function TextField({ label, hideLabel, hint, error, id, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hideLabel?: boolean; hint?: string; error?: string; ref?: RefObject<HTMLInputElement | null> }) {
  const generated = useId()
  const fieldId = id ?? generated
  const description = [props['aria-describedby'], hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(' ') || undefined
  return <div className="field"><div className="bl-field-label"><label className={hideLabel ? 'sr-only' : undefined} htmlFor={fieldId}>{label}</label>{hint && <Tooltip content={hint}><Button variant="ghost" className="bl-field-help" onClick={event => event.currentTarget.focus()} aria-label={`${label} 도움말`}>?</Button></Tooltip>}</div><input ref={ref} {...props} id={fieldId} className={`input ${props.className ?? ''}`} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={description} />{hint && <span className="sr-only" id={`${fieldId}-hint`}>{hint}</span>}{error && <small id={`${fieldId}-error`} role="alert">⚠ {error}</small>}</div>
}

export function TextArea({ label, id, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const generated = useId()
  const fieldId = id ?? generated
  return <div className="field"><label htmlFor={fieldId}>{label}</label><textarea {...props} id={fieldId} className={`textarea resize-none ${props.className ?? ''}`} /></div>
}

export function Checkbox({ label, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }) {
  return <label className="bl-checkbox"><input {...props} type="checkbox" /><span>{label}</span></label>
}

export function EmptyState({ title = '커밋을 선택하세요', children = '목록에서 커밋을 선택하면 상세 정보와 변경 내용을 확인할 수 있습니다.', decorated = false, action }: { title?: string; children?: ReactNode; decorated?: boolean; action?: ReactNode }) {
  return <div className="empty" data-decorated={decorated || undefined}>{decorated && <DotPattern />}<strong>{title}</strong><p>{children}</p>{action && <div className="bl-empty-action">{action}</div>}</div>
}

export function Dialog({ dialogRef, title, children, onClose, busy = false, size = 'default' }: { dialogRef: RefObject<HTMLDialogElement | null>; title: string; children: ReactNode; onClose?: () => void; busy?: boolean; size?: 'default' | 'wide' }) {
  const titleId = useId()
  return <dialog ref={dialogRef} className={`bl-dialog shadow-dialog ${size === 'wide' ? 'bl-dialog-wide' : ''}`} aria-labelledby={titleId} onClose={onClose} onCancel={event => { if (busy) event.preventDefault() }}><div className="bl-dialog-heading"><h2 id={titleId}>{title}</h2><Button variant="ghost" disabled={busy} aria-label="닫기" onClick={() => dialogRef.current?.close()}>×</Button></div>{children}</dialog>
}

export function Notice({ children, tone = 'info', compact = false, className = '' }: { children: ReactNode; tone?: 'info' | 'error'; compact?: boolean; className?: string }) {
  return <div className={`bl-notice ${tone === 'error' ? 'bl-notice-error' : ''} ${compact ? 'bl-notice-compact' : ''} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}

/** `section` reads as a full-width row with an explicit 펼치기/접기 cue; `tree` stays compact for folder/branch trees. */
export function Disclosure({ title, children, initiallyOpen = false, open, onOpenChange, lazy = false, variant = 'section' }: { title: ReactNode; lazy?: boolean; children: ReactNode; initiallyOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; variant?: 'section' | 'tree' }) {
  const [localOpen, setLocalOpen] = useState(initiallyOpen)
  return <details className="bl-disclosure" data-variant={variant} open={open ?? localOpen} onToggle={event => { if (open === undefined) setLocalOpen(event.currentTarget.open) }}><summary onClick={open === undefined ? undefined : event => { event.preventDefault(); onOpenChange?.(!open) }}>{title}</summary><div>{(!lazy || (open ?? localOpen)) && children}</div></details>
}

export function UsageMeter({ value, label }: { value: number; label: string }) {
  return <meter className="bl-usage-meter" min={0} max={100} value={value} aria-label={label} />
}

/** 검색은 조회용이며 실제 체크아웃을 수행하지 않습니다. */
export function BranchFilter({ branches, value, onChange, disabled = false }: { branches: string[]; value: string | null; onChange: (value: string | null) => void; disabled?: boolean }) {
  const id = useId()
  const popover = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [query, setQuery] = useState('')
  const options = branches.filter(branch => branch.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  function choose(branch: string | null) {
    onChange(branch)
    popover.current?.hidePopover()
    trigger.current?.focus()
  }
  return <div className="bl-branch-filter">
    <button ref={trigger} type="button" className="btn btn-secondary" disabled={disabled} popoverTarget={id} aria-label={`조회 브랜치: ${value ?? '전체'}`} onClick={() => setQuery('')}><span className="num">⑂ {value ?? '전체 브랜치'}</span><span aria-hidden="true">⌄</span></button>
    <div ref={popover} id={id} popover="auto" role="dialog" aria-label="조회 브랜치 선택" className="context-menu shadow-menu bl-branch-popover" onToggle={event => { if (event.newState === 'open') input.current?.focus() }} onKeyDown={event => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      const items = [input.current!, ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
      const index = items.indexOf(document.activeElement as HTMLInputElement)
      items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    }}>
      <div className="dropdown-search"><label className="sr-only" htmlFor={`${id}-search`}>브랜치 검색</label><input ref={input} id={`${id}-search`} value={query} onChange={event => setQuery(event.target.value)} placeholder="브랜치 검색" /></div>
      <ul className="bl-options" aria-label="브랜치 검색 결과">
        {!query.trim() && <li><button type="button" aria-pressed={value === null} onClick={() => choose(null)}>전체 브랜치</button></li>}
        {options.map(branch => <li key={branch}><button type="button" className="dropdown-option" aria-pressed={value === branch} onClick={() => choose(branch)}>{branch}{value === branch && <span aria-hidden="true">✓</span>}</button></li>)}
      </ul>
      {options.length === 0 && <p role="status" className="bl-no-results">검색 결과가 없습니다. 다른 브랜치 이름을 입력하세요.</p>}
    </div>
  </div>
}

export function SelectField({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  return <label className="field"><span>{label}</span><select className="input" value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
}

export function Pagination({ label, page, hasMore, busy = false, summary, previousLabel = '이전', nextLabel = '다음', onChange }: { label: string; page: number; hasMore: boolean; busy?: boolean; summary?: ReactNode; previousLabel?: string; nextLabel?: string; onChange: (page: number) => void }) {
  return <nav className="bl-pagination" aria-label={label}><Button disabled={busy || page <= 1} onClick={() => onChange(page - 1)}>{previousLabel}</Button><span aria-live="polite">{summary ?? `${page}페이지`}</span><Button disabled={busy || !hasMore} onClick={() => onChange(page + 1)}>{nextLabel}</Button></nav>
}
