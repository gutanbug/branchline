import { formatCommitDate } from './commit-message'
import { Fragment, useCallback, useEffect, useLayoutEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode, type RefObject } from 'react'
import { ResizeHandle } from './ResizeHandle'
import { ScrollOverview } from './ScrollOverview'
import { graphBranches, layoutGraph } from './graph-layout'
import { Badge, Button, EmptyState } from './components'
import { Tooltip } from './Tooltip'

type GraphCommit = { sha: string; parents: string[]; message: string; author: string; date: string }
type GraphRef = { name: string; sha: string; ref?: string }
const noRefs: GraphRef[] = []

function rowAt(offsets: number[], pixel: number) {
  let low = 0, high = offsets.length - 2
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (offsets[middle] <= pixel) low = middle
    else high = middle - 1
  }
  return low
}

const x = (lane: number) => 20 + lane * 24
const laneColor = (lane: number) => `var(--graph-lane-${lane % 6})`

export type GraphPosition = { sha: string; index: number; offset: number; left: number }

type VisibleRow = { sha: string; center: number }
type LinkedViewport = { rows: VisibleRow[]; positions: ReadonlyMap<string, number>; first: number; last: number }
export type GraphScrollPeer = (view: LinkedViewport) => void
export type GraphScrollLink = { self: RefObject<GraphScrollPeer | null>; peer: RefObject<GraphScrollPeer | null> }

