import { Fragment, useRef, type ReactElement, type ReactNode } from 'react'
import { ContextMenu as Context } from '@base-ui/react/context-menu'
import { Menu } from '@base-ui/react/menu'
import { Button } from './components'

export type ContextAction = { label: string; disabled?: boolean; hint?: string } & ({ onClick: () => void } | { items: ContextAction[] })
export function ContextMenu({ children, label, description, groups, showButton = false, disabled = false }: { children: ReactElement; label: string; description?: string; groups: ContextAction[][]; showButton?: boolean; disabled?: boolean }) {
  const contextTrigger = useRef<HTMLDivElement>(null), menuTrigger = useRef<HTMLButtonElement>(null), opener = useRef<HTMLElement | null>(null)
  function select(item: Extract<ContextAction, { onClick: () => void }>) {
    const target = opener.current
    item.onClick()
    // Native dialogs outlive the portalled menu item that opened them.
    document.querySelector('dialog[open]')?.addEventListener('close', () => {
      if (target?.isConnected) (target.closest<HTMLElement>('button') || target).focus()
    }, { once: true })
  }
  function renderAction(item: ContextAction): ReactNode {
    if ('items' in item) return <Menu.SubmenuRoot key={item.label}>
      <Menu.SubmenuTrigger className="bl-context-item bl-context-submenu-trigger" aria-label={item.label} aria-description={item.hint} disabled={disabled || item.disabled}><span>{item.label}</span><span className="bl-context-submenu-arrow" aria-hidden="true">›</span>{item.hint && <small>{item.hint}</small>}</Menu.SubmenuTrigger>
      <Menu.Portal><Menu.Positioner className="bl-context-positioner" side="right" align="start" sideOffset={4} collisionPadding={8}><Menu.Popup className="bl-context-menu" tabIndex={0} aria-label={item.label} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} finalFocus={() => document.querySelector('dialog[open]') ? false : true}>{item.items.map(renderAction)}</Menu.Popup></Menu.Positioner></Menu.Portal>
    </Menu.SubmenuRoot>
    return <Menu.Item key={item.label} className="bl-context-item" aria-label={item.label} aria-description={item.hint} disabled={disabled || item.disabled} onClick={() => select(item)}><span>{item.label}</span>{item.hint && <small>{item.hint}</small>}</Menu.Item>
  }
  function items() {
    return <><Menu.Group><Menu.GroupLabel className="bl-context-title">{label}</Menu.GroupLabel>{description && <p className="bl-context-description">{description}</p>}</Menu.Group>{groups.filter(group => group.length).map((group, i) => <Fragment key={i}><Menu.Separator className="bl-context-separator" />{group.map(renderAction)}</Fragment>)}</>
  }
  const finalFocus = () => document.querySelector('dialog[open]') ? false : opener.current?.closest<HTMLElement>('button') || opener.current || true
  return <>
    <Context.Root disabled={disabled} onOpenChange={open => { if (open) opener.current = contextTrigger.current }}><Context.Trigger ref={contextTrigger} render={children} onKeyDown={event => {
      if (event.nativeEvent.isComposing || disabled || !(event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10')) return
      event.preventDefault(); event.stopPropagation()
      const box = event.currentTarget.getBoundingClientRect()
      event.currentTarget.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }))
    }} /><Context.Portal><Context.Positioner className="bl-context-positioner" sideOffset={4} collisionPadding={8}><Context.Popup className="bl-context-menu" tabIndex={0} aria-label={label} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} finalFocus={finalFocus}>{items()}</Context.Popup></Context.Positioner></Context.Portal></Context.Root>
    {showButton && <Menu.Root onOpenChange={open => { if (open) opener.current = menuTrigger.current }}><Menu.Trigger ref={menuTrigger} render={<Button variant="ghost" className="bl-branch-menu-button" disabled={disabled} aria-label={`${label} 메뉴`} title="작업 메뉴 · 우클릭 또는 Shift+F10" />}>⋯</Menu.Trigger><Menu.Portal><Menu.Positioner className="bl-context-positioner" side="right" align="start" sideOffset={4} collisionPadding={8}><Menu.Popup className="bl-context-menu" tabIndex={0} aria-label={label} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} finalFocus={finalFocus}>{items()}</Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root>}
  </>
}
