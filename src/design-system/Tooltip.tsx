import { useLayoutEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'

/** focusOwner lets a read-only badge share its containing row's keyboard focus. */
export function Tooltip({ children, content, focusOwner }: { children: ReactElement; content: ReactNode; focusOwner?: string }) {
  const id = useId()
  const trigger = useRef<HTMLElement>(null), [open, setOpen] = useState(false)
  useLayoutEffect(() => {
    const owner = focusOwner ? trigger.current?.closest<HTMLElement>(focusOwner) : null
    if (!owner) return
    const focus = () => { if (owner.matches(':focus-visible') && trigger.current?.getBoundingClientRect().width) setOpen(true) }
    const blur = () => setOpen(false)
    owner.addEventListener('focus', focus); owner.addEventListener('blur', blur)
    return () => { owner.removeEventListener('focus', focus); owner.removeEventListener('blur', blur) }
  }, [focusOwner])
  useLayoutEffect(() => {
    if (!open) return
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) {
        if (!document.getElementById(`${id}-content`)?.closest('[data-anchor-hidden]')) { event.preventDefault(); event.stopPropagation() }
        setOpen(false)
      }
    }
    document.addEventListener('keydown', key, true)
    return () => document.removeEventListener('keydown', key, true)
  }, [open, id])
  return <BaseTooltip.Root triggerId={id} open={open} onOpenChange={setOpen}>
    <BaseTooltip.Trigger id={id} aria-describedby={open ? `${id}-content` : undefined} ref={(element: HTMLElement | null) => { trigger.current = element }} render={children} delay={180} closeDelay={120} />
    <BaseTooltip.Portal><BaseTooltip.Positioner className="bl-tooltip-positioner" side="right" align="start" sideOffset={8} collisionPadding={8}><BaseTooltip.Popup role="tooltip" id={`${id}-content`} tabIndex={0} className="bl-tooltip shadow-menu">{content}</BaseTooltip.Popup></BaseTooltip.Positioner></BaseTooltip.Portal>
  </BaseTooltip.Root>
}
