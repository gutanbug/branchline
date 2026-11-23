import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import { Toast as BaseToast } from '@base-ui/react/toast'
import { IconButton } from './IconButton'

export type ToastTone = 'success' | 'info' | 'warning' | 'error' | 'loading'
const labels: Record<ToastTone, string> = { success: '완료', info: '안내', warning: '확인 필요', error: '실패', loading: '진행 중' }
const symbols: Record<ToastTone, string> = { success: '✓', info: 'i', warning: '!', error: '×', loading: '↻' }

/** Operation feedback only; field validation and persistent recovery guidance stay inline. */
export function ToastMessage({ message, tone = 'info', scope = '', children, duration }: { message?: string; tone?: ToastTone; scope?: string; children?: ReactNode; duration?: number }) {
  const { add, close } = BaseToast.useToastManager()
  const content = useEffectEvent(() => ({ children, duration }))
  useEffect(() => {
    if (!message) return
    const options = content()
    const id = add({ id: `${scope}\0${tone}\0${message}`, title: `${labels[tone]}${scope ? ` · ${scope}` : ''}`, description: message, type: tone, priority: 'low', timeout: options.duration ?? (tone === 'success' || tone === 'info' ? 6000 : 0), data: { actions: options.children } })
    // Retire feedback with its source so old actions do not cover the next workspace.
    return () => close(id)
  }, [message, tone, scope, duration, add, close])
  return null
}

function ToastViewport() {
  const { toasts, close } = BaseToast.useToastManager<{ actions?: ReactNode }>()
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const retire = useEffectEvent(() => { for (const toast of toasts) if (toast.type !== 'loading') close(toast.id) })
  useEffect(() => {
    // Native dialogs occupy the top layer and make body portals inert.
    let current: HTMLElement | null = null
    const sync = () => {
      const next = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1) || null
      // A newly opened dialog starts a new task: earlier results must not cover it or join its focus order.
      if (next && next !== current) retire()
      current = next
      setContainer(next)
    }
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'], childList: true })
    sync()
    return () => observer.disconnect()
  }, [])
  return <BaseToast.Portal container={container || undefined}>
    <BaseToast.Viewport className="bl-system bl-toasts" lang="ko" aria-label="작업 알림 · F6으로 이동" aria-live="off">
      {toasts.map(toast => {
        const tone = (toast.type || 'info') as ToastTone
        return <BaseToast.Root key={toast.id} toast={toast} className="bl-toast shadow-menu" role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'} aria-atomic="true" aria-modal={undefined} swipeDirection={[]} onKeyDownCapture={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (tone !== 'loading') close(toast.id) } }}>
          <span className={`bl-toast-symbol ${tone === 'loading' ? 'bl-icon-busy' : ''}`} aria-hidden="true">{symbols[tone]}</span>
          <div className="bl-toast-content"><BaseToast.Title className="bl-toast-title" /><BaseToast.Description className="bl-toast-description" />{toast.data?.actions && <div className="bl-toast-actions">{toast.data.actions}</div>}</div>
          {tone !== 'loading' && <BaseToast.Close aria-hidden={false} render={<IconButton icon="close" label="알림 닫기" tooltip={false} />} />}
        </BaseToast.Root>
      })}
    </BaseToast.Viewport>
  </BaseToast.Portal>
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return <BaseToast.Provider limit={Number.MAX_SAFE_INTEGER}><>{children}<ToastViewport /></></BaseToast.Provider>
}
