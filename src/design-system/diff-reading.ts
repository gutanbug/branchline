import type { DiffFile } from './diff-model'

export type DiffLocation = { side: 'old' | 'next'; line: number }
export type DiffReading = {
  filename?: string; value: string; mode: 'unified' | 'split' | 'raw'; wrap: boolean
  top: number; left: number; file?: DiffFile; anchor?: DiffLocation
}

export function firstVisibleLine(viewport: HTMLElement): DiffLocation | undefined {
  const rows = viewport.querySelector('table')?.rows
  if (!rows?.length) return
  const top = viewport.getBoundingClientRect().top + (rows[0]?.offsetHeight || 0)
  let start = 1, end = rows.length
  while (start < end) {
    const mid = Math.floor((start + end) / 2)
    if (rows[mid].getBoundingClientRect().bottom <= top) start = mid + 1
    else end = mid
  }
  for (let i = start; i < Math.min(rows.length, start + 2); i++) {
    const cell = rows[i].querySelector<HTMLElement>('[data-next]') || rows[i].querySelector<HTMLElement>('[data-old]')
    if (cell) return cell.dataset.next ? { side: 'next', line: Number(cell.dataset.next) } : { side: 'old', line: Number(cell.dataset.old) }
  }
}

// A line number can be reused after a push. Match a unique unchanged excerpt on the same side.
export function relocateLine(previous: DiffReading, current: DiffFile): DiffLocation | undefined {
  const { anchor, file } = previous
  if (!anchor || !file || current.unsupported) return
  const { side } = anchor
  const linesByHunk = (diff: DiffFile) => diff.hunks.map(hunk => hunk.lines.filter(line => line[side] !== undefined))
  const old = linesByHunk(file)
  const hunk = old.find(lines => lines.some(line => line[side] === anchor.line))
  if (!hunk) return
  const i = hunk.findIndex(line => line[side] === anchor.line), start = Math.max(0, i - 1)
  const context = hunk.slice(start, i + 2), offset = i - start
  if (!context.some(line => line.text.trim())) return
  function unique(hunks: typeof old) {
    let match: number | undefined
    for (const lines of hunks) for (let j = 0; j <= lines.length - context.length; j++) {
      if (context.every((line, k) => line.text === lines[j + k].text && line.kind === lines[j + k].kind)) {
        if (match !== undefined) return
        match = lines[j + offset][side]
      }
    }
    return match
  }
  const line = unique(old) === anchor.line ? unique(linesByHunk(current)) : undefined
  return line !== undefined ? { side, line } : undefined
}