export function CommitGraph({ scrollLink, startIndex = 0, onStartReached, initialPosition, onPosition, commits, selected, onSelect, refs = noRefs, tags = noRefs, head = null, density = 'comfortable', overview = false, continuous = false, onEndReached, focusSha, focusKey, renderRef, renderRow, selectedBadge, label }: { scrollLink?: GraphScrollLink; startIndex?: number; onStartReached?: () => void; initialPosition?: GraphPosition; onPosition?: (value: GraphPosition) => void; label?: string; selectedBadge?: ReactNode; renderRow?: (commit: GraphCommit, row: ReactElement) => ReactNode; renderRef?: (ref: { name: string; sha: string; ref?: string }, badge: ReactElement) => ReactNode; focusSha?: string; focusKey?: number; continuous?: boolean; onEndReached?: () => void; overview?: boolean; density?: 'comfortable' | 'compact'; commits: GraphCommit[]; selected: string | null; onSelect: (sha: string | null) => void; tags?: { name: string; sha: string }[]; refs?: { name: string; sha: string; ref?: string }[]; head?: string | null }) {
  const scroller = useRef<HTMLDivElement>(null), sentinel = useRef<HTMLDivElement>(null), horizontal = useRef<HTMLDivElement>(null)
  const anchor = useRef<{ sha: string; offset: number } | null>(null)
  const restoredTop = useRef<number | null>(null)
  const pending = useRef(initialPosition)
  useLayoutEffect(() => { pending.current = initialPosition }, [initialPosition])
  const height = density === 'compact' ? 48 : 68
  const [measured, setMeasured] = useState<Record<string, number>>({})
  const positions = useMemo(() => new Map(commits.map((commit, index) => [commit.sha, index])), [commits])
  const [viewport, setViewport] = useState({ width: 0, height: 0, top: 0 })
  const [alignmentSpace, setAlignmentSpace] = useState(0)
  // Linked graphs reserve half a viewport so any row can be centred against its peer. A history that already
  // fits needs no runway: alignToPeer adds only the space a specific alignment is missing.
  const contentHeight = useMemo(() => commits.reduce((sum, commit) => sum + (measured[commit.sha] || height), 0), [commits, measured, height])
  const edgeSpace = scrollLink ? Math.max(contentHeight > viewport.height ? (viewport.height - height) / 2 : 0, Math.min(alignmentSpace, viewport.height)) : 0
  const offsets = useMemo(() => {
    const result = [edgeSpace]
    for (const commit of commits) result.push(result[result.length - 1] + (measured[commit.sha] || height))
    return result
  }, [commits, measured, height, edgeSpace])
  const total = offsets[commits.length]
  const updateViewport = useCallback(() => {
    const element = scroller.current
    if (!element?.clientWidth || !element.clientHeight) return
    const { clientWidth: width, clientHeight: height, scrollTop: top } = element
    setViewport(previous => previous.width === width && previous.height === height && previous.top === top ? previous : { width, height, top })
  }, [])
  const windowStep = 8
  const start = Math.max(0, Math.floor(rowAt(offsets, viewport.top) / windowStep) * windowStep - windowStep)
  const end = Math.min(commits.length, (Math.ceil((rowAt(offsets, viewport.top + viewport.height) + 1) / windowStep) + 1) * windowStep)
  useLayoutEffect(() => {
    const element = scroller.current, previous = anchor.current
    const index = previous && positions.get(previous.sha)
    if (element?.clientHeight && previous && index != null) {
      element.scrollTop = offsets[index] + previous.offset
      restoredTop.current = element.scrollTop
    }
    updateViewport()
  }, [offsets, positions, updateViewport])
  useLayoutEffect(() => {
    const saved = pending.current, element = scroller.current
    if (!saved || !element?.clientHeight || !viewport.width || !commits.length) return
    pending.current = undefined
    if (focusSha) return
    const index = positions.get(saved.sha) ?? Math.max(0, Math.min(saved.index - startIndex, commits.length - 1))
    const offset = Math.min(saved.offset, offsets[index + 1] - offsets[index] - 1)
    anchor.current = { sha: commits[index].sha, offset }
    element.scrollTop = offsets[index] + offset
    restoredTop.current = element.scrollTop
    if (horizontal.current) horizontal.current.scrollLeft = saved.left
    updateViewport()
  }, [commits, focusSha, initialPosition, offsets, positions, startIndex, updateViewport, viewport.width])
  const linkedView = useRef<LinkedViewport | null>(null)
  const paging = useRef({ onStartReached, onEndReached })
  useLayoutEffect(() => { paging.current = { onStartReached, onEndReached } }, [onStartReached, onEndReached])
  const alignToPeer = useCallback((view: LinkedViewport) => {
    linkedView.current = view
    const element = scroller.current
    if (!element?.clientHeight || !commits.length) return
    for (const row of view.rows) {
      const index = positions.get(row.sha)
      if (index === undefined) continue
      const target = (offsets[index] + offsets[index + 1]) / 2 - row.center
      const missingSpace = Math.max(-target, target - (element.scrollHeight - element.clientHeight))
      if (missingSpace > 1 && edgeSpace < element.clientHeight) {
        setAlignmentSpace(Math.min(element.clientHeight, Math.ceil(edgeSpace + missingSpace)))
        return
      }
      element.scrollTop = target
      restoredTop.current = element.scrollTop
      const first = rowAt(offsets, element.scrollTop)
      anchor.current = { sha: commits[first].sha, offset: element.scrollTop - offsets[first] }
      updateViewport()
      return
    }
    // A fast scroll can cross the other graph's loaded boundary in a single frame.
    const oldest = view.positions.get(commits[commits.length - 1].sha)
    const newest = view.positions.get(commits[0].sha)
    if (oldest !== undefined && oldest < view.first) paging.current.onEndReached?.()
    else if (newest !== undefined && newest > view.last) paging.current.onStartReached?.()
  }, [commits, offsets, positions, updateViewport, edgeSpace])
  useImperativeHandle(scrollLink?.self, () => alignToPeer, [alignToPeer])
  useLayoutEffect(() => {
    if (linkedView.current) alignToPeer(linkedView.current)
  }, [alignToPeer])
  function rememberPosition() {
    const element = scroller.current
    if (!onPosition || pending.current || !element?.clientHeight || !commits.length) return
    const index = rowAt(offsets, element.scrollTop)
    onPosition({ sha: commits[index].sha, index: startIndex + index, offset: Math.round(element.scrollTop - offsets[index]), left: Math.round(horizontal.current?.scrollLeft || 0) })
  }
  const measureRows = useCallback((elements: Iterable<HTMLElement>) => {
    const changes: Record<string, number> = {}
    for (const row of elements) {
      const size = row.getBoundingClientRect().height, sha = row.dataset.sha!
      if (size > 0 && size !== (measured[sha] || height)) changes[sha] = size
    }
    if (!Object.keys(changes).length) return false
    setMeasured(previous => ({ ...previous, ...changes }))
    return true
  }, [measured, height])
  const revealed = useRef('')
  useLayoutEffect(() => {
    const key = `${focusSha || ''}/${focusKey || ''}`
    if (!focusSha) { revealed.current = ''; return }
    const element = scroller.current, index = positions.get(focusSha)
    if (revealed.current === key || (scrollLink && !viewport.height) || !element?.clientHeight || index === undefined) return
    const row = element.querySelector<HTMLElement>(`.bl-graph-row[data-index="${index}"]`)
    if (row) {
      // A jump can mount wrapped rows whose measured heights differ from the estimates.
      if (measureRows(element.querySelectorAll<HTMLElement>('.bl-graph-row'))) return
      const bounds = row.getBoundingClientRect()
      element.scrollTop += bounds.top - element.getBoundingClientRect().top + (bounds.height - element.clientHeight) / 2
      revealed.current = key
    } else {
      element.scrollTop = (offsets[index] + offsets[index + 1] - element.clientHeight) / 2
    }
    if (scrollLink) {
      linkedView.current = null
      restoredTop.current = element.scrollTop
    }
    anchor.current = null
    updateViewport()
  }, [focusSha, focusKey, offsets, positions, start, end, measureRows, updateViewport, viewport.height, scrollLink])
  const [preferredWidth, setPreferredWidth] = useState<number | null>(null)
  const hasCommits = commits.length > 0
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const pan = (event: WheelEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.bl-graph-cell') || !horizontal.current) return
      const delta = event.shiftKey ? event.deltaY || event.deltaX : event.deltaX
      if (!delta) return
      const before = horizontal.current.scrollLeft
      horizontal.current.scrollLeft += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1)
      if (horizontal.current.scrollLeft !== before) event.preventDefault()
    }
    const observer = new ResizeObserver(updateViewport)
    observer.observe(element)
    element.addEventListener('wheel', pan, { passive: false })
    return () => { observer.disconnect(); element.removeEventListener('wheel', pan) }
  }, [hasCommits, updateViewport])
  useEffect(() => {
    const element = scroller.current
    if (!onStartReached || pending.current || !viewport.width || !element?.clientHeight || element.scrollTop >= height * 10) return
    const index = rowAt(offsets, element.scrollTop)
    anchor.current = { sha: commits[index].sha, offset: element.scrollTop - offsets[index] }
    onStartReached()
  }, [onStartReached, viewport.width, viewport.top, height, commits, offsets])
  useEffect(() => {
    if (!onEndReached || !scroller.current || !sentinel.current) return
    // Larger history pages need a longer runway during fast trackpad scrolling.
    const ahead = commits.length >= 2000 ? height * 200 : Math.max(1440, Math.min(3200, scroller.current.clientHeight * 4))
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) onEndReached() }, { root: scroller.current, rootMargin: `0px 0px ${ahead}px 0px` })
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [onEndReached, commits.length, height])
  const tagsBySha = useMemo(() => {
    const bySha = new Map<string, string[]>()
    for (const tag of tags) bySha.set(tag.sha, [...(bySha.get(tag.sha) || []), tag.name])
    return bySha
  }, [tags])
  const refsBySha = useMemo(() => {
    const bySha = new Map<string, typeof refs>()
    for (const ref of refs) {
      const entries = bySha.get(ref.sha)
      if (entries) entries.push(ref)
      else bySha.set(ref.sha, [ref])
    }
    return bySha
  }, [refs])
  const branchesFor = useMemo(() => graphBranches(commits, refs), [commits, refs])
  const rows = useMemo(() => layoutGraph(commits, continuous), [commits, continuous])
  const width = useMemo(() => rows.reduce((max, row) => Math.max(max, row.width), 2) * 24 + 16, [rows])
  const marks = useCallback((row: ReturnType<typeof layoutGraph>[number], commit: GraphCommit, height: number) => {
    const middle = height / 2
    return <>
      {row.incoming.map((sha, lane) => sha && <path key={sha} style={{ stroke: laneColor(lane) }} d={`M${x(lane)} 0 V${middle}`} />)}
      {row.through.map(edge => <path key={edge.parent} style={{ stroke: laneColor(edge.to) }} d={`M${x(edge.from)} ${middle} V${height}`} />)}
      {row.edges.map(edge => <path key={edge.parent} data-parent={edge.parent} style={{ stroke: laneColor(edge.to) }} d={edge.from === edge.to ? `M${x(edge.from)} ${middle} V${height}` : `M${x(edge.from)} ${middle} C${x(edge.from)} ${middle + height / 4} ${x(edge.to)} ${middle + height / 4} ${x(edge.to)} ${height}`} />)}
      {!continuous && !!row.outside.length && <path className="bl-graph-boundary" style={{ stroke: laneColor(row.lane) }} d={`M${x(row.lane)} ${middle} v${middle - 4}`} />}
      <g style={{ '--lane-color': laneColor(row.lane) } as CSSProperties}>
        {selected === commit.sha && <circle className="bl-graph-node-halo" cx={x(row.lane)} cy={middle} r={11} />}
        {head === commit.sha && <circle className="bl-graph-head-ring" cx={x(row.lane)} cy={middle} r={9} />}
        <circle className="bl-graph-node" data-node="true" cx={x(row.lane)} cy={middle} r={commit.parents.length > 1 ? 6 : 4.5} data-merge={commit.parents.length > 1} data-head={head === commit.sha} />
        {commit.parents.length > 1 && <circle className="bl-graph-merge-core" cx={x(row.lane)} cy={middle} r={2} />}
      </g>
    </>
  }, [continuous, selected, head])
  const refWidth = viewport.width >= 500 ? 140 : 0
  const maxColumn = Math.max(48, viewport.width - refWidth - 12 - 100)
  const column = Math.round(Math.max(48, Math.min(maxColumn, preferredWidth ?? Math.min(width, (viewport.width - refWidth) * .45))))
  useEffect(() => { if (scroller.current && horizontal.current) scroller.current.style.setProperty('--graph-pan', `${-horizontal.current.scrollLeft}px`) }, [column, width])
  useLayoutEffect(() => {
    const element = scroller.current
    if (!element) return
    const rows = element.querySelectorAll<HTMLElement>('.bl-graph-row')
    // The inspector and row menu can wrap labels. Size the lanes before painting the new layout.
    measureRows(rows)
    const observer = new ResizeObserver(entries => measureRows(entries.map(entry => entry.target as HTMLElement)))
    for (const row of rows) observer.observe(row)
    return () => observer.disconnect()
  }, [commits, start, end, viewport.width, column, selected, measureRows])
  const renderedRows = useMemo(() => commits.slice(start, end).map((commit, index) => {
    const row = rows[start + index], rowHeight = measured[commit.sha] || height, labels = refsBySha.get(commit.sha) || [], tagNames = tagsBySha.get(commit.sha) || []
    const badges = <>{head === commit.sha && <Badge>HEAD</Badge>}{labels[0] && (renderRef ? renderRef(labels[0], <span className="bl-graph-ref-name" title={labels[0].name}><Badge variant="branch">{labels[0].name}</Badge></span>) : <span className="bl-graph-ref-name" title={labels[0].name}><Badge variant="branch">{labels[0].name}</Badge></span>)}{labels.length > 1 && <Tooltip focusOwner=".bl-graph-row" content={() => <><strong>연결된 브랜치 {labels.length}개</strong><ul>{labels.map((ref, index) => <li key={ref.ref || `${ref.name}/${index}`}><small>{ref.ref?.startsWith('refs/heads/') ? 'LOCAL' : ref.ref?.startsWith('refs/remotes/') ? 'REMOTE' : '참조'}</small><code>{ref.name}</code></li>)}</ul></>}><span className="bl-graph-ref-overflow" title="" aria-label={`브랜치 ${labels.length - 1}개 더`}><Badge>+{labels.length - 1} 브랜치</Badge></span></Tooltip>}{tagNames[0] && <span className="bl-graph-tag" title={`태그 ${tagNames.join(', ')}`}><Badge>{tagNames.length > 1 ? `${tagNames[0]} +${tagNames.length - 1}` : tagNames[0]}</Badge></span>}<span className="sr-only">{labels.slice(1).map(ref => ref.name).join(', ')}</span></>
    const button = <Button variant="ghost" key={commit.sha} className="bl-graph-row" data-index={start + index} data-sha={commit.sha} style={{ '--lane-color': laneColor(row.lane) } as CSSProperties} aria-pressed={selected === commit.sha} aria-current={head === commit.sha || undefined} onClick={() => onSelect(selected === commit.sha ? null : commit.sha)} title={commit.message}>
      <span className="bl-graph-refs" title={labels.map(ref => ref.name).join('\n')}>{badges}</span>
      <span className="bl-graph-cell"><svg width={width} height={rowHeight} viewBox={`0 0 ${width} ${rowHeight}`} aria-hidden="true" className="bl-graph-lanes" data-sha={commit.sha}>
        {marks(row, commit, rowHeight)}
      </svg><Tooltip focusOwner={labels.length < 2 ? '.bl-graph-row' : undefined} content={() => {
        const containing = branchesFor(commit.sha)
        return <><strong>포함 브랜치 · {containing.length}개 확인</strong>{containing.length ? <ul>{containing.map(ref => <li key={ref.ref || ref.name}><small>{ref.ref?.startsWith('refs/remotes/') ? 'REMOTE' : ref.ref?.startsWith('refs/heads/') ? 'LOCAL' : '브랜치'}{ref.sha === commit.sha ? ' · TIP' : ''}</small><code>{ref.name}</code></li>)}</ul> : <p>이 커밋과 연결된 브랜치 이름을 확인할 수 없습니다.</p>}<small>불러온 이력 기준 · 최초 작업 브랜치를 뜻하지 않습니다.</small></>
      }}><span className="bl-graph-node-trigger" title="" style={{ left: x(row.lane) - 12, top: rowHeight / 2 - 12 }} /></Tooltip></span>
      <span className="bl-graph-content"><span className="bl-graph-title">{commit.message}</span><span className="bl-graph-meta">{selected === commit.sha && selectedBadge}<code>{commit.sha.slice(0, 8)}</code><span>{commit.author}</span><span className="bl-graph-inline-refs" data-has-refs={labels.length > 0 || head === commit.sha} title={labels.map(ref => ref.name).join('\n')}>{badges}</span><time dateTime={commit.date} title={commit.date}>{formatCommitDate(commit.date)}</time></span></span>
      <span className="sr-only">부모 {commit.parents.length}개: {commit.parents.join(', ') || '없음'}{row.outside.length ? ` · 표시 범위 밖 부모 ${row.outside.length}개` : ''}</span>
    </Button>
    return renderRow ? <Fragment key={commit.sha}>{renderRow(commit, button)}</Fragment> : button
  }), [commits, start, end, rows, refsBySha, tagsBySha, branchesFor, head, selected, onSelect, width, height, measured, marks, renderRef, renderRow, selectedBadge])
  const miniature = useMemo(() => {
    if (!overview || !total) return null
    const paths: string[][] = []
    const stroke = (lane: number, segment: string) => (paths[lane % 6] ??= []).push(segment)
    // Subpixel commits share a band in the overview. The main graph retains every edge.
    const stride = Math.max(1, Math.ceil(commits.length / Math.max(1, viewport.height)))
    for (let i = 0; i < commits.length; i += stride) {
      const row = rows[i], top = offsets[i], bottom = offsets[Math.min(i + stride, commits.length)], mid = (top + bottom) / 2
      row.incoming.forEach((sha, lane) => { if (sha) stroke(lane, `M${x(lane)} ${top}V${mid}`) })
      for (const edge of [...row.edges, ...row.through]) stroke(edge.to, `M${x(edge.from)} ${mid}L${x(edge.to)} ${bottom}`)
      if (!continuous && row.outside.length) stroke(row.lane, `M${x(row.lane)} ${mid}V${bottom}`)
    }
    return paths.map((segments, lane) => <path key={lane} style={{ stroke: laneColor(lane) }} d={segments.join('')} />)
  }, [overview, total, commits.length, viewport.height, rows, offsets, continuous])
  const selectedIndex = selected ? positions.get(selected) : undefined
  if (!commits.length) return <EmptyState title="일치하는 커밋이 없습니다">조회 브랜치나 필터를 확인하세요. 첫 커밋 전에는 그래프가 비어 있습니다.</EmptyState>
  return <div className={`bl-graph-explorer ${overview ? 'bl-graph-explorer-overview' : ''}`}>
    {overview && <div className="bl-graph-map"><small>누적<br />{commits.length}개</small><ScrollOverview label="누적 그래프로 이력 이동" value={viewport.top / Math.max(1, total - viewport.height)} viewport={viewport.height / Math.max(1, total)} onChange={value => { if (scroller.current) scroller.current.scrollTop = value * (scroller.current.scrollHeight - scroller.current.clientHeight) }}><svg className="bl-graph-lanes" viewBox={`0 0 ${width} ${offsets[commits.length]}`} preserveAspectRatio="none">
      {selectedIndex !== undefined && <rect y={offsets[selectedIndex]} width={width} height={offsets[selectedIndex + 1] - offsets[selectedIndex]} className="bl-graph-map-selected" />}
      {miniature}
    </svg></ScrollOverview></div>}
    <div className="bl-graph-table" data-ref-column={refWidth > 0} style={{ '--graph-column': `${column}px`, '--graph-ref-width': `${refWidth}px`, '--graph-width': `${width}px`, '--graph-row-height': `${height}px` } as CSSProperties}>
    <ResizeHandle label="그래프 컬럼 너비" value={column} min={48} max={maxColumn} onChange={setPreferredWidth} style={{ left: refWidth + column }} />
    <div ref={scroller} className="bl-commit-graph" data-start-index={startIndex} data-commit-count={commits.length} data-first-sha={commits[0].sha} data-has-head={!!head && positions.has(head)} onScroll={event => {
      const element = event.currentTarget
      if (!element.clientHeight) return
      const top = element.scrollTop, restored = restoredTop.current
      // Layout can shrink between a restoration and its scroll event, clamping the position.
      if (restored === null || Math.abs(top - Math.min(restored, element.scrollHeight - element.clientHeight)) >= 1) {
        const index = rowAt(offsets, top)
        anchor.current = top > 0 || startIndex > 0 ? { sha: commits[index].sha, offset: top - offsets[index] } : null
        restoredTop.current = null
        if (scrollLink?.peer.current) {
          linkedView.current = null
          const rows: VisibleRow[] = []
          for (let i = index; i < commits.length && offsets[i] < top + element.clientHeight; i++) {
            rows.push({ sha: commits[i].sha, center: (offsets[i] + offsets[i + 1]) / 2 - top })
          }
          const middle = element.clientHeight / 2
          rows.sort((a, b) => Math.abs(a.center - middle) - Math.abs(b.center - middle))
          scrollLink.peer.current({ rows, positions, first: index, last: index + rows.length - 1 })
        }
      }
      rememberPosition()
      updateViewport()
    }} aria-label={label || "커밋 그래프"} tabIndex={0} onKeyDown={event => {
      if (event.target instanceof Element && event.target.closest('[role=menu]')) return
      if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === 'Escape') { event.preventDefault(); onSelect(null); return }
      if (!['ArrowUp', 'ArrowDown'].includes(event.key) || !(event.target instanceof Element)) return
      const row = event.target.closest('.bl-graph-row')
      if (!row) return
      const index = Math.max(0, Math.min(commits.length - 1, Number((row as HTMLElement).dataset.index) + (event.key === 'ArrowDown' ? 1 : -1)))
      const target = event.currentTarget.querySelector<HTMLButtonElement>(`[data-index="${index}"]`)
      if (target) { event.preventDefault(); target.focus(); onSelect(commits[index].sha) }
    }}>
      <div aria-hidden="true" style={{ height: offsets[start] }} />
      {renderedRows}
      <div aria-hidden="true" style={{ height: total - offsets[end] + edgeSpace }} />
      <div ref={sentinel} className="bl-graph-sentinel" aria-hidden="true" />
    </div>
    <div className="bl-graph-scrollbar-row" style={{ width: viewport.width || '100%' }}><div ref={horizontal} className="bl-graph-xscroll" tabIndex={0} role="region" aria-label={label ? `${label} 좌우 스크롤` : "그래프 좌우 스크롤"} onScroll={event => { scroller.current?.style.setProperty('--graph-pan', `${-event.currentTarget.scrollLeft}px`); rememberPosition() }}><div style={{ width, height: 1 }} /></div></div>
    </div>
  </div>
}
