import { formatCommitDate } from './commit-message'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { ResizeHandle } from './ResizeHandle'
import { ScrollOverview } from './ScrollOverview'
import { graphBranches, layoutGraph } from './graph-layout'
import { Badge, Button, EmptyState } from './components'
import { Tooltip } from './Tooltip'

type GraphCommit = { sha: string; parents: string[]; message: string; author: string; date: string }
const x = (lane: number) => 20 + lane * 24
const laneColor = (lane: number) => `var(--graph-lane-${lane % 6})`

export function CommitGraph({ commits, selected, onSelect, refs = [], head = null, density = 'comfortable', overview = false, continuous = false, onEndReached, focusSha, focusKey, renderRef, label }: { label?: string; renderRef?: (ref: { name: string; sha: string; ref?: string }, badge: ReactElement) => ReactNode; focusSha?: string; focusKey?: number; continuous?: boolean; onEndReached?: () => void; overview?: boolean; density?: 'comfortable' | 'compact'; commits: GraphCommit[]; selected: string | null; onSelect: (sha: string | null) => void; refs?: { name: string; sha: string; ref?: string }[]; head?: string | null }) {
  const scroller = useRef<HTMLDivElement>(null), sentinel = useRef<HTMLDivElement>(null), horizontal = useRef<HTMLDivElement>(null)
  const visibleWidth = useRef(0)
  const restoredTop = useRef<number | null>(null)
  const anchor = useRef<{ sha: string; offset: number; top: number } | null>(null)
  const height = density === 'compact' ? 48 : 68
  const [measured, setMeasured] = useState<Record<string, number>>({})
  const { sizes, offsets } = useMemo(() => {
    const sizes = commits.map(commit => measured[commit.sha] || height), offsets = [0]
    for (const size of sizes) offsets.push(offsets[offsets.length - 1] + size)
    return { sizes, offsets }
  }, [commits, measured, height])
  const restoreAnchor = useCallback(() => {
    const element = scroller.current, previous = anchor.current
    if (!element || !previous || previous.top === 0) return
    const index = commits.findIndex(commit => commit.sha === previous.sha)
    if (index >= 0) { element.scrollTop = (element.children[index] as HTMLElement).offsetTop + previous.offset; restoredTop.current = element.scrollTop }
  }, [commits])
  useLayoutEffect(restoreAnchor, [restoreAnchor, height, measured])
  const revealed = useRef('')
  useLayoutEffect(() => {
    const key = `${focusSha || ''}/${focusKey || ''}`
    if (!focusSha) { revealed.current = ''; return }
    if (revealed.current === key || !scroller.current) return
    const index = commits.findIndex(commit => commit.sha === focusSha)
    if (index < 0) return
    revealed.current = key
    scroller.current.scrollTop = Math.max(0, (scroller.current.children[index] as HTMLElement).offsetTop - scroller.current.clientHeight / 2 + scroller.current.children[index].getBoundingClientRect().height / 2)
    anchor.current = null
  }, [focusSha, focusKey, commits, height])
  const [viewport, setViewport] = useState({ width: 0, height: 0, total: 0, top: 0 })
  const [preferredWidth, setPreferredWidth] = useState<number | null>(null)
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const update = (capture = false) => {
      if (!element.clientWidth || !element.clientHeight) return
      let low = 0, high = commits.length - 1
      while (low < high) { const mid = Math.ceil((low + high) / 2); if ((element.children[mid] as HTMLElement).offsetTop <= element.scrollTop) low = mid; else high = mid - 1 }
      const row = element.children[low] as HTMLElement | undefined, sha = row?.querySelector('svg')?.getAttribute('data-sha')
      if (capture && element.scrollTop !== restoredTop.current && sha && row) anchor.current = { sha, offset: element.scrollTop - row.offsetTop, top: element.scrollTop }
      visibleWidth.current = element.clientWidth
      setViewport({ width: element.clientWidth, height: element.clientHeight, total: element.scrollHeight, top: element.scrollTop })
    }
    const pan = (event: WheelEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.bl-graph-cell') || !horizontal.current) return
      const delta = event.shiftKey ? event.deltaY || event.deltaX : event.deltaX
      if (!delta) return
      const before = horizontal.current.scrollLeft
      horizontal.current.scrollLeft += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1)
      if (horizontal.current.scrollLeft !== before) event.preventDefault()
    }
    update(!anchor.current)
    const scroll = () => update(true)
    const observer = new ResizeObserver(() => { if (element.clientWidth && element.clientHeight && visibleWidth.current && visibleWidth.current !== element.clientWidth) restoreAnchor(); update() }); observer.observe(element)
    element.addEventListener('scroll', scroll); element.addEventListener('wheel', pan, { passive: false })
    return () => { observer.disconnect(); element.removeEventListener('scroll', scroll); element.removeEventListener('wheel', pan) }
  }, [commits, height, measured, restoreAnchor])
  useEffect(() => {
    if (!onEndReached || !scroller.current || !sentinel.current) return
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) onEndReached() }, { root: scroller.current, rootMargin: '240px' })
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [onEndReached, commits.length])
  useLayoutEffect(() => {
    const element = scroller.current
    if (!element) return
    const measure = () => {
      if (!element.clientWidth || !element.clientHeight) return
      const next: Record<string, number> = {}
      for (const row of element.querySelectorAll<HTMLElement>('.bl-graph-row')) {
        const sha = row.querySelector('svg')?.getAttribute('data-sha')
        if (sha) next[sha] = row.getBoundingClientRect().height
      }
      setMeasured(previous => Object.keys(next).length === Object.keys(previous).length && Object.keys(next).every(sha => next[sha] === previous[sha]) ? previous : next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    for (const row of element.querySelectorAll('.bl-graph-row')) observer.observe(row)
    return () => observer.disconnect()
  }, [commits, refs, density, restoreAnchor])
  const branches = useMemo(() => graphBranches(commits, refs), [commits, refs])
  const rows = useMemo(() => layoutGraph(commits, continuous), [commits, continuous])
  const width = Math.max(2, ...rows.map(row => row.width)) * 24 + 16
  const marks = useCallback((row: ReturnType<typeof layoutGraph>[number], commit: GraphCommit, height: number, miniature = false) => {
    const middle = height / 2
    return <>
      {row.incoming.map((sha, lane) => sha && <path key={sha} style={{ stroke: laneColor(lane) }} d={`M${x(lane)} 0 V${middle}`} />)}
      {row.through.map(edge => <path key={edge.parent} style={{ stroke: laneColor(edge.to) }} d={`M${x(edge.from)} ${middle} V${height}`} />)}
      {row.edges.map(edge => <path key={edge.parent} data-parent={edge.parent} style={{ stroke: laneColor(edge.to) }} d={edge.from === edge.to ? `M${x(edge.from)} ${middle} V${height}` : `M${x(edge.from)} ${middle} C${x(edge.from)} ${middle + height / 4} ${x(edge.to)} ${middle + height / 4} ${x(edge.to)} ${height}`} />)}
      {!continuous && !!row.outside.length && <path className="bl-graph-boundary" style={{ stroke: laneColor(row.lane) }} d={`M${x(row.lane)} ${middle} v${middle - 4}`} />}
      {!miniature && <g style={{ '--lane-color': laneColor(row.lane) } as CSSProperties}>
        {selected === commit.sha && <circle className="bl-graph-node-halo" cx={x(row.lane)} cy={middle} r={11} />}
        <circle className="bl-graph-node" data-node="true" cx={x(row.lane)} cy={middle} r={commit.parents.length > 1 ? 6 : 4.5} data-merge={commit.parents.length > 1} data-head={head === commit.sha} />
        {commit.parents.length > 1 && <circle className="bl-graph-merge-core" cx={x(row.lane)} cy={middle} r={2} />}
      </g>}
    </>
  }, [continuous, selected, head])
  const refWidth = viewport.width >= 500 ? 140 : 0
  const maxColumn = Math.max(48, viewport.width - refWidth - 12 - 100)
  const column = Math.round(Math.max(48, Math.min(maxColumn, preferredWidth ?? Math.min(width, (viewport.width - refWidth) * .45))))
  useEffect(() => { if (scroller.current && horizontal.current) scroller.current.style.setProperty('--graph-pan', `${-horizontal.current.scrollLeft}px`) }, [column, width])
  const renderedRows = useMemo(() => commits.map((commit, index) => {
        const row = rows[index], rowHeight = measured[commit.sha] || height, labels = refs.filter(ref => ref.sha === commit.sha)
        const containing = [...(branches.get(commit.sha) || [])]
        const badges = <>{head === commit.sha && <Badge>HEAD</Badge>}{labels[0] && (renderRef ? renderRef(labels[0], <span className="bl-graph-ref-name"><Badge variant="branch">{labels[0].name}</Badge></span>) : <span className="bl-graph-ref-name"><Badge variant="branch">{labels[0].name}</Badge></span>)}{labels.length > 1 && <Tooltip focusOwner=".bl-graph-row" content={<><strong>연결된 브랜치 {labels.length}개</strong><ul>{labels.map((ref, index) => <li key={ref.ref || `${ref.name}/${index}`}><small>{ref.ref?.startsWith('refs/heads/') ? 'LOCAL' : ref.ref?.startsWith('refs/remotes/') ? 'REMOTE' : '참조'}</small><code>{ref.name}</code></li>)}</ul></>}><span className="bl-graph-ref-overflow" title=""><Badge>+{labels.length - 1}</Badge></span></Tooltip>}<span className="sr-only">{labels.slice(1).map(ref => ref.name).join(', ')}</span></>
        return <Button variant="ghost" key={commit.sha} className="bl-graph-row" style={{ '--lane-color': laneColor(row.lane) } as CSSProperties} aria-pressed={selected === commit.sha} onClick={() => onSelect(selected === commit.sha ? null : commit.sha)} title={commit.message}>
          <span className="bl-graph-refs" title={labels.map(ref => ref.name).join('\n')}>{badges}</span>
          <span className="bl-graph-cell"><svg width={width} height={rowHeight} viewBox={`0 0 ${width} ${rowHeight}`} aria-hidden="true" className="bl-graph-lanes" data-sha={commit.sha}>
            {marks(row, commit, rowHeight)}
          </svg><Tooltip focusOwner={labels.length < 2 ? '.bl-graph-row' : undefined} content={<><strong>포함 브랜치 · {containing.length}개 확인</strong>{containing.length ? <ul>{containing.map(ref => <li key={ref.ref || ref.name}><small>{ref.ref?.startsWith('refs/remotes/') ? 'REMOTE' : ref.ref?.startsWith('refs/heads/') ? 'LOCAL' : '브랜치'}{ref.sha === commit.sha ? ' · TIP' : ''}</small><code>{ref.name}</code></li>)}</ul> : <p>이 커밋과 연결된 브랜치 이름을 확인할 수 없습니다.</p>}<small>불러온 이력 기준 · 최초 작업 브랜치를 뜻하지 않습니다.</small></>}><span className="bl-graph-node-trigger" title="" style={{ left: x(row.lane) - 12, top: rowHeight / 2 - 12 }} /></Tooltip></span>
          <span className="bl-graph-content"><span className="bl-graph-title">{commit.message}</span><span className="bl-graph-meta"><code>{commit.sha.slice(0, 8)}</code><span>{commit.author}</span><span className="bl-graph-inline-refs" data-has-refs={labels.length > 0 || head === commit.sha} title={labels.map(ref => ref.name).join('\n')}>{badges}</span><time dateTime={commit.date} title={commit.date}>{formatCommitDate(commit.date)}</time></span></span>
          <span className="sr-only">부모 {commit.parents.length}개: {commit.parents.join(', ') || '없음'}{row.outside.length ? ` · 표시 범위 밖 부모 ${row.outside.length}개` : ''}</span>
        </Button>
      }), [commits, rows, refs, branches, head, selected, onSelect, width, height, measured, marks, renderRef])
  const miniatureRows = useMemo(() => overview && commits.map((commit, index) => <g key={commit.sha} transform={`translate(0 ${offsets[index]})`}>
    {selected === commit.sha && <rect width={width} height={sizes[index]} className="bl-graph-map-selected" />}
    {marks(rows[index], commit, sizes[index], true)}
  </g>), [overview, commits, sizes, offsets, selected, width, marks, rows])
  if (!commits.length) return <EmptyState title="일치하는 커밋이 없습니다">조회 브랜치나 필터를 확인하세요. 첫 커밋 전에는 그래프가 비어 있습니다.</EmptyState>
  return <div className={`bl-graph-explorer ${overview ? 'bl-graph-explorer-overview' : ''}`}>
    {overview && <div className="bl-graph-map"><small>누적<br />{commits.length}개</small><ScrollOverview label="누적 그래프로 이력 이동" value={viewport.top / Math.max(1, viewport.total - viewport.height)} viewport={viewport.height / Math.max(1, viewport.total)} onChange={value => { if (scroller.current) scroller.current.scrollTop = value * (scroller.current.scrollHeight - scroller.current.clientHeight) }}><svg className="bl-graph-lanes" viewBox={`0 0 ${width} ${offsets[commits.length]}`} preserveAspectRatio="none">
      {miniatureRows}
    </svg></ScrollOverview></div>}
    <div className="bl-graph-table" data-ref-column={refWidth > 0} style={{ '--graph-column': `${column}px`, '--graph-ref-width': `${refWidth}px`, '--graph-width': `${width}px`, '--graph-row-height': `${height}px` } as CSSProperties}>
    <ResizeHandle label="그래프 컬럼 너비" value={column} min={48} max={maxColumn} onChange={setPreferredWidth} style={{ left: refWidth + column }} />
    <div ref={scroller} className="bl-commit-graph" aria-label={label || "커밋 그래프"} tabIndex={0} onKeyDown={event => {
      if (event.target instanceof Element && event.target.closest('[role=menu]')) return
      if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === 'Escape') { event.preventDefault(); onSelect(null); return }
      if (!['ArrowUp', 'ArrowDown'].includes(event.key) || !(event.target instanceof Element)) return
      const row = event.target.closest('.bl-graph-row')
      if (!row) return
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.bl-graph-row')]
      const index = Math.max(0, Math.min(buttons.length - 1, buttons.indexOf(row as HTMLButtonElement) + (event.key === 'ArrowDown' ? 1 : -1)))
      event.preventDefault(); buttons[index].focus(); onSelect(commits[index].sha)
    }}>
      {renderedRows}
      <div ref={sentinel} className="bl-graph-sentinel" aria-hidden="true" />
    </div>
    <div className="bl-graph-scrollbar-row" style={{ width: viewport.width || '100%' }}><div ref={horizontal} className="bl-graph-xscroll" tabIndex={0} role="region" aria-label={label ? `${label} 좌우 스크롤` : "그래프 좌우 스크롤"} onScroll={event => scroller.current?.style.setProperty('--graph-pan', `${-event.currentTarget.scrollLeft}px`)}><div style={{ width, height: 1 }} /></div></div>
    </div>
  </div>
}
