import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from './components'
import { CodeDiff } from './CodeDiff'
import { DiffFileList, type DiffFileSelection } from './DiffFileList'

/** Expanded inspectors preview locally; inline inspectors open the workspace tab. */
export function DiffFileBrowser({ value, preview, selected, onOpen }: { value: string; preview: boolean; selected?: string; onOpen: (file: DiffFileSelection) => void }) {
  const [opened, setOpened] = useState<{ source: string; file: DiffFileSelection } | null>(null)
  const file = preview && opened?.source === value ? opened.file : null
  const root = useRef<HTMLDivElement>(null)
  const previous = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (file) root.current?.querySelector<HTMLButtonElement>('.bl-diff-browser-back button')?.focus()
    else if (previous.current && preview) root.current?.querySelector<HTMLButtonElement>(`[data-file-id="${previous.current}"]`)?.focus({ preventScroll: true })
    previous.current = file?.id ?? null
  }, [file, preview])
  return <div ref={root} className="bl-diff-browser" data-preview={!!file}>
    <div hidden={!!file} className="bl-diff-browser-list"><DiffFileList value={value} selected={preview ? opened?.source === value ? opened.file.id : undefined : selected} onOpen={file => preview ? setOpened({ source: value, file }) : onOpen(file)} /></div>
    {file && <><div className="bl-diff-browser-back"><Button onClick={() => setOpened(null)}>← 변경 파일 목록</Button></div><CodeDiff key={file.id} value={file.value} filename={file.path} /></>}
  </div>
}
