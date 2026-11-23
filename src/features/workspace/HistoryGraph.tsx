import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactElement, type ReactNode } from 'react'
import { Button, CommitGraph, type GraphPosition, type GraphScrollLink, EmptyState, Notice } from '../../design-system'
import type { Commit, DesktopAPI, Repository, Tab } from '../../app/types'

export function HistoryGraph({ scrollLink, initialPosition, onPosition, api, repo, tab, selected, onSelect, paused, focusSha, focusKey, renderRef, renderRow, selectedBadge, stash = false, overview = true, label, onStartCommit }: { onStartCommit?: () => void;  scrollLink?: GraphScrollLink; initialPosition?: GraphPosition; onPosition?: (position: GraphPosition) => void; label?: string; renderRef?: (ref: { name: string; sha: string; ref?: string }, badge: ReactElement) => ReactNode; stash?: boolean; overview?: boolean; focusSha?: string; focusKey?: number; api: Pick<DesktopAPI, 'history'>; repo: Pick<Repository, 'path' | 'refs' | 'head' | 'shallow' | 'branch' | 'tags'>; tab: Pick<Tab, 'ref' | 'query' | 'author' | 'file' | 'after' | 'before'>; selected: string | null; onSelect: (sha: string | null) => void; paused: boolean } & Pick<ComponentProps<typeof CommitGraph>, 'renderRow' | 'selectedBadge'>) {
  const [feed, setFeed] = useState({ position: initialPosition, start: 0, commits: [] as Commit[], hasMore: true, loading: true, error: '' })
  const next = useRef<(direction?: 'older' | 'newer') => void>(() => {})
  const range = useRef({ start: 0, count: 100 }), retry = useRef<() => void>(() => {})
  const filters = JSON.stringify({ ref: tab.ref, query: tab.query, author: tab.author, file: tab.file, after: tab.after, before: tab.before })
  const restore = useRef(initialPosition), visible = useRef(initialPosition)
  const lastFilters = useRef('')
  const stashRoot = stash ? focusSha : undefined
  const cache = useRef<{ key: string; commits: Commit[]; start: number; revisions: string[]; hasMore: boolean } | undefined>(undefined)
  const delay = tab.query || tab.author || tab.file ? 300 : 0
  const source = useMemo(() => {
    if (tab.ref === 'HEAD') return JSON.stringify([repo.shallow, repo.head])
    if (tab.ref) return JSON.stringify([repo.shallow, repo.refs.find(ref => ref.ref === tab.ref)?.sha])
    return JSON.stringify([repo.shallow, repo.head, repo.refs.map(ref => `${ref.ref}:${ref.sha}`).sort()])
  }, [repo.head, repo.refs, repo.shallow, tab.ref])
  const graphRefs = useMemo(() => [...repo.refs, ...(stashRoot ? [{ ref: 'refs/stash/selected', name: 'Stash', sha: stashRoot }] : [])].sort((a, b) => Number(b.ref === `refs/heads/${repo.branch}`) - Number(a.ref === `refs/heads/${repo.branch}`)), [repo.refs, repo.branch, stashRoot])
  useEffect(() => {
    if (paused) return
    const filterKey = JSON.stringify([repo.path, filters])
    if (lastFilters.current !== filterKey) range.current = { start: 0, count: 100 }
    if (lastFilters.current === filterKey && (range.current.start || range.current.count > 1000 || (visible.current?.index ?? 0) >= 200)) restore.current = visible.current
    lastFilters.current = filterKey
    const key = JSON.stringify([filterKey, source, stashRoot])
    const cached = cache.current?.key === key ? cache.current : undefined
    let live = true, busy = false, hasMore = cached?.hasMore ?? true, start = cached?.start ?? range.current.start
    let commits = cached?.commits ?? [], revisions = cached?.revisions
    let position = cached ? undefined : restore.current
    async function load(direction: 'initial' | 'older' | 'newer') {
      if (!live || busy) return
      const focus = direction === 'initial' && focusSha || undefined
      if (direction === 'initial' && cached && (!focus || commits.some(commit => commit.sha === focus))) {
        setFeed(current => ({ ...current, loading: false, error: '' }))
        return
      }
      if ((direction === 'newer' && !start) || (direction === 'older' && !hasMore)) return
      retry.current = () => { void load(direction) }
      busy = true
      setFeed(current => ({ ...current, loading: true, error: '' }))
      try {
        const input = JSON.parse(filters)
        if (input.after && input.before && input.after > input.before) throw new Error('시작일은 종료일보다 늦을 수 없습니다. 날짜 범위를 수정하세요.')
        if (input.after) input.after = new Date(`${input.after}T00:00:00`).toISOString()
        if (input.before) { const end = new Date(`${input.before}T00:00:00`); end.setDate(end.getDate() + 1); input.before = new Date(end.getTime() - 1000).toISOString() }
        const read = (offset: number, limit: number, roots = revisions, anchorSha?: string, targetSha?: string) =>
          api.history(repo.path, { ...input, offset, limit, revisions: roots, stashSha: stashRoot, anchorSha, focusSha: targetSha })
        const saved = !commits.length && !focus && restore.current
        if (focus || saved) {
          const result = await read(saved ? Math.max(0, saved.index - 100) : 0, 200, revisions, saved ? saved.sha : undefined, focus)
          if (!live) return
          position = saved || undefined
          start = result.offset; commits = result.commits; revisions = result.revisions; hasMore = result.hasMore
          restore.current = undefined
        } else if (direction === 'newer') {
          const size = Math.min(start, 100)
          const result = await read(start - size, size)
          if (!live) return
          if (result.commits.length !== size) throw new Error('이력을 더 불러오지 못했습니다. 다시 시도하세요.')
          start -= size; commits = [...result.commits, ...commits]
        } else {
          // Refresh the loaded range atomically, with one fixed set of revision SHAs.
          const batch = [...commits]
          let cursor = start + batch.length, roots = revisions, more: boolean
          const target = cursor + (batch.length ? (cursor < 2000 ? 100 : 1000) : range.current.count)
          const seen = new Set(batch.map(commit => commit.sha))
          do {
            const pageSize = target - cursor >= 1000 || cursor >= 2000 ? 1000 : 100
            const limit = Math.min(pageSize, target - cursor)
            const result = await read(cursor, limit, roots)
            if (!live) return
            if (result.hasMore && !result.commits.length) throw new Error('이력을 더 불러오지 못했습니다. 다시 시도하세요.')
            roots = result.revisions
            cursor += result.commits.length
            for (const commit of result.commits) {
              if (!seen.has(commit.sha)) { seen.add(commit.sha); batch.push(commit) }
            }
            more = result.hasMore
          } while (more && cursor < target)
          commits = batch; revisions = roots; hasMore = more
          restore.current = undefined
        }
        range.current = { start, count: Math.max(100, commits.length) }
        if (revisions) cache.current = { key, start, commits, hasMore, revisions }
        setFeed({ position, start, commits, hasMore, loading: false, error: '' })
      } catch (error) {
        if (live) setFeed(current => ({ ...current, loading: false, error: (error as Error).message }))
      } finally { busy = false }
    }
    const timer = setTimeout(() => {
      void load('initial')
      next.current = (direction = 'older') => { void load(direction) }
    }, delay)
    return () => { live = false; clearTimeout(timer); next.current = () => {} }
  }, [api, repo.path, filters, source, paused, stashRoot, focusSha, focusKey, delay])
  const filtered = !!(tab.query || tab.author || tab.file || tab.after || tab.before)
  return <>
    {feed.commits.length ? <CommitGraph scrollLink={scrollLink} startIndex={feed.start} onStartReached={!paused && !feed.loading && !feed.error && feed.start > 0 ? () => next.current('newer') : undefined} initialPosition={feed.position} onPosition={value => { visible.current = value; onPosition?.(value) }} label={label} renderRef={renderRef} renderRow={renderRow} selectedBadge={selectedBadge} focusSha={focusSha} focusKey={focusKey} overview={overview} continuous={!filtered} density="compact" commits={feed.commits} refs={graphRefs} tags={repo.tags} head={repo.head} selected={selected} onSelect={onSelect} onEndReached={!paused && !feed.loading && !feed.error && feed.hasMore ? () => next.current() : undefined} /> : feed.loading ? <Notice>실제 Git 이력을 조회하고 있습니다…</Notice> : !feed.error && (!repo.head ? <EmptyState decorated title="아직 커밋이 없습니다" action={onStartCommit && <Button variant="primary" onClick={onStartCommit}>첫 커밋 만들기</Button>}>파일을 스테이징하고 첫 커밋을 만들면 이력이 그래프로 표시됩니다.</EmptyState> : <EmptyState title="일치하는 커밋이 없습니다">조회 조건에 맞는 이력이 없습니다. 필터나 검색어를 확인하세요.</EmptyState>)}
    {(feed.error || feed.loading && feed.commits.length > 0 || !feed.hasMore && repo.shallow) && <div className={feed.loading && !feed.error ? "sr-only" : "bl-history-progress"}>
      {feed.error ? <><Notice tone="error">{feed.error}</Notice><Button aria-label="이력 다시 시도" disabled={feed.loading || paused} onClick={() => retry.current()}>다시 시도</Button></> : <Notice compact>{feed.loading ? '이력 갱신 중…' : '로컬 shallow 이력의 끝'}</Notice>}
    </div>}
  </>
}
