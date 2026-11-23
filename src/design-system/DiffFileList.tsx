import { ModeSelector } from './ModeSelector'
import { useMemo, useState } from 'react'
import { Badge, Button, EmptyState } from './components'
import { CommitMetadata } from './CommitMessage'
import { FilePathList } from './FilePathList'
import { fileViewModes, parseDiff } from './diff-model'

export type DiffFileSelection = { id: string; path: string; value: string }
export function DiffFileList({ value, selected, onOpen }: { value: string; selected?: string; onOpen: (file: DiffFileSelection) => void }) {
  const parsed = useMemo(() => parseDiff(value), [value])
  const [view, setView] = useState<'list' | 'tree'>('list')
  function fileRow(index: number, basename = false) {
    const file = parsed.files[index]
    const status = file.metadata.some(line => line.startsWith('new file mode')) ? '추가' : file.metadata.some(line => line.startsWith('deleted file mode')) ? '삭제' : file.metadata.some(line => line.startsWith('rename from')) ? '이름 변경' : '수정'
    const binary = file.metadata.some(line => /^(Binary files|GIT binary patch)/.test(line))
    return <Button variant="ghost" data-file-id={String(index)} aria-label={`${file.path} 변경 열기`} aria-pressed={selected === String(index)} title={file.path} onClick={() => onOpen({ id: String(index), path: file.path, value: file.raw.join('\n') })}><Badge>{status}</Badge><span className="bl-diff-file-path">{basename ? file.path.split('/').at(-1) : file.path}</span><small>{binary ? '바이너리' : file.unsupported ? '원본 diff' : `+${file.added} −${file.deleted}`}</small></Button>
  }
  return <section className="bl-diff-file-list" aria-label="변경 파일 목록">
    {parsed.preamble && <CommitMetadata value={parsed.preamble} />}
    <div className="bl-row-between"><strong>변경 파일 {parsed.files.length}개</strong><ModeSelector label="변경 파일 표시 방식" options={fileViewModes} value={view} onChange={setView} /></div>
    {/^Merge:/m.test(parsed.preamble) && <small>Merge 커밋은 첫 번째 부모와 비교합니다.</small>}
    {parsed.files.length ? <FilePathList paths={parsed.files.map(file => file.path)} view={view} renderFile={index => fileRow(index, view === 'tree')} /> : <EmptyState title="변경 파일이 없습니다">이 커밋에는 표시할 파일 변경이 없습니다.</EmptyState>}
  </section>
}
