import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { Button, CommitGraph, EmptyState, Notice } from '../../design-system'
import type { Commit, DesktopAPI, Repository, Tab } from '../../app/types'

export function HistoryGraph({ api, repo, tab, selected, onSelect, paused, focusSha, focusKey, renderRef, stash = false, overview = true, label }: { label?: string; renderRef?: (ref: { name: string; sha: string; ref?: string }, badge: ReactElement) => ReactNode; stash?: boolean; overview?: boolean; focusSha?: string; focusKey?: number; api: Pick<DesktopAPI, 'history'>; repo: Pick<Repository, 'path' | 'refs' | 'head' | 'shallow' | 'branch'>; tab: Pick<Tab, 'ref' | 'query' | 'author' | 'file' | 'after' | 'before'>; selected: string | null; onSelect: (sha: string | null) => void; paused: boolean }) {
  const [feed, setFeed] = useState({ commits: [] as Commit[], hasMore: true, loading: true, error: '' })
  const next = useRef<() => void>(() => {}), loadedCount = useRef(100)
  const filters = JSON.stringify({ ref: tab.ref, query: tab.query, author: tab.author, file: tab.file, after: tab.after, before: tab.before })
  const source = JSON.stringify([repo.shallow, focusSha, tab.ref ? repo.refs.find(ref => ref.ref === tab.ref)?.sha : [repo.head, repo.refs.map(ref => `${ref.ref}:${ref.sha}`).sort()]])
  useEffect(() => {
    if (paused) return
    let live = true, busy = false, hasMore = true, offset = 0
    // ponytail: retain loaded commits in memory; virtualize rows if large-history rendering becomes slow.
    let commits: Commit[] = [], revisions: string[] | undefined
    async function load() {
      if (!live || busy || !hasMore) return
      busy = true
      setFeed(current => ({ ...current, loading: true, error: '' }))
      try {
        const input = JSON.parse(filters)
        if (input.after && input.before && input.after > input.before) throw new Error('시작일은 종료일보다 늦을 수 없습니다. 날짜 범위를 수정하세요.')
        if (input.after) input.after = new Date(`${input.after}T00:00:00`).toISOString()
        if (input.before) { const end = new Date(`${input.before}T00:00:00`); end.setDate(end.getDate() + 1); input.before = new Date(end.getTime() - 1000).toISOString() }
        // Refresh the loaded range atomically, with one fixed set of revision SHAs.
        const target = offset ? offset + 100 : loadedCount.current
        let batch = [...commits], cursor = offset, roots = revisions
        let more: boolean = hasMore
        const seen = new Set(batch.map(commit => commit.sha))
        do {
          const result = await api.history(repo.path, { ...input, offset: cursor, revisions: roots, stashSha: stash ? focusSha : undefined })
          if (!live) return
          if (result.hasMore && !result.commits.length) throw new Error('이력을 더 불러오지 못했습니다. 다시 시도하세요.')
          roots = result.revisions
          cursor += result.commits.length
          batch = [...batch, ...result.commits.filter(commit => { if (seen.has(commit.sha)) return false; seen.add(commit.sha); return true })]
          more = result.hasMore
        } while (more && (cursor < target || !!focusSha && !seen.has(focusSha)))
        commits = batch; offset = cursor; revisions = roots; hasMore = more
        loadedCount.current = Math.max(100, commits.length)
        setFeed({ commits, hasMore, loading: false, error: '' })
      } catch (error) {
        if (live) setFeed(current => ({ ...current, loading: false, error: (error as Error).message }))
      } finally { busy = false }
    }
    next.current = () => { void load() }
    const timer = setTimeout(next.current, 300)
    return () => { live = false; clearTimeout(timer); next.current = () => {} }
  }, [api, repo.path, filters, source, paused, focusSha, stash])
  const filtered = !!(tab.query || tab.author || tab.file || tab.after || tab.before)
  return <>
    {feed.commits.length ? <CommitGraph label={label} renderRef={renderRef} focusSha={focusSha} focusKey={focusKey} overview={overview} continuous={!filtered} density="compact" commits={feed.commits} refs={[...repo.refs, ...(stash && focusSha ? [{ ref: 'refs/stash/selected', name: 'Stash', sha: focusSha }] : [])].sort((a, b) => Number(b.ref === `refs/heads/${repo.branch}`) - Number(a.ref === `refs/heads/${repo.branch}`))} head={repo.head} selected={selected} onSelect={onSelect} onEndReached={!paused && !feed.loading && !feed.error && feed.hasMore ? () => next.current() : undefined} /> : feed.loading ? <Notice>실제 Git 이력을 조회하고 있습니다…</Notice> : !feed.error && <EmptyState title="일치하는 커밋이 없습니다">첫 커밋 전이거나 조회 조건에 맞는 이력이 없습니다.</EmptyState>}
    {(feed.error || feed.loading && feed.commits.length > 0 || !feed.hasMore && repo.shallow) && <div className="bl-history-progress">
      {feed.error ? <><Notice tone="error">{feed.error}</Notice><Button aria-label="이력 다시 시도" disabled={feed.loading || paused} onClick={() => next.current()}>다시 시도</Button></> : <Notice compact>{feed.loading ? '이력 갱신 중…' : '로컬 shallow 이력의 끝'}</Notice>}
    </div>}
  </>
}
