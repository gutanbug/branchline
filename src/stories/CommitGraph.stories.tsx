import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { CommitGraph } from '../design-system'
import { graphBranches, layoutGraph } from '../design-system/graph-layout'
const commits = [
  { sha: 'merge', parents: ['left', 'right'], message: '두 브랜치 병합', author: '개발자', date: '2026-09-14T01:00:00Z' },
  { sha: 'left', parents: ['root'], message: '왼쪽 브랜치 변경', author: '민수', date: '2026-09-13T01:00:00Z' },
  { sha: 'right', parents: ['root'], message: '오른쪽 브랜치 변경', author: '지수', date: '2026-09-12T01:00:00Z' },
  { sha: 'root', parents: [], message: '첫 커밋', author: '개발자', date: '2026-09-11T01:00:00Z' },
]
const meta = { title: 'Patterns/CommitGraph', component: CommitGraph, args: { commits, selected: null, onSelect: fn(), refs: [{ name: 'main', sha: 'merge' }, { name: 'origin/main', sha: 'merge' }, { name: 'feature/한글', sha: 'right' }], head: 'merge' } } satisfies Meta<typeof CommitGraph>
export default meta
type Story = StoryObj<typeof meta>
export const Merge: Story = { play: async ({ canvasElement, args }) => {
  const rows = layoutGraph(commits)
  await expect(rows[0].edges.map(edge => edge.parent)).toEqual(['left', 'right'])
  await expect(rows[1].through[0].parent).toBe('right')
  await expect(rows[2].edges[0].to).toBe(rows[3].lane)
  await expect(rows.every(row => row.outside.length === 0)).toBe(true)
  await userEvent.click(within(canvasElement).getByRole('button', { name: /두 브랜치 병합/ }))
  await expect(args.onSelect).toHaveBeenCalledWith('merge')
} }
export const Filtered: Story = { args: { commits: [commits[0], commits[3]] }, play: async () => {
  const rows = layoutGraph([commits[0], commits[3]])
  await expect(rows[0].edges).toEqual([])
  await expect(rows[0].outside).toEqual(['left', 'right'])
  await expect(rows[1].incoming.filter(Boolean)).toEqual([])
} }
export const OctopusAndOrphan: Story = { args: { commits: [{ ...commits[0], parents: ['left', 'right', 'third'] }, commits[1], commits[2], { ...commits[1], sha: 'third' }, commits[3], { ...commits[3], sha: 'orphan', message: '별도 루트' }] }, play: async ({ args }) => {
  const rows = layoutGraph(args.commits)
  await expect(rows[0].edges.length).toBe(3)
  await expect(rows[3].edges[0].to).toBe(rows[4].lane)
  await expect(rows[5].incoming.filter(Boolean)).toEqual([])
} }
export const Keyboard: Story = { play: async ({ canvasElement, args }) => {
  within(canvasElement).getByRole('button', { name: /왼쪽 브랜치 변경/ }).focus()
  await userEvent.keyboard('{Enter}')
  await expect(args.onSelect).toHaveBeenCalledWith('left')
} }
export const Empty: Story = { args: { commits: [] } }

export const Compact: Story = { args: { density: 'compact' } }

export const Overview: Story = { decorators: [Story => <div style={{ height: 360, width: 360 }}><Story /></div>], args: { overview: true, density: 'compact', commits: [...commits, ...Array.from({ length: 96 }, (_, i) => ({ sha: `older-${i}`, parents: i < 95 ? [`older-${i + 1}`] : [], message: `이전 변경 기록 ${i}`, author: '개발자', date: commits[3].date }))] } }

export const RevealCommit: Story = {
  ...Overview,
  args: { ...Overview.args, focusSha: 'older-80', selected: 'older-80', focusKey: 1 },
  play: async ({ canvasElement }) => {
    const scroller = canvasElement.querySelector<HTMLElement>('.bl-commit-graph')!
    const row = scroller.querySelector('.bl-graph-row[aria-pressed=true]')!.getBoundingClientRect()
    const bounds = scroller.getBoundingClientRect()
    await expect(scroller.scrollTop).toBeGreaterThan(0)
    await expect(row.top).toBeGreaterThanOrEqual(bounds.top)
    await expect(row.bottom).toBeLessThanOrEqual(bounds.bottom)
  },
}

