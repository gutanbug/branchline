import { Fragment, useLayoutEffect, useRef, type ReactElement, type ReactNode } from 'react'
import { ContextMenu as Context } from '@base-ui/react/context-menu'
import { Menu } from '@base-ui/react/menu'
import { Tooltip } from './Tooltip'
import { Button } from './components'

export type ContextAction = { label: string; disabled?: boolean; hint?: string } & ({ onClick: () => void } | { items: ContextAction[] })
export function ContextMenu({ children, label, description, groups, onOpen, showButton = false, disabled = false, menuOnly = false }: { children: ReactElement; label: string; description?: string; onOpen?: () => void; groups: ContextAction[][]; showButton?: boolean; disabled?: boolean; menuOnly?: boolean }) {
  const contextTrigger = useRef<HTMLDivElement>(null), menuTrigger = useRef<HTMLButtonElement>(null), opener = useRef<HTMLElement | null>(null)
  const deferredFocus = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (disabled) return
    const target = deferredFocus.current
    deferredFocus.current = null
    if (target?.isConnected && document.activeElement === document.body && !document.querySelector('dialog[open]')) target.focus({ preventScroll: true })
  }, [disabled])
  function select(item: Extract<ContextAction, { onClick: () => void }>) {
    const target = opener.current
    item.onClick()
    // Native dialogs outlive the portalled menu item that opened them.
    document.querySelector('dialog[open]')?.addEventListener('close', () => {
      if (target?.isConnected) (target.closest<HTMLElement>('button') || target).focus({ preventScroll: true })
    }, { once: true })
  }
  function renderAction(item: ContextAction): ReactNode {
    const caption = item.disabled && item.hint ? <Tooltip content={item.hint} focusOwner="[role=menuitem]"><span>{item.label}</span></Tooltip> : <span>{item.label}</span>
    if ('items' in item) return <Menu.SubmenuRoot key={item.label}>
      <Menu.SubmenuTrigger className="bl-context-item bl-context-submenu-trigger" aria-label={item.label} aria-description={item.hint} title={item.disabled ? undefined : item.hint} disabled={disabled || item.disabled}>{caption}<span className="bl-context-submenu-arrow" aria-hidden="true">›</span></Menu.SubmenuTrigger>
      <Menu.Portal><Menu.Positioner className="bl-context-positioner" side="right" align="start" sideOffset={4} collisionPadding={8}><Menu.Popup className="bl-context-menu" tabIndex={0} aria-label={item.label} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} finalFocus={() => document.querySelector('dialog[open]') ? false : true}>{item.items.map(renderAction)}</Menu.Popup></Menu.Positioner></Menu.Portal>
    </Menu.SubmenuRoot>
    return <Menu.Item key={item.label} label={item.label} className="bl-context-item" aria-label={item.label} aria-description={item.hint} title={item.disabled ? undefined : item.hint} disabled={disabled || item.disabled} onClick={() => select(item)}>{caption}</Menu.Item>
  }
  function items() {
    return <><Menu.Group><Menu.GroupLabel className="bl-context-title" title={description}>{label}</Menu.GroupLabel></Menu.Group>{groups.filter(group => group.length).map((group, i) => <Fragment key={i}><Menu.Separator className="bl-context-separator" />{group.map(renderAction)}</Fragment>)}</>
  }
  function finalFocus() {
    if (document.querySelector('dialog[open]')) return false
    const target = opener.current?.closest<HTMLElement>('button') || opener.current
    // A Git action can disable the opener before the popup finishes closing.
    if (target?.matches(':disabled')) {
      deferredFocus.current = target
      return false
    }
    return target || true
  }
  return <>
    {!menuOnly && <Context.Root disabled={disabled} onOpenChange={open => { if (open) { opener.current = contextTrigger.current; onOpen?.() } }}><Context.Trigger ref={contextTrigger} render={children} onKeyDown={event => {
      if (event.nativeEvent.isComposing || disabled || !(event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10')) return
      event.preventDefault(); event.stopPropagation()
      const box = event.currentTarget.getBoundingClientRect()
      event.currentTarget.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }))
    }} /><Context.Portal><Context.Positioner className="bl-context-positioner" sideOffset={4} collisionPadding={8}><Context.Popup className="bl-context-menu" tabIndex={0} aria-label={label} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} finalFocus={finalFocus}>{items()}</Context.Popup></Context.Positioner></Context.Portal></Context.Root>}
    {(showButton || menuOnly) && <Menu.Root onOpenChange={open => { if (open) { opener.current = menuTrigger.current; onOpen?.() } }}><Menu.Trigger ref={menuTrigger} disabled={disabled} render={menuOnly ? children : <Button variant="ghost" className="bl-branch-menu-button" disabled={disabled} aria-label={`${label} 메뉴`} title="작업 메뉴 · 우클릭 또는 Shift+F10" />}>{menuOnly ? undefined : '⋯'}</Menu.Trigger><Menu.Portal><Menu.Positioner className="bl-context-positioner" side={menuOnly ? "bottom" : "right"} align="start" sideOffset={4} collisionPadding={8}><Menu.Popup className="bl-context-menu" tabIndex={0} aria-label={label} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} finalFocus={finalFocus}>{items()}</Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root>}
  </>
}
