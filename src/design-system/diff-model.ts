export type DiffLine = { kind: 'context' | 'add' | 'del'; text: string; old?: number; next?: number; noNewline?: boolean }
export type DiffHunk = { header: string; lines: DiffLine[] }
export type DiffFile = { path: string; metadata: string[]; raw: string[]; hunks: DiffHunk[]; added: number; deleted: number; unsupported: boolean }

function pathname(value: string, stripPrefix = true) {
  try { if (value.startsWith('"')) value = JSON.parse(value) } catch { /* Preserve Git's quoted spelling when it is not JSON-compatible. */ }
  return stripPrefix ? value.replace(/^[ab]\//, '') : value
}
export function parseDiff(value: string, filename = '변경 파일') {
  const files: DiffFile[] = [], preamble: string[] = []
  let file: DiffFile | undefined, hunk: DiffHunk | undefined, old = 0, next = 0, oldLeft = 0, nextLeft = 0
  function finishHunk() { if (hunk && (oldLeft || nextLeft)) file!.unsupported = true; hunk = undefined }
  function start(path: string) {
    finishHunk()
    file = { path, metadata: [], raw: [], hunks: [], added: 0, deleted: 0, unsupported: false }; files.push(file)
  }
  const lines = value.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '')
    if (!line && i === lines.length - 1) continue
    if (/^diff --(?:git|cc|combined) /.test(line)) {
      start(line.startsWith('diff --git ') ? pathname(line.slice(11).match(/"(?:\\.|[^"])*"$/)?.[0] || `b/${line.slice(11).split(' b/').at(-1) || filename}`) : pathname(line.replace(/^diff --\w+ /, '')))
      if (!line.startsWith('diff --git ')) file!.unsupported = true
    }
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$/.exec(line)
    if (header) {
      if (!file) start(filename)
      finishHunk(); old = Number(header[1]); next = Number(header[3]); oldLeft = Number(header[2] ?? 1); nextLeft = Number(header[4] ?? 1)
      hunk = { header: line, lines: [] }; file!.hunks.push(hunk); file!.raw.push(line); continue
    }
    if (!file) { preamble.push(line); continue }
    file.raw.push(line)
    if (hunk && line.startsWith('\\ No newline at end of file')) { const last = hunk.lines.at(-1); if (last) last.noNewline = true; continue }
    if (hunk && (oldLeft > 0 || nextLeft > 0)) {
      const mark = line[0]
      if (mark === ' ' && oldLeft > 0 && nextLeft > 0) { hunk.lines.push({ kind: 'context', text: line.slice(1), old: old++, next: next++ }); oldLeft--; nextLeft--; continue }
      if (mark === '-' && oldLeft > 0) { hunk.lines.push({ kind: 'del', text: line.slice(1), old: old++ }); oldLeft--; file.deleted++; continue }
      if (mark === '+' && nextLeft > 0) { hunk.lines.push({ kind: 'add', text: line.slice(1), next: next++ }); nextLeft--; file.added++; continue }
      file.unsupported = true
    }
    if (line.startsWith('@@@') || (hunk && /^[ +-]/.test(line))) file.unsupported = true
    if (!hunk && line.startsWith('+++ ') && line !== '+++ /dev/null') file.path = pathname(line.slice(4))
    if (!hunk && line.startsWith('--- ') && line !== '--- /dev/null') file.path = pathname(line.slice(4))
    if (line.startsWith('rename to ') || line.startsWith('copy to ')) file.path = pathname(line.slice(line.indexOf('to ') + 3), false)
    file.metadata.push(line)
  }
  finishHunk()
  return { files, preamble: preamble.join('\n') }
}

/** Align contiguous removals/additions by position; never claim semantic line matching. */
export function splitLines(lines: DiffLine[]) {
  const rows: { left?: DiffLine; right?: DiffLine }[] = []
  for (let i = 0; i < lines.length;) {
    if (lines[i].kind === 'context') { rows.push({ left: lines[i], right: lines[i++] }); continue }
    const left: DiffLine[] = [], right: DiffLine[] = []
    while (i < lines.length && lines[i].kind !== 'context') { const line = lines[i++]; (line.kind === 'del' ? left : right).push(line) }
    for (let j = 0; j < Math.max(left.length, right.length); j++) rows.push({ left: left[j], right: right[j] })
  }
  return rows
}