export const Continuous: Story = { args: { continuous: true, overview: true }, play: async () => {
  const first = layoutGraph(commits.slice(0, 2), true), appended = layoutGraph(commits, true)
  for (let index = 0; index < first.length; index++) {
    await expect(appended[index].lane).toBe(first[index].lane)
    await expect(appended[index].edges).toEqual(first[index].edges)
    await expect(appended[index].incoming).toEqual(first[index].incoming)
  }
  await expect(first[0].edges.map(edge => edge.parent)).toContain('right')
  await expect(appended[2].incoming[appended[2].lane]).toBe('right')
} }

const parallel = Array.from({ length: 16 }, (_, index) => ({ ...commits[1], sha: `branch-${index}`, parents: ['root'], message: `기능 브랜치 ${index + 1} 작업` }))
export const ManyLanes: Story = {
  decorators: [Story => <div style={{ height: 480, width: 720 }}><Story /></div>],
  args: { overview: true, continuous: true, density: 'compact', commits: [{ ...commits[0], parents: parallel.map(commit => commit.sha) }, ...parallel, commits[3]], refs: parallel.map((commit, index) => ({ name: `origin/feature/작업-${index + 1}`, sha: commit.sha })), selected: 'branch-5' },
  play: async ({ canvasElement }) => {
    const scroller = canvasElement.querySelector<HTMLElement>('.bl-commit-graph')!
    const svg = scroller.querySelector<SVGSVGElement>('svg[data-sha]')!
    const node = svg.querySelector<SVGCircleElement>('[data-node]')!.getBoundingClientRect()
    await expect(node.width).toBeCloseTo(node.height, 1)
    await expect(node.width).toBe(12)
    await expect(svg.getBoundingClientRect().width).toBe(Number(svg.getAttribute('width')))
    const horizontal = canvasElement.querySelector<HTMLElement>('.bl-graph-xscroll')!
    await expect(horizontal.scrollWidth).toBeGreaterThan(horizontal.clientWidth)
    await expect(scroller.scrollWidth).toBe(scroller.clientWidth)
    await userEvent.click(within(canvasElement).getByRole('button', { name: /기능 브랜치 6 작업/ }))
  },
}

export const FirstParentLane: Story = { args: { continuous: true, commits: [...commits.slice(0, 3), { ...commits[3], parents: ['tail'] }, { ...commits[3], sha: 'tail' }] }, play: async ({ args }) => {
  const rows = layoutGraph(args.commits, true)
  await expect(rows[3].edges[0].to).toBe(rows[3].lane)
  await expect(rows[4].lane).toBe(rows[3].lane)
} }

export const SelectionControls: Story = { args: { selected: 'left' }, play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement), row = canvas.getByRole('button', { name: /왼쪽 브랜치 변경/ })
  await userEvent.click(row)
  await expect(args.onSelect).toHaveBeenLastCalledWith(null)
  row.focus(); await userEvent.keyboard('{ArrowDown}')
  await expect(args.onSelect).toHaveBeenLastCalledWith('right')
  await expect(canvas.getByRole('button', { name: /오른쪽 브랜치 변경/ })).toHaveFocus()
  if (document.querySelector('[role=tooltip][data-open]')) await userEvent.keyboard('{Escape}')
  await userEvent.keyboard('{Escape}')
  await expect(args.onSelect).toHaveBeenLastCalledWith(null)
} }

