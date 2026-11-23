import { useEffect, useRef, type HTMLAttributes } from 'react'

/**
 * Scroll container that fades its top/bottom edge while more content is hidden there.
 * Scrollbars are hidden app-wide, so the fade (after Magic UI's Progressive Blur, as a mask instead of a blur)
 * is the cue that the area scrolls.
 */
export function ScrollArea({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = element
      element.toggleAttribute('data-more-above', scrollTop > 1)
      element.toggleAttribute('data-more-below', scrollTop + clientHeight < scrollHeight - 1)
    }
    update()
    element.addEventListener('scroll', update, { passive: true })
    const resize = new ResizeObserver(update)
    resize.observe(element)
    const mutations = new MutationObserver(update)
    mutations.observe(element, { childList: true, subtree: true })
    return () => { element.removeEventListener('scroll', update); resize.disconnect(); mutations.disconnect() }
  }, [])
  return <div ref={ref} className={`bl-scroll-area ${className}`} {...props}>{children}</div>
}
