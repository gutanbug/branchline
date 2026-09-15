import { useRef, type CSSProperties } from 'react'

export function ResizeHandle({ label, value, min, max, onChange, style, orientation = 'vertical' }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; style?: CSSProperties; orientation?: 'vertical' | 'horizontal' }) {
  const horizontal = orientation === 'horizontal'
  const drag = useRef<{ x: number; value: number } | null>(null)
  const change = (next: number) => onChange(Math.round(Math.max(min, Math.min(max, next))))
  return <div className="bl-resize-handle" role="separator" aria-label={label} aria-orientation={orientation} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${value}px`} tabIndex={0} style={style} title={`${label} · 드래그 또는 ${horizontal ? '↑ ↓' : '← →'} 키`}
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); drag.current = { x: (horizontal ? event.clientY : event.clientX), value }; event.currentTarget.setPointerCapture(event.pointerId) }}
    onPointerMove={event => { if (drag.current) change(drag.current.value + (horizontal ? event.clientY : event.clientX) - drag.current.x) }}
    onPointerUp={event => { if (drag.current) change(drag.current.value + (horizontal ? event.clientY : event.clientX) - drag.current.x); drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
    onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}
    onKeyDown={event => { const step = event.shiftKey ? 1 : 16; const next = event.key === (horizontal ? 'ArrowUp' : 'ArrowLeft') ? value - step : event.key === (horizontal ? 'ArrowDown' : 'ArrowRight') ? value + step : event.key === 'Home' ? min : event.key === 'End' ? max : null; if (next !== null) { event.preventDefault(); change(next) } }} />
}
