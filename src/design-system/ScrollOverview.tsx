import { useRef, type ReactNode } from 'react'

export function ScrollOverview({ label, value, viewport, onChange, children }: { label: string; value: number; viewport: number; onChange: (value: number) => void; children: ReactNode }) {
  const grab = useRef<number | null>(null)
  const fraction = Math.max(0, Math.min(1, viewport)), position = Math.max(0, Math.min(1, value))
  const change = (next: number) => { if (fraction < 1) onChange(Math.max(0, Math.min(1, next))) }
  function move(element: HTMLElement, y: number) {
    const bounds = element.getBoundingClientRect(), thumb = Math.min(bounds.height, Math.max(20, bounds.height * fraction))
    if (bounds.height > thumb) change((y - bounds.top - (grab.current ?? thumb / 2)) / (bounds.height - thumb))
  }
  const thumbHeight = `min(100%, max(20px, ${fraction * 100}%))`
  return <div className="bl-scroll-overview" role="slider" aria-label={label} aria-orientation="vertical" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(position * 100)} aria-valuetext={`이력 위치 ${Math.round(position * 100)}%`} aria-disabled={fraction >= 1} tabIndex={0} title="클릭·드래그 또는 ↑ ↓ 키로 이력 이동"
    onPointerDown={event => { if (event.button !== 0 || fraction >= 1) return; event.preventDefault(); event.currentTarget.focus(); const bounds = event.currentTarget.getBoundingClientRect(), thumb = Math.min(bounds.height, Math.max(20, bounds.height * fraction)), y = event.clientY - bounds.top, top = position * (bounds.height - thumb); grab.current = y >= top && y <= top + thumb ? y - top : thumb / 2; event.currentTarget.setPointerCapture(event.pointerId); move(event.currentTarget, event.clientY) }}
    onPointerMove={event => { if (grab.current !== null) move(event.currentTarget, event.clientY) }}
    onPointerUp={event => { grab.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
    onPointerCancel={() => { grab.current = null }} onLostPointerCapture={() => { grab.current = null }}
    onKeyDown={event => { const page = Math.min(1, fraction / Math.max(.01, 1 - fraction)); const next = event.key === 'ArrowUp' ? position - .02 : event.key === 'ArrowDown' ? position + .02 : event.key === 'PageUp' ? position - page : event.key === 'PageDown' ? position + page : event.key === 'Home' ? 0 : event.key === 'End' ? 1 : null; if (next !== null) { event.preventDefault(); change(next) } }}>
    <div className="bl-scroll-overview-art" aria-hidden="true">{children}</div><div className="bl-scroll-overview-thumb" aria-hidden="true" style={{ height: thumbHeight, top: `calc(${position} * (100% - ${thumbHeight}))` }} />
  </div>
}