export const LongRefBadges: Story = {
  decorators: [Story => <div style={{ height: 360, width: 900 }}><Story /></div>],
  args: { refs: [{ name: 'origin/fix/CMPTEAM-5559_resolveMergeConflict_매우긴브랜치이름', sha: 'merge' }, { name: 'origin/main', sha: 'merge' }, { name: 'main', sha: 'merge' }] },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('button', { name: /두 브랜치 병합/ })
    await expect(row.querySelector('.bl-graph-refs')).toBeVisible()
    const branch = row.querySelector('.bl-graph-refs .branch-tag')!.getBoundingClientRect()
    const count = row.querySelector('.bl-graph-refs .bl-graph-ref-overflow')!.getBoundingClientRect()
    await expect(branch.right).toBeLessThanOrEqual(count.left)
    await expect(branch.height).toBeGreaterThan(30)
    const badge = row.querySelector<HTMLElement>('.bl-graph-refs .branch-tag')!
    await expect(badge.scrollHeight).toBe(badge.clientHeight)
    await expect(badge.scrollWidth).toBe(badge.clientWidth)
    await waitFor(() => expect(row.querySelector('svg')!.getBoundingClientRect().height).toBe(row.getBoundingClientRect().height))
    const node = row.querySelector('[data-node]')!.getBoundingClientRect()
    await expect(node.width).toBeCloseTo(node.height, 1)
    const next = row.nextElementSibling!.getBoundingClientRect()
    await expect(row.getBoundingClientRect().bottom).toBe(next.top)
  },
}

export const LongRefNarrow: Story = {
  ...LongRefBadges,
  decorators: [Story => <div style={{ height: 360, width: 360 }}><Story /></div>],
  args: { ...LongRefBadges.args, overview: true, density: 'compact', focusSha: 'right', focusKey: 1, selected: 'right' },
  play: async ({ canvasElement }) => {
    const scroller = canvasElement.querySelector<HTMLElement>('.bl-commit-graph')!
    const badge = scroller.querySelector<HTMLElement>('.bl-graph-inline-refs .branch-tag')!
    await expect(badge).toBeVisible()
    await expect(badge.scrollHeight).toBe(badge.clientHeight)
    await expect(badge.scrollWidth).toBe(badge.clientWidth)
    await expect(scroller.scrollWidth).toBe(scroller.clientWidth)
    const row = badge.closest('.bl-graph-row')!
    await waitFor(() => expect(row.querySelector('svg')!.getBoundingClientRect().height).toBe(row.getBoundingClientRect().height))
    const selected = scroller.querySelector<HTMLElement>('[aria-pressed=true]')!
    selected.focus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(within(canvasElement).getByRole('button', { name: /첫 커밋/ })).toHaveFocus()
  },
}

export const NodeBranches: Story = {
  args: { refs: [{ name: 'main', ref: 'refs/heads/main', sha: 'merge' }, { name: 'origin/feature/한글', ref: 'refs/remotes/origin/feature/한글', sha: 'right' }] },
  play: async ({ canvasElement, args }) => {
    const body = within(document.body), row = within(canvasElement).getByRole('button', { name: /왼쪽 브랜치 변경/ })
    await userEvent.hover(row.querySelector('.bl-graph-node-trigger')!)
    await expect(await body.findByRole('tooltip')).toHaveTextContent('main')
    await expect(body.getByRole('tooltip')).not.toHaveTextContent('origin/feature/한글')
    await expect(args.onSelect).not.toHaveBeenCalled()
    await userEvent.click(row.querySelector('.bl-graph-node-trigger')!)
    await expect(args.onSelect).toHaveBeenCalledWith('left')
    await userEvent.unhover(row.querySelector('.bl-graph-node-trigger')!)
    const membership = graphBranches(args.commits, args.refs!)
    await expect([...membership.get('root')!].map(ref => ref.name)).toEqual(['main', 'origin/feature/한글'])
    await expect([...graphBranches([commits[0], commits[3]], args.refs!).get('root')!]).toEqual([])
  },
}
export const UnknownNodeBranch: Story = {
  args: { refs: [], head: null },
  play: async ({ canvasElement }) => {
    await userEvent.hover(canvasElement.querySelector('.bl-graph-node-trigger')!)
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent('브랜치 이름을 확인할 수 없습니다')
  },
}
