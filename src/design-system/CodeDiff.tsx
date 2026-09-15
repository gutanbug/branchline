import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, Checkbox, EmptyState, Notice, SelectField } from './components'
import { DiffStats } from './FileChangeRow'
import { CommitMetadata } from './CommitMessage'
import { parseDiff, splitLines, type DiffLine } from './diff-model'

export function CodeDiff({ value, filename, format = 'auto', actions, hunkAction }: { hunkAction?: { label: string; disabled?: boolean; onApply: (index: number) => void }; actions?: ReactNode; value: string; filename?: string; format?: 'auto' | 'code' }) {
  const parsed = useMemo(() => format === 'code' ? { files: [], preamble: '' } : parseDiff(value, filename), [value, filename, format])
  const [choice, setChoice] = useState({ value, index: 0 }), [mode, setMode] = useState<'unified' | 'split' | 'raw'>('unified'), [wrap, setWrap] = useState(false)
  const [position, setPosition] = useState({ key: '', index: -1 })
  const index = choice.value === value ? choice.index : 0, file = parsed.files[index]
  const key = `${value}/${index}`, active = position.key === key ? position.index : -1
  const viewport = useRef<HTMLDivElement>(null)
  const structured = file && file.hunks.length > 0 && !file.unsupported
  function navigate(direction: number) {
    if (!file) return
    const target = Math.max(0, Math.min(file.hunks.length - 1, active + direction))
    setPosition({ key, index: target })
    const element = viewport.current?.querySelector<HTMLElement>(`[data-hunk="${target}"]`)
    if (element && viewport.current) { viewport.current.scrollTop += element.getBoundingClientRect().top - viewport.current.getBoundingClientRect().top - 34; element.focus({ preventScroll: true }) }
  }
  function numbers(line: DiffLine | undefined, side: 'old' | 'next') { return <span className="bl-diff-number" aria-label={line?.[side] === undefined ? undefined : `${side === 'old' ? '이전' : '이후'} ${line[side]}행`}>{line?.[side] ?? ''}</span> }
  function content(line?: DiffLine) { return <><span className="bl-diff-sign" aria-label={line?.kind === 'add' ? '추가' : line?.kind === 'del' ? '삭제' : undefined}>{line?.kind === 'add' ? '+' : line?.kind === 'del' ? '−' : ' '}</span><code className="bl-diff-text">{line?.text || ' '}{line?.noNewline && <span className="bl-diff-eol" title="마지막 줄 개행 없음"> ↵ 없음</span>}</code></> }
  const raw = file ? file.raw.join('\n') : value
  return <section className={`bl-diff-viewer ${wrap ? 'bl-diff-wrap' : ''}`} aria-label="변경 내용">
    <div className="bl-diff-toolbar">
      <div className="bl-diff-file-heading"><div className="bl-diff-file">{parsed.files.length > 1 ? <SelectField label="변경 파일" value={String(index)} onChange={selected => { setChoice({ value, index: Number(selected) }); if (viewport.current) viewport.current.scrollTop = 0 }} options={parsed.files.map((file, i) => ({ value: String(i), label: `${file.path} (+${file.added} −${file.deleted})` }))} /> : <strong title={file?.path || filename}>{file?.path || filename || '원문'}</strong>}{file && !file.unsupported && <DiffStats {...(file.metadata.some(line => /^(Binary files|GIT binary patch)/.test(line)) ? { added: null, deleted: null, reason: '바이너리' } : { added: file.added, deleted: file.deleted })} />}</div>{actions}</div>
      <div className="bl-diff-controls"><div className="bl-diff-modes" role="group" aria-label="Diff 표시 방식">{structured && <><Button aria-pressed={mode === 'unified'} onClick={() => setMode('unified')}>통합 보기</Button><Button aria-pressed={mode === 'split'} onClick={() => setMode('split')}>좌우 비교</Button><Button aria-pressed={mode === 'raw'} onClick={() => setMode('raw')}>원본 diff</Button></>}</div><Checkbox label="줄바꿈" checked={wrap} onChange={event => setWrap(event.target.checked)} /></div>
      {structured && mode !== 'raw' && <div className="bl-diff-navigation"><span aria-live="polite">변경 구간 {active < 0 ? '—' : active + 1} / {file.hunks.length}</span><Button aria-label="이전 변경 구간" disabled={active <= 0} onClick={() => navigate(-1)}>↑ 이전</Button><Button aria-label="다음 변경 구간" disabled={active >= file.hunks.length - 1} onClick={() => navigate(1)}>↓ 다음</Button></div>}
    </div>
    {parsed.preamble && file && <CommitMetadata value={parsed.preamble} />}
    {file?.unsupported && <Notice compact>병합 형식 또는 불완전한 diff입니다. 행 관계를 추정하지 않고 원본을 표시합니다.</Notice>}
    <div key={`${index}/${format}`} ref={viewport} className="bl-diff-viewport" role="region" tabIndex={0} aria-label={structured && mode !== 'raw' ? mode === 'split' ? '좌우 diff 코드' : '통합 diff 코드' : '원문 코드'}>
      {structured && mode !== 'raw' ? <table className={`bl-diff-lines ${mode === 'split' ? 'bl-diff-split' : 'bl-diff-unified'}`} aria-label={mode === 'split' ? '이전과 이후 코드 비교' : '통합 변경 코드'}>
        <thead><tr>{mode === 'split' ? <><th scope="col">이전 · 삭제</th><th scope="col">이후 · 추가</th></> : <><th scope="col">이전</th><th scope="col">이후</th><th scope="col"><span className="sr-only">변경</span></th><th scope="col">변경 내용</th></>}</tr></thead>
        {file.hunks.map((hunk, h) => <tbody key={h} data-hunk={h} className="bl-diff-hunk" tabIndex={-1} aria-label={`변경 구간 ${h + 1}`}><tr><th colSpan={mode === 'split' ? 2 : 4} className="bl-diff-hunk-header"><div className="bl-diff-hunk-heading"><span>{hunk.header}</span>{hunkAction && parsed.files.length === 1 && <Button disabled={hunkAction.disabled} aria-label={`변경 구간 ${h + 1} ${hunkAction.label}`} onClick={() => hunkAction.onApply(h)}>{hunkAction.label}</Button>}</div></th></tr>{mode === 'unified' ? hunk.lines.map((line, i) => <tr key={i} className={`bl-diff-line bl-diff-${line.kind}`}><td>{numbers(line, 'old')}</td><td>{numbers(line, 'next')}</td><td className="bl-diff-sign" aria-label={line.kind === 'add' ? '추가' : line.kind === 'del' ? '삭제' : undefined}>{line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' '}</td><td><code className="bl-diff-text">{line.text || ' '}{line.noNewline && <span className="bl-diff-eol"> ↵ 없음</span>}</code></td></tr>) : splitLines(hunk.lines).map((row, i) => <tr key={i} className="bl-diff-pair"><td className={`bl-diff-side bl-diff-${row.left?.kind || 'gap'}`}><div>{numbers(row.left, 'old')}{content(row.left)}</div></td><td className={`bl-diff-side bl-diff-${row.right?.kind || 'gap'}`}><div>{numbers(row.right, 'next')}{content(row.right)}</div></td></tr>)}</tbody>)}
      </table> : raw ? <div className="bl-diff-raw">{raw.split('\n').map((line, i) => <div className="bl-diff-source-line" key={i}><span className="bl-diff-number" aria-hidden="true">{i + 1}</span><code className="bl-diff-text">{line || ' '}</code></div>)}</div> : <EmptyState title="표시할 내용이 없습니다">선택한 범위에는 텍스트 변경이 없습니다.</EmptyState>}
    </div>
  </section>
}
