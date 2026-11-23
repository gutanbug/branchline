import { fileViewModes } from './diff-model'
import { ModeSelector } from './ModeSelector'
import { useState, type ReactNode } from 'react'
import { Badge, Button, EmptyState, TextField } from './components'
import { FilePathList } from './FilePathList'
import { ResizeHandle } from './ResizeHandle'

export function ChangeFileList({ label, paths, actions, renderFile, empty }: { label: string; paths: string[]; actions?: (filteredPaths: string[] | null) => ReactNode; renderFile: (index: number, view: 'list' | 'tree') => ReactNode; empty: string }) {
  const [query, setQuery] = useState(''), [view, setView] = useState<'list' | 'tree'>('list'), [height, setHeight] = useState(360)
  const matches = paths.map((path, index) => ({ path, index })).filter(file => file.path.normalize('NFC').toLocaleLowerCase().includes(query.normalize('NFC').trim().toLocaleLowerCase()))
  return <section className="bl-change-list" aria-label={label}>
    <div className="bl-row-between"><h2>{label} <Badge>{paths.length}</Badge></h2>{actions?.(query.trim() ? matches.map(file => file.path) : null)}</div>
    {(paths.length >= 2 || query) && <div className="bl-change-list-tools"><TextField label={`${label} 검색`} hideLabel value={query} placeholder={`${label} 검색 · 파일명 또는 경로`} onChange={event => setQuery(event.target.value)} /><ModeSelector label={`${label} 표시 방식`} options={fileViewModes} value={view} onChange={setView} /></div>}
    {query && <div className="bl-row-between"><small role="status">{paths.length}개 중 {matches.length}개 표시</small><Button onClick={() => setQuery('')}>검색 지우기</Button></div>}
    <div className="bl-file-list" style={{ maxHeight: height }}>{matches.length ? <FilePathList key={query} paths={matches.map(file => file.path)} view={paths.length >= 2 ? view : 'list'} renderFile={index => renderFile(matches[index].index, paths.length >= 2 ? view : 'list')} /> : query && paths.length ? <EmptyState title="일치하는 파일이 없습니다">다른 파일명이나 경로로 검색하세요.</EmptyState> : <p className="bl-muted">{empty}</p>}</div>
    {matches.length > 4 && <ResizeHandle orientation="horizontal" label={`${label} 목록 높이`} value={height} min={160} max={720} onChange={setHeight} />}
  </section>
}
